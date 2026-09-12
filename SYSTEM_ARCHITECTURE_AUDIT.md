# System Architecture & Data Flow Audit: Real Estate Ingestion Pipeline

## 1. Firestore Collections Overview
The active schema relies on a root-level collection for projects and nested subcollections for units and pricing history.
*   **`projects`**: The root collection containing high-level metadata about real estate developments (Books/Brochures).
    *   *Document ID*: A URL-friendly slug generated from the project name, or explicitly matched via semantic resolution.
*   **`projects/{projectId}/units`**: A subcollection within each project containing individual unit metadata (e.g., area_m2, bedrooms).
    *   *Document ID*: Deterministically generated from the `unit_number` to prevent duplication (e.g., "101A").
*   **`projects/{projectId}/units/{unitId}/snapshots`**: A subcollection within each unit containing historical pricing and availability data over time.
    *   *Document ID*: Auto-generated Firebase push ID.
*   **`pdf_jobs`**: A tracking collection for the B2B PDF ingestion pipeline. Monitors status ('Processing', 'Success', 'Failed') and statistics of uploaded documents.

## 2. Data Lifecycle (Ingestion to Frontend)
The exact path a property takes from ingestion to publication depends on the confidence of the entity resolution process.

1.  **Ingestion & LLM Extraction**: Data enters via the B2B PDF upload (triggers Cloud Function `ingestPdf`) or the Python Playwright scraper. It is processed by Gemini 2.5 Flash using a strict JSON schema.
2.  **Deterministic Entity Resolution**: The backend normalizes the extracted project name and developer. It compares these against existing projects in the `projects` collection using semantic token matching and Levenshtein distance.
3.  **Routing (Staging vs. Active)**:
    *   **High-Confidence Match**: If an exact or close match is found, the data is merged into the existing project. `resolution_state` is set to `'active'`.
    *   **New Project**: If no match is found, a new project document is created. `resolution_state` is set to `'staged'`.
4.  **Admin Review (Staging)**: Projects with `resolution_state: 'staged'` do *not* appear on the public frontend. They appear in the "3. Staging (Revisão)" tab of the Admin Panel (`/admin`).
5.  **Approval & Publication**: An admin must either:
    *   **Confirm as New**: Updates `resolution_state` to `'active'`, making it visible on the public frontend.
    *   **Merge**: Deep copies the staged project's units and snapshots to an existing target project, then deletes the staged project.
6.  **Public Frontend**: The B2C catalog (`PublicHome` and `PublicProjectDetail`) queries the `projects` collection, explicitly filtering out staged projects (`p.resolution_state !== 'staged'`).

## 3. Expected Schema for Rendering
To successfully render on the main website (`PublicProjectDetail.jsx` and `PublicHome.jsx`), the documents must conform to the following schema (based on `backend/src/schema.ts` and frontend rendering logic):

### Project Document (`projects/{projectId}`)
*   **`id`**: String (URL slug)
*   **`name`**: String (Required)
*   **`developer`**: String (Nullable/Optional)
*   **`status`**: String enum (`'na_planta'`, `'em_construcao'`, `'pronto'`, `''`) (Nullable/Optional)
*   **`delivery_date`**: ISO 8601 String (Nullable/Optional)
*   **`location`**: Object (Nullable/Optional)
    *   `neighborhood`: String enum (e.g., `'Cabo Branco'`, `'Tambau'`)
    *   `position_to_sea`: String enum
    *   `distance_to_beach_meters`: Number or `null` (NEVER 0 for missing)
    *   `coordinates`: Object (`{ lat: Number, lng: Number }`)
*   **`amenities`**: Array of Strings (Nullable/Optional)
*   **`ai_context`**: Object (Crucial for "AI Insights" UI)
    *   `target_persona`: Object (`{ 'pt-BR': [String], 'en': [String] }`)
    *   `investment_roi_estimated_percent`: Number or `null`
    *   `local_advantage`: Object (`{ 'pt-BR': String, 'en': String }`)
*   **`assets`**: Object
    *   `hero_images`: Array of Strings (Storage paths)
*   **`manual_hero_image_url`**: String (Overrides `assets.hero_images` if present)
*   **`resolution_state`**: String (`'active'` or `'staged'`). **Must be `'active'` to render.**
*   **`has_units`**: Boolean (Set to true if units exist)

### Unit Document (`projects/{projectId}/units/{unitId}`)
*   **`id`**: String (Normalized unit number)
*   **`unit_number`**: String
*   **`area_m2`**: Number or `null` (NEVER 0 for missing)
*   **`bedrooms`**: Number or `null` (NEVER 0 for missing)
*   **`latest_snapshot`**: Object (Pre-calculated for fast frontend rendering of the Smart Canvas)
    *   `price_brl`: Number or `null`
    *   `price_per_m2_brl`: Number or `null`
    *   `source`: String (URL or filename)
    *   `timestamp`: ISO 8601 String

*Note: Missing numeric fields must strictly use `null`, never `0`, to avoid corrupting pricing logic and frontend UI elements.*

## 4. Admin Panel Logic (Staging Tab)
The "3. Staging (Revisão)" tab manages the HITL (Human-in-the-Loop) resolution queue.

*   **Fetching**: The Admin component listens to the `projects` collection via `onSnapshot`. It filters the local state to display only projects where `resolution_state === 'staged'`.
*   **Display**: It renders a grid of staged project cards showing basic info (Name, Developer, Neighborhood) and two action buttons: "Confirmar como Novo" and "Mesclar com Existente".
*   **Approval Data Flow**:
    *   **"Confirmar como Novo"**: Executes a Firestore `updateDoc` on the target project to set `resolution_state: 'active'`. This immediately makes the project visible on the public B2C frontend.
    *   **"Mesclar com Existente"**: Opens a modal to select an existing active project. Upon confirmation, the `handleMergeSubmit` function executes a complex data migration:
        1.  Reads all units from the staged project.
        2.  Writes each unit to the target project's `units` subcollection.
        3.  Reads all snapshots for each unit from the staged project.
        4.  Writes each snapshot to the new unit's `snapshots` subcollection in the target project.
        5.  Deletes the old snapshots, old units, and finally the staged project document.
