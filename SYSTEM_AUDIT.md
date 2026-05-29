# SYSTEM_AUDIT.md

## 1. System Architecture & Capabilities Blueprint

Imobiliária AI operates as a robust, hybrid autonomous ecosystem designed to ingest unstructured real estate data, structure it intelligently via generative AI, and serve it to a React-based administration panel.

The architecture is built on three decoupled pillars:
*   **Pillar 1: Data Acquisition (Playwright Scraper on GitHub Actions):** A "dumb" Python microservice that crawls seed domains, strips noisy DOM elements, and extracts raw text to bypass anti-bot systems.
*   **Pillar 2: AI Processing Pipeline (Firebase Cloud Functions + Vertex AI Gemini 2.5 Flash):** An orchestrator layer that parses raw data and structures it to adhere to a strict property schema. It utilizes an event-sourced "Time Machine" architecture (saving historical price/status as `PropertySnapshot` arrays).
*   **Pillar 3: Frontend Dashboard (React / Vite):** A Single Page Application (SPA) leveraging Firebase Auth, Firestore real-time listeners, Leaflet mapping, and Recharts analytics.

### Multi-Phase Execution Flow

*   **Phase 1: Semantic Link Discovery:** The Python scraper visits seed domains (`SEED_DOMAINS`) and extracts all raw `<a>` links. It then invokes the `filterDiscoveredUrls` Cloud Function, where Gemini evaluates the links contextually, discarding noise and returning only relevant property/project detail pages. These discovered URLs are deduplicated and saved to Firestore via the `addDiscoveredUrls` webhook.
*   **Phase 2: Structural Ingestion:** The scraper fetches the validated target URLs via `getTargetUrls`. It navigates to each URL, strips out irrelevant elements (header, footer, nav, script), and captures the text prioritizing the `<main>` tag. The raw text is POSTed to the `ingestPropertyData` webhook, where Gemini parses the unstructured data into a strict JSON schema. The parsed data is persisted into Firestore as property entities and historical snapshots.

---

## 2. Root-Cause Error & Bottleneck Analysis

### Scraper Timeouts
*   **Symptom:** The scraper hits `Read timed out (read timeout=15)` during the property ingestion phase.
*   **Root Cause:** The generative AI inference (Gemini 2.5 Flash) executed synchronously within the `ingestPropertyData` webhook frequently takes 30–60 seconds to process complex real estate text. However, the Python scraper enforces a strict 15-second timeout limit.
*   **Exact Line Causing Bottleneck:**
    `scraper/main.py`, line 45:
    ```python
    webhook_response = requests.post(WEBHOOK_URL, json=payload, headers=webhook_headers, timeout=15)
    ```
*   **Secondary Issue:** The `ingestPropertyData` Cloud Function itself (in `backend/src/index.ts`) lacks the explicit `{ timeoutSeconds: 120 }` configuration, defaulting to 60 seconds.

### Silent Frontend Failures (Ghost Data)
*   **Symptom:** 5 properties successfully returned 200 OK from the ingestion webhook and are persisted in Firestore, but the React frontend catalog and map tabs remain completely empty.
*   **Root Causes (Semantic & Structural Mismatches):**
    1.  **Component Crash (White Screen of Death) via Unsafe Iteration:** Gemini occasionally outputs strings instead of arrays for nested fields like `snapshots` (e.g., returning a single object instead of an array) or `ai_context.target_persona` (e.g., `"Investidores"` instead of `["Investidores"]`). In `frontend/src/App.jsx`, functions like `getLatestSnapshot` perform spread operations (`[...snapshots]`) and `PropertyCard` executes `.map()` directly on `target_persona`. If the data type is incorrect (string or object instead of array), these operations throw an unhandled `TypeError` (e.g., `aiContext.target_persona.map is not a function`), silently crashing the entire React component tree and rendering a blank catalog.
    2.  **Brittle Coordinate Fallback System:** When the AI fails to extract exact coordinates, the backend (`index.ts`) attempts to assign hardcoded coordinates using strict equality (`if (neighborhood === 'Tambau')`). If Gemini returns an accent variation (e.g., `"Tambaú"`) or altered casing, the fallback logic is bypassed. Consequently, `lat` and `lng` remain `null`.
    3.  **Falsy Coordinate Filtering:** In the `App.jsx` map view, properties are filtered using strict truthiness: `.filter(p => p.location?.coordinates?.lat && p.location?.coordinates?.lng)`. If coordinates are missing (`null`) or if Gemini strictly adhered to instructions and assigned `0`, the values evaluate to `false` in JavaScript, silently hiding the properties from the map tab.

---

## 3. Architectural Remediation Plan

To ensure high frontend resilience and absolute scraper reliability, we must implement the following non-brittle remediation plan:

### 1. Scraper & Backend Reliability Optimization
*   **Increase Scraper Ingestion Timeout:** Update `scraper/main.py` line 45 to align with the discovery phase timeout: `timeout=130`.
*   **Configure Cloud Function Timeout:** Modify `ingestPropertyData` in `backend/src/index.ts` to explicitly define the execution limit:
    `export const ingestPropertyData = onRequest({ timeoutSeconds: 120 }, async (request, response) => { ... })`

### 2. Defensive Frontend Programming (Resilience Layer)
*   **Safe Array Handling:** Implement array safety checks in `frontend/src/App.jsx` prior to iterations.
    *   `getLatestSnapshot`: Ensure snapshots is an array before spreading: `const snapshots = Array.isArray(property.snapshots) ? property.snapshots : [];`
    *   `PropertyCard (Persona Tags)`: Check for array types before mapping: `Array.isArray(aiContext.target_persona) && aiContext.target_persona.map(...)`
*   **Robust Map Filtering:** Update the Map coordinate filtering to perform strict null/undefined checks instead of relying on truthiness, preventing the exclusion of properties with coordinate `0`:
    `.filter(p => p.location?.coordinates?.lat != null && p.location?.coordinates?.lng != null)`

### 3. Backend Fallback Normalization
*   **Semantic String Normalization:** Refactor the fallback coordinate logic in `backend/src/index.ts` to strip accents and normalize to lowercase before evaluation.
    ```typescript
    const normalizedNeighborhood = neighborhood?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (normalizedNeighborhood === 'cabo branco') { ... }
    else if (normalizedNeighborhood === 'tambau') { ... }
    ```
*   **Data Type Validation Post-Extraction:** Forcefully cast single objects to arrays in the backend before saving to Firestore if Gemini fails structural alignment (e.g., ensuring `propertyData.snapshots` and `propertyData.ai_context.target_persona` are always wrapped as arrays).