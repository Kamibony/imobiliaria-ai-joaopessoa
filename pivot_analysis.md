# Architectural Pivot Analysis: Web Scraping to B2B PDF Ingestion

## 1. Executive Summary

This document analyzes the proposed architectural pivot for the Imobiliária AI (João Pessoa) project. The transition involves moving away from the fragile Playwright DOM web scraper in favor of a direct B2B Document Ingestion pipeline. By utilizing the PDFs (promotional Books and Pricing Tables) provided directly by constructors, we can significantly improve data accuracy, system reliability, and reduce maintenance overhead.

## 2. Proposed Architecture & Stack

The new architecture will leverage the existing GCP/Firebase ecosystem while replacing the Python data acquisition pillar with a serverless document processing pipeline.

*   **Frontend (React + Vite):** A new Admin UI section will be introduced to upload PDF files (Brochures, Price Tables) directly to Firebase Cloud Storage.
*   **Infrastructure (Firebase Cloud Storage & Functions v2):**
    *   **Cloud Storage:** Acts as the staging area for uploaded PDFs.
    *   **Cloud Functions v2:** Triggered by Cloud Storage `onObjectFinalized` events (or via direct HTTP uploads) to process the PDFs.
*   **AI Extraction (Gemini 2.5 Flash):** The Cloud Function will send the PDF content (via Google Cloud Storage URI or base64) to the Gemini 2.5 Flash API. Prompt engineering will enforce a strict JSON schema output matching our `Property` and `PropertySnapshot` models.
*   **Database (Firestore):** The structured JSON output from Gemini will be validated and then merged/upserted into the Firestore database, maintaining the Time Machine architecture for property snapshots.

## 3. Architectural Benefits

1.  **Reliability & Stability:** Eliminates the brittleness of DOM scraping. Constructors frequently update their websites, causing scrapers to break. PDFs have a consistent, standard format.
2.  **Bypass Anti-Bot Measures:** We no longer need to worry about Cloudflare, CAPTCHAs, or IP blocking since we ingest documents provided directly to brokers.
3.  **Higher Data Quality:** Constructor PDFs contain the "source of truth" for pricing, availability, and detailed technical specifications, which are often abstracted or omitted on public websites.
4.  **Simplified Infrastructure:** We can deprecate the standalone Python scraper and its associated GitHub Actions CRON jobs, unifying the backend on Firebase Node.js.

## 4. Potential Risks & Bottlenecks

1.  **Cloud Function Timeouts:**
    *   *Risk:* Large PDFs (e.g., 50+ page promotional books with high-res images) may take significant time for Gemini to process, potentially exceeding standard HTTP function timeouts.
    *   *Mitigation:* Utilize Firebase Functions v2 Task Queues (`onTaskDispatched`) to process documents asynchronously. Increase the timeout limit of the processing function (e.g., `timeoutSeconds: 300` or `540`). Acknowledge uploads immediately and process in the background.
2.  **Context Window Limits:**
    *   *Risk:* Massive PDFs might exceed Gemini 2.5 Flash's context window.
    *   *Mitigation:* Pre-process PDFs to extract only text and relevant images before sending, or split PDFs into smaller chunks if necessary (e.g., separating the pricing table from the promotional book).
3.  **Race Conditions & Upsert Conflicts:**
    *   *Risk:* Concurrent uploads of different PDFs for the same property might lead to race conditions during Firestore upserts, potentially corrupting the `PropertySnapshot` array.
    *   *Mitigation:* Use Firestore Transactions (`runTransaction`) for all merge and upsert operations to guarantee atomic updates and enforce consistent state.
4.  **Schema Hallucinations:**
    *   *Risk:* Gemini may occasionally hallucinate or return improperly formatted JSON, even with strict prompting.
    *   *Mitigation:* Implement strict schema validation (e.g., using `zod`) on the AI output *before* interacting with Firestore. Fail the task safely if the validation fails.

## 5. Codebase Impact Analysis

### Files to Delete (Deprecating Web Scraping)
*   `scraper/main.py`: The core Playwright scraping script.
*   `scraper/requirements.txt`: Python dependencies.
*   `scraper/.env.example`: Scraper environment variables.
*   `.github/workflows/run-scraper.yml`: The CRON job automation (if it exists, or remove scraper steps from workflow).
*   Backend endpoints related to scraper webhooks (e.g., `addDiscoveredUrls`, `filterDiscoveredUrls`, `processTriageAction` if they are strictly tied to the web scraper flow).
*   Remove the entire `scraper/` directory.

### Files to Create / Modify (Implementing PDF Ingestion)
*   **Frontend:**
    *   `frontend/src/components/UploadPDF.jsx`: A new React component allowing brokers/admins to upload constructor PDFs.
    *   Update `frontend/src/pages/AdminDashboard.jsx` (or similar): Integrate the new upload component and show processing status.
*   **Backend (`backend/src/index.ts` & new modules):**
    *   `backend/src/functions/ingestPDF.ts`: A new Cloud Function (Storage trigger or HTTP triggered task queue) that handles the PDF, calls Vertex AI/Gemini, and parses the output.
    *   `backend/src/services/geminiPDFService.ts`: Encapsulates the Gemini 2.5 Flash API calls for multimodal document processing with strict JSON instructions.
    *   `backend/src/services/firestoreMergeService.ts`: Handles the transactional upsert logic for `Property` and `PropertySnapshot` entities.
    *   Update `backend/src/schema.ts`: Ensure the `zod` schemas perfectly match the expected PDF data structure.

## 6. Phased Implementation Roadmap

### Phase 1: Clean Slate & Infrastructure Setup (Weeks 1-2)
1.  **Deprecate Scraper:** Remove the `scraper/` directory and related GitHub Actions workflows to stop legacy data ingestion.
2.  **Storage Configuration:** Set up Firebase Cloud Storage buckets with appropriate security rules for PDF uploads.
3.  **Schema Refinement:** Review and update the `Property` and `PropertySnapshot` `zod` schemas in the backend to ensure they align with the data available in PDFs.

### Phase 2: AI Pipeline & Backend Logic (Weeks 2-3)
1.  **Gemini 2.5 Flash Integration:** Develop the `geminiPDFService` in the Node.js backend to send PDFs to Vertex AI and extract JSON.
2.  **Prompt Engineering:** Iteratively test prompts against sample constructor PDFs to achieve robust, structured JSON outputs, ensuring missing data defaults to `null`.
3.  **Firestore Upsert Logic:** Implement the transactional merge service (`firestoreMergeService`) to safely update properties and append pricing snapshots.
4.  **Task Queue Implementation:** Configure Firebase Functions v2 Task Queues to handle the asynchronous ingestion process and prevent timeouts.

### Phase 3: Frontend Upload & UI (Week 4)
1.  **Upload Interface:** Build the React components in the Admin Dashboard for PDF selection and upload to Firebase Storage.
2.  **Processing Status UI:** Implement UI feedback (e.g., polling or Firestore listeners) to show the user the status of their uploaded document (e.g., "Processing", "Completed", "Failed").
3.  **Human-in-the-Loop (HITL):** Adapt the existing 'Caixa de Entrada' to review and approve extracted PDF data before it is permanently merged into the catalog.

### Phase 4: Testing & Deployment (Week 5)
1.  **End-to-End Testing:** Validate the entire flow from PDF upload to frontend display using a variety of real-world constructor documents.
2.  **Rollout:** Deploy the updated backend and frontend. Train brokers on the new direct-upload workflow.
