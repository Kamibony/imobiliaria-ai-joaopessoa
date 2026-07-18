# Phase 3 Proposal: Entity Merging & Presentation

## 1. Data Modeling (Project -> Units)

Currently, the system models properties as flat entities (1 row = 1 unit). This is problematic because a real estate project usually consists of a "Book" (brochure with amenities, location, personas) and a "Tabela" (price list with units, pricing, square meters). The current schema cannot relate units to a project.

**Proposed Solution: Relational / Embedded Model in Firestore**

We will restructure Firestore to adopt a parent-child relationship:

*   **Parent Entity: `Project` (Empreendimento)**
    *   **Collection:** `projects`
    *   **Fields:**
        *   `id`: Unique identifier (e.g., slugified name or auto-generated UUID).
        *   `name`: Name of the project (e.g., "Lumi").
        *   `developer`: Name of the developer (e.g., "Construtora A").
        *   `location`: Neighborhood, coordinates, distance to beach.
        *   `amenities`: List of amenities extracted from the Book.
        *   `ai_context`: Target persona, ROI estimates, local advantages (multilingual).
        *   `delivery_date`: Estimated completion date.
        *   `status`: 'na_planta', 'em_construcao', 'pronto'.

*   **Child Entity: `Unit` (Unidade)**
    *   **Collection:** `projects/{projectId}/units` (Subcollection)
    *   **Fields:**
        *   `id`: Unique identifier (e.g., unit number "101").
        *   `unit_number`: The unit identifier (e.g., "101A").
        *   `area_m2`: Private area in square meters.
        *   `bedrooms`: Number of bedrooms.
        *   `sun_orientation`: e.g., 'nascente'.
        *   `snapshots`: Time-series pricing data (price_brl, price_per_m2_brl, timestamp, source).

**Zod Schema Changes:**
We will update `backend/src/schema.ts` to define `ProjectSchema` and `UnitSchema`, ensuring strict validation for both entities.

## 2. Smart Merging Logic (Upsert)

The `ingestPdf` function needs to intelligently merge data from "Books" and "Tabelas" belonging to the same project.

**Proposed Logic:**

1.  **Entity Identification:** The Gemini model will be instructed to extract a normalized "Project Name" and "Developer Name" from every PDF, regardless of whether it's a Book or a Tabela.
2.  **Upsert by Project Name:**
    *   When a PDF is processed, the backend generates a deterministic `projectId` (e.g., `slugify(developer + "-" + projectName)`).
    *   **If it's a Book:** Upsert the `projects` document with rich metadata (amenities, location, `ai_context`). If units are mentioned, create them in the `units` subcollection.
    *   **If it's a Tabela:** Upsert the `projects` document (updating or creating it if it doesn't exist). Then, for each extracted unit, upsert it into the `projects/{projectId}/units` subcollection.
3.  **Conflict Resolution:** Use Firestore's `{ merge: true }` heavily. Book data should not overwrite Tabela pricing, and Tabela pricing should not overwrite Book amenities.

## 3. Pipeline Transparency Fix (Silent Validation Bug)

Currently in `backend/src/index.ts`, if `PropertySchema.safeParse(unit)` fails for *all* units in an array, the loop skips all elements, but the job is still marked as "Success".

**Proposed Fix in `ingestPdf`:**

```typescript
    let validUnitsCount = 0;

    for (const unit of extractedUnits) {
      const validationResult = PropertySchema.safeParse(unit);
      if (!validationResult.success) {
        console.error("Schema validation failed for a unit:", validationResult.error);
        continue;
      }
      // ... processing ...
      validUnitsCount++;
    }

    if (fileName) {
      try {
        if (validUnitsCount === 0) {
            await db.collection("pdf_jobs").doc(fileName).update({
              status: "Failed",
              error: "Schema validation failed for all extracted entities. 0 entities saved.",
            });
        } else {
            await db.collection("pdf_jobs").doc(fileName).update({
              status: "Success",
              extracted_count: validUnitsCount, // Optional: add metrics
            });
        }
      } catch (e) {
        // ...
      }
    }
```
This ensures that if 0 items pass Zod validation, the UI accurately reflects a pipeline failure due to schema mismatch.

## 4. Frontend Presentation (The "Wow" Detail View)

The "Catálogo & Mapa" tab needs a refactor to support the Project-centric model.

**Proposed Changes (`frontend/src/`):**

1.  **Map Layer (Project Markers):**
    *   The map should display markers for *Projects* (`projects` collection), not individual units.
    *   The popup on a marker should show a high-level summary: Project Name, Developer, Starting Price (min price from subcollection), and AI ROI Badge.
2.  **Premium Detail View (Modal/Sidebar):**
    *   Clicking a project (on the map or in a list) opens a "Project Detail View".
    *   **Header Section:** Combines Book data: Name, Developer, AI Insights (Target Persona pills, Local Advantage), and Amenities list.
    *   **Analytics Section:** Average price/m², ROI estimate.
    *   **Inventory Data Grid:** A sortable, filterable table/grid displaying the `units` subcollection data. Columns: Unit #, Area (m²), Bedrooms, Orientation, Current Price, Status.
    *   **Source Verification:** The "X-Ray" 'Verificar Fonte' button remains, potentially listing all sources (Book and Tabela) associated with the project.
3.  **Data Fetching:** Update Firebase queries to first fetch `projects`, and then lazily load the `units` subcollection when the Detail View is opened to optimize reads.
