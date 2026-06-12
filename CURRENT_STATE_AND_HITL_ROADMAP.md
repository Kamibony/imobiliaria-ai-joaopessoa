# System Baseline Audit & Human-in-the-Loop (HITL) Roadmap

## 1. Current Technical Baseline

### Architectural Flow
The Imobiliária AI system operates as a specialized PropTech platform focusing on premium real estate in João Pessoa (Cabo Branco and Tambaú). The data pipeline currently functions as follows:

1. **Playwright Spider (Data Acquisition):** A Python-based microservice, orchestrated via GitHub Actions (CRON), targets local developer websites to bypass aggressive anti-bot protections (e.g., Cloudflare). It cleans the DOM (stripping header, footer, nav, script, style tags) and extracts the core textual payload.
2. **Cloud Tasks / Webhook (Ingestion & Queueing):** The scraper sends the payload to the `ingestPropertyData` webhook endpoint. To circumvent 15-second timeouts, this webhook acknowledges the payload immediately and enqueues it to Firebase Cloud Tasks or Pub/Sub for asynchronous processing.
3. **Gemini Validation via Zod (AI Processing):** The backend leverages Vertex AI (Gemini 2.5 Flash) to parse unstructured raw text into a strict JSON schema representing the `Property` entity. This includes dynamic generation of localized `ai_context` (target persona, local advantage) and `PropertySnapshot` items. A "Forgiving Schema" strategy applies `null` values when specific information (such as area or price) is unavailable. Zod schemas validate structural integrity before database operations.
4. **Firestore & Vector DB (Data Storage):** Validated data is committed to Firestore. An event-sourced "Time Machine" architecture is used: physical property traits are mostly immutable, while dynamic data (price, status) is tracked in an array of `PropertySnapshot` objects.
5. **React Admin (Frontend Dashboard):** A Vite-powered React Single Page Application provides the user interface. It handles real-time updates via Firestore listeners, provides dynamic multilingual filtering, and incorporates interactive maps (Leaflet) and analytics (Recharts).

### System Strengths
* **Anti-Bot Evasion:** By targeting specific local developer sites and pre-cleaning the DOM with a custom algorithm, the platform largely evades sophisticated bot mitigation like Cloudflare while keeping prompt token sizes manageable.
* **Resilient Ingestion:** The shift to an asynchronous Cloud Tasks queue mechanism protects against model inference timeouts that previously stalled the web scraper.
* **Historical Data Tracking:** The "Time Machine" event-sourced structure (`PropertySnapshot`) effectively tracks property prices and status changes over time, enabling robust ROI calculations and historical comparisons.
* **Multilingual Context Generation:** Native multi-language (`pt-BR` and `en`) context generation occurs simultaneously in a single prompt execution.

### Current Systemic Limitations
* **Handling Missing Crucial Data:** When a developer hides the price or dimensions, the AI accurately maps these fields to `null`. However, this simply results in "Sob Consulta" on the frontend, removing the property from critical analytics and missing an opportunity to source the data elsewhere.
* **Brittle Fallback Mechanisms:** Normalization variations in extracted neighborhood names (e.g., "Tambaú" vs "Tambau") can bypass hardcoded coordinate assignments, resulting in properties hidden from mapping layers because coordinates are missing.
* **Silent Frontend Crashes:** If Gemini hallucinates an output type (e.g., string instead of an array for `snapshots`), iterating over these fields without sufficient defensive checking causes the entire React application to render a white screen of death.
* **Lack of Automatic Human Feedback Loops:** There is no systematic way to intercept incomplete property ingestions to have a human operator or broker intervene and complete the data set.

---

## 2. The HITL Architectural Roadmap

To transition Imobiliária AI from a passive scraper to a Cooperative Human-in-the-Loop (HITL) Agentic System, the following architectural upgrades are proposed:

### Data Layer: Firestore Enhancements
We need to track the verification status of incoming property data to determine when human intervention is necessary.

* **Schema Modifications:** Add the following fields to the core `Property` document:
  ```typescript
  interface Property {
    // ... existing fields
    verification_status: 'AI_VERIFIED' | 'HUMAN_ACTION_REQUIRED' | 'RESOLVED';
    missing_fields: string[]; // e.g., ['financials.price_brl', 'features.area_m2']
    human_notes?: string;
  }
  ```
* **Snapshot Context:** If a property lacks a price upon initial ingestion, a temporary `PropertySnapshot` could be recorded with `status: 'pendente_verificacao'`, keeping the history clean until a human provides the definitive value.

### Backend Logic: Dynamic Alerting & Webhooks
The `ingestPropertyData` worker processing the Cloud Tasks queue must act as the initial gatekeeper.

1. **Evaluation Gate:** After Gemini parses the JSON payload and Zod validates its structure, the backend evaluates the output for essential business logic completeness:
   ```typescript
   const missingFields = [];
   if (propertyData.financials.price_brl === null) missingFields.push('price_brl');
   if (propertyData.features.area_m2 === null) missingFields.push('area_m2');
   // ... other critical fields
   ```
2. **Triggering Alerts:** If `missingFields.length > 0`, the property's `verification_status` is set to `HUMAN_ACTION_REQUIRED`. The backend will then dispatch a notification to the operator via:
   * **WhatsApp / Slack Webhook:** A message structured like: *"🚨 Missing Data Alert! Project 'Neo Residence' (Cabo Branco) was ingested but is missing [Price, Area]. Please call Massai (Developer) to verify. Click here to resolve: [Link to Action Center]"*
3. **Queue Prioritization:** The backend can also append tasks to the existing `task_sessions` collection with a specialized intent (e.g., `MANUAL_FOLLOWUP`), tracking when alerts were sent and when they are resolved.

### Frontend UI: The "Action Center"
The React Admin dashboard will be updated to include an "Action Center" (or "Inbox") specifically designed for resolving flagged properties.

1. **New Tab:** Implement a new `Action Center` tab, retrieving properties where `verification_status === 'HUMAN_ACTION_REQUIRED'`.
2. **Task-Oriented UI:** Instead of a generic grid, the Action Center will list tasks sequentially:
   * **Title/Context:** "Neo Residence - Missing Price and Delivery Date."
   * **Source Links:** Direct link to the originally scraped URL or screenshot base64 provided by the scraper for context.
   * **Input Form:** A small, specific form allowing the human operator to manually input the missing values.
3. **Merge Mechanism:** Upon submitting the missing data:
   * The React app sends a targeted update to Firestore.
   * The property's `verification_status` updates to `RESOLVED`.
   * A new `PropertySnapshot` is created representing the complete dataset (e.g., `source: 'human_operator'`).
   * The property becomes fully active in the main Catalog and Mapping analytics.