# Admin Dashboard 2.0 Proposal: UI/UX & Data Lifecycle Architecture

This document outlines the conceptual and structural proposal for transforming the Imobiliária AI frontend into a comprehensive Admin Dashboard. The goal is to provide transparency into the AI ingestion pipeline, enable human-in-the-loop validation, and offer robust inventory and lifecycle management tools.

## 1. Pipeline Transparency & Document Logging
**Objective:** Transform the backend pipeline from a "black box" into an observable, real-time system.

*   **Concept:** A dedicated interface tracking the lifecycle of every uploaded B2B document from ingestion to final extraction.
*   **Proposed UI Component: "Pipeline Monitor"**
    *   **Data Grid:** A chronological table listing all document uploads. Columns should include: Document Name, Upload Date, Uploaded By, Current Status (Queued, Processing, AI Validation, Success, Failed, Requires Review), and Processing Duration.
    *   **Real-Time Reactivity:** Leverage Firestore real-time listeners (`onSnapshot`) to visually update the status of each file as Cloud Functions process them.
    *   **Job Details Panel:** Clicking a row opens an off-canvas drawer or modal. This panel will display execution logs, extracted metadata, Vertex AI token usage, and specific validation warnings (e.g., missing fields identified by Zod schemas).
    *   **Actionable Error Recovery:** If a document fails processing, the UI should display the explicit error and provide a "Retry Pipeline" button.

## 2. Human-in-the-Loop (HITL) / Staging Area
**Objective:** Ensure high precision and prevent AI hallucinations from polluting the production database by enforcing manual review before publication.

*   **Concept:** A staging buffer where extracted data sits in a `PENDING_REVIEW` state until an administrator validates it.
*   **Proposed UI Component: "Staging Inbox"**
    *   **Queue System:** A prioritized inbox of properties awaiting review, replacing the generic "Caixa de Entrada" with a workflow tailored for B2B PDFs.
    *   **Split-Screen Validation Interface:**
        *   *Left Pane:* An embedded PDF viewer (or direct link) showing the original uploaded "Tabela" or "Book".
        *   *Right Pane:* A structured, editable form populated with the AI-extracted JSON (Empreendimento, Construtora, Unidades, Preços, Área).
    *   **Inline Editing:** Administrators can manually correct typos, fill in values the AI missed (like a null price becoming a specific number), or remove hallucinated details directly within the staging form.
    *   **Explicit Approval Actions:** Buttons for "Approve & Publish" (commits data to production), "Reject/Discard", and "Request Re-extraction".

## 3. Data & Price Lifecycle Management
**Objective:** Handle iterative updates (like new monthly price lists) gracefully, building a rich historical dataset without duplicating properties.

*   **Concept:** Implement a true event-sourced architecture for pricing and status.
*   **Data Flow Strategy:**
    *   When a new "Tabela" PDF is uploaded for an existing 'Empreendimento', the backend resolves the entities by matching unit numbers and blocks.
    *   Instead of overwriting the original property document, the system appends a new `PropertySnapshot` object to the property's array. This snapshot contains the new price, status, and timestamp.
*   **Proposed UI Component: "Price History & Trends"**
    *   **Property Detail View:** Within the catalog, the expanded property card will feature a "Historical Trends" tab.
    *   **Visualizations:** Utilize Recharts to render line graphs tracking the `price_brl` and `price_per_m2_brl` trajectory over time, demonstrating appreciation/ROI visually based on snapshot data.
    *   **Document Archival:** Older source PDFs are systemically untagged as the "active source" but retained in Firebase Storage, serving purely as an audit trail for the historical snapshots.

## 4. Property Inventory Management
**Objective:** Provide administrators with standard, powerful tools to manage the active property catalog.

*   **Concept:** Upgrade the current map-centric view to a robust data management interface.
*   **Proposed UI Component: "Inventory Manager"**
    *   **Advanced Data Grid:** A highly filterable and sortable table replacing or supplementing the standard card layout.
    *   **Core Features:**
        *   *Inline Edits:* Ability to quickly toggle statuses (e.g., from 'Available' to 'Sold') or adjust prices without opening a full edit modal.
        *   *Bulk Actions:* Select multiple units to apply batch updates (e.g., mark an entire block as 'Sold Out').
        *   *Soft Deletes (Decommissioning):* Instead of hard-deleting records (which destroys historical data), implement a `status: 'ARCHIVED'` or `is_active: false` flag. This hides the property from the public and analytics but retains it for internal reporting.
        *   *Advanced Filtering:* Filter properties by developer, ROI percentage, time since the last price update, and missing data flags.
