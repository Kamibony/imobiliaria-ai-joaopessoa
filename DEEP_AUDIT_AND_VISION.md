# Deep Architectural Audit & Systemic Vision

## 1. Executive Summary

The current architecture, while conceptually moving in the right direction (utilizing AI for unstructured PDF ingestion), is encountering systemic failures in real-world scenarios. The issues—duplicate project creation, missing unit data on the frontend, and broken PDF X-Ray links—are not isolated bugs, but symptoms of architectural misalignments between the ingestion pipeline, the data model, and the frontend data-flow.

This document outlines a complete systemic rethink to ensure the platform can seamlessly and robustly handle the dual-document reality of the real estate market: the static **Book** (marketing foundation) and the dynamic **Tabela** (monthly pricing/availability matrix).

---

## 2. Gap Analysis: Why is the Current Architecture Failing?

### A. AI Entity Resolution Creating Duplicates
**The Problem:** When a new Tabela is uploaded, it often creates a new project instead of updating the existing one, leading to duplicates.
**Root Cause Analysis:** The backend (`backend/src/index.ts`) attempts to perform Entity Resolution entirely inside the LLM prompt. It injects a JSON array of all existing projects into the Gemini prompt and asks the LLM to return the exact ID of a match.
LLMs are non-deterministic and notoriously unreliable at strict exact-string retrieval or database-like joins. When Gemini fails to confidently match varying nomenclature (e.g., "Residencial Cabo Branco" vs "Edifício Cabo Branco"), it defaults to returning `null` for the ID. The backend then auto-generates a new Firestore ID (`db.collection("projects").doc().id`), creating a duplicate project entity instead of a merge.

### B. Broken PDF X-Ray View
**The Problem:** When users click "Ver Fonte" in the frontend to view the original PDF, the document fails to load.
**Root Cause Analysis:** This is a deterministic string concatenation bug caused by a mismatch between backend and frontend logic.
- In the backend (`ingestPdf`), the `source` path is saved as the full object path: `snap.source = "b2b_pdfs/filename.pdf"`.
- In the frontend (`App.jsx`), the `handleVerifySource` function fetches the download URL by doing: `ref(storage, \`b2b_pdfs/\${sourcePath}\`)`.
This results in a request for `b2b_pdfs/b2b_pdfs/filename.pdf`, which does not exist, triggering a Firebase Storage 404 error.

### C. Frontend Failing to Display Unit Data
**The Problem:** The "Tabela" units are not reliably displaying in the UI.
**Root Cause Analysis:**
1. **Schema Rigidity during Asymmetric Ingestion:** The `UnitSchema` validation in the backend is likely failing silently for certain units if the LLM extracts partial data. If a Tabela upload is missing contextual fields expected by the schema, the unit is skipped.
2. **Snapshot Mutation Data Structure:** The backend attempts to merge price snapshots into an array within the Unit document using a Firestore transaction. If the AI hallucinates the `unit_number` or fails to extract a consistent identifier, the backend generates a new random `unitId`, effectively orphaning the unit from its historical timeline.

---

## 3. Data Model Proposal: The "Static Book + Dynamic Tabela" Lifecycle

To natively support the reality of real estate data without corruption, we must physically separate the static metadata from the high-frequency time-series data using Firestore Subcollections.

### Proposed Firestore Structure

1. **`projects/{projectId}` (The Book - Static Foundation)**
   - Stores data that rarely changes: `name`, `developer`, `location`, `amenities`, `delivery_date`, `ai_context` (ROI, Persona).
   - Only updated when a new "Book" is uploaded or a manual admin edit occurs.

2. **`projects/{projectId}/units/{unitId}` (The Unit - Semi-Static)**
   - Stores intrinsic unit data: `unit_number`, `area_m2`, `bedrooms`, `sun_orientation`.
   - The `unitId` must be derived deterministically (e.g., a slugified version of `unit_number` like `101a`) rather than relying on random UUIDs.

3. **`projects/{projectId}/units/{unitId}/snapshots/{snapshotId}` (The Tabela - Dynamic Overlay)**
   - **NEW SUBCOLLECTION:** Instead of an array inside the unit document (which is prone to race conditions, limits document size to 1MB, and makes timeseries analysis difficult), every new Tabela upload inserts a new document here.
   - Fields: `timestamp`, `price_brl`, `status` (Available, Sold), `source_pdf_id`.
   - This cleanly handles monthly pricing uploads, allowing us to build historical pricing charts effortlessly.

---

## 4. AI Entity Resolution Strategy (Fixing the Duplicates)

We must decouple the extraction task from the entity matching task.

**Step 1: Pure Extraction (LLM)**
Gemini's sole job is to read the PDF and extract a standardized JSON object representing the document (Name, Developer, Units). It should *not* receive a list of existing database IDs.

**Step 2: Deterministic & Vector Search (Backend System)**
Once the JSON is extracted, the backend performs the match using classical algorithms:
- **Primary Pass (String Normalization):** Normalize the extracted project name and developer (lowercase, remove accents, strip generic terms like "Edifício" or "Residencial").
- **Secondary Pass (Fuzzy Match / Levenshtein):** Compare the normalized string against the database.
- **Tertiary Pass (Geospatial / Vector):** If the name matches poorly but the location and developer match exactly, it's a candidate.

**Step 3: Confidence Routing**
- **High Confidence Match:** Auto-merge the new Tabela into the existing project.
- **Low/Medium Confidence Match:** Do *not* auto-create a new project. Route the payload to a Human-in-the-Loop (HITL) staging table. An admin will see "New Tabela Uploaded: Did you mean Project X or is this a New Project?" and resolve it manually with one click.

---

## 5. Frontend Data-Flow Architecture

The React frontend must efficiently query and merge this relational structure to prevent UI lockups and ensure accurate data rendering.

**Data Fetching Strategy:**
1. **Catalog View (Lightweight):**
   - The main catalog only listens to the root `projects` collection (`onSnapshot`).
   - The backend Cloud Function should maintain aggregated summary fields on the project document (e.g., `min_price`, `available_units_count`) so the frontend doesn't need to load thousands of units just to render the grid.
2. **Project Detail Modal (Lazy Load):**
   - When a user clicks a project, fetch the `units` subcollection.
   - To get the current price, we query the `snapshots` subcollection ordered by `timestamp` descending, limited to 1.
3. **Caching Layer:**
   - Implement `react-query` or similar caching mechanisms. Currently, `onSnapshot` inside `useEffect` in the modal creates unnecessary network churn every time the modal is opened and closed.
4. **Resilience / Fallbacks:**
   - If a numeric field (`price_brl`, `area_m2`) is missing (null), the UI must explicitly render "Sob Consulta" or a dash ("-"), ensuring Recharts components don't crash or skew averages by interpreting `null` as `0`.

---

## Conclusion
By adopting this architecture, we shift from a fragile, purely LLM-driven ingestion loop to a deterministic, enterprise-grade pipeline. The separation of the Static Book and Dynamic Tabela into distinct relational data layers will permanently solve data corruption, duplicate entities, and time-series analysis limitations.