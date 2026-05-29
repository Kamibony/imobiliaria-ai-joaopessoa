# Architectural Proposal: Remediation & System Evolution

## 1. Remediation Strategy (Bugfixes)

This section outlines the architectural approach to resolving the critical issues identified in the system audit. The focus is on establishing long-term resilience, defensive programming patterns, and preventing silent failures.

### 1.1 Scraper Timeout Resolution
**The Problem:** The Python scraper and backend Cloud Functions (`ingestPropertyData`) encounter timeouts when processing data through the Vertex AI/Gemini LLM pipeline, as model inference can take longer than default HTTP request limits.
**The Solution:**
- **Asynchronous Processing / Queueing:** Instead of a synchronous HTTP request blocking until the LLM returns, the webhook should acknowledge receipt immediately (HTTP 202 Accepted) and enqueue the raw text payload into Google Cloud Tasks or Firebase Pub/Sub.
- **Backend Execution:** A separate worker Cloud Function, configured with a minimum of 120-180 seconds timeout, processes the queued item, interacts with Vertex AI, and updates Firestore.
- **Scraper Resilience:** The scraper will not hang waiting for a response and can proceed to the next URL, significantly increasing crawl throughput.
- **Retry Mechanism:** Cloud Tasks provides built-in exponential backoff and retry mechanisms for transient LLM API errors (e.g., 503, 429).

### 1.2 Frontend 'White Screen of Death' (LLM Structural Mismatches)
**The Problem:** The React frontend crashes when attempting to render properties where the LLM generated strings instead of arrays (e.g., `snapshots`, `target_persona`, `local_advantage`).
**The Solution:**
- **Strict Data Validation at Ingestion:** Introduce a Zod or Yup schema validation layer in the backend *after* the LLM response is parsed. If the LLM output violates the expected schema (e.g., string instead of array), the backend will attempt basic coercion (wrapping string in an array) or reject/flag the document for manual review, ensuring malformed data never enters the production `properties` collection.
- **Defensive Frontend Components:** Implement strict type checking in React components before rendering. Use optional chaining (`?.`) and explicit array checks (`Array.isArray(property.target_persona) ? property.target_persona.map(...) : []`).
- **Error Boundaries:** Wrap individual property cards and critical UI sections in React Error Boundaries. If a single property component throws an error, it will render a fallback "Data Unavailable" UI instead of crashing the entire application.

### 1.3 Brittle Coordinate Fallback
**The Problem:** The fallback mechanism for assigning latitude and longitude based on the `neighborhood` string fails due to case variations, missing accents, or slight misspellings in the LLM output.
**The Solution:**
- **String Normalization:** Implement a rigorous normalization function in the backend before coordinate assignment (e.g., `normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()`).
- **Fuzzy Matching Strategy:** Utilize a string similarity algorithm (like Levenshtein distance) to match the LLM-provided neighborhood against our known list of coastal neighborhoods (Cabo Branco, Tambaú, Bessa).
- **Graceful Degradation:** If the neighborhood falls below the confidence threshold, assign the property to a default central coordinate for João Pessoa but flag the document with a `needs_geocoding` boolean for future manual or asynchronous correction.

---

## 2. System Evolution & Improvements (The Roadmap)

This section details the architectural designs for the planned evolution of the platform into a highly autonomous, robust PropTech system.

### 2.1 Multi-Agent WhatsApp Concierge
**Architecture:**
- **Webhook Gateway:** Implement a single Cloud Function acting as a webhook endpoint for the WhatsApp Business API.
- **Intent Router:** An initial lightweight LLM agent analyzes incoming messages to determine intent (Ingestion vs. Inquiry).
- **Ingestion Agent (Broker Facing):**
  - Triggered when unstructured property details, images, or audio notes are forwarded by brokers.
  - Extracts property details, invokes the existing LLM parsing pipeline, and drafts a new `PropertySnapshot`.
  - Replies with a summary and a confirmation link for the broker to approve the listing.
- **Client-Facing Agent (AEO Optimized):**
  - Triggered by potential buyers.
  - Uses RAG (Retrieval-Augmented Generation) querying our Pinecone Vector Database and Firestore.
  - Generates Answer Engine Optimized (AEO) responses, focusing on direct, concise, and highly relevant answers regarding ROI, property specs, and local advantages.

### 2.2 Semantic Self-Healing Scraper
**Architecture:**
- **Shift from DOM-Path to Semantic Extraction:** Move away from hardcoded CSS selectors or XPath which break on minor site updates.
- **Visual & Semantic DOM Reduction:** The Playwright scraper will utilize a generic reduction algorithm to strip out `<nav>`, `<footer>`, `<aside>`, `<script>`, and `<style>` tags. It will focus on extracting text from `<main>`, `<article>`, or semantically dense `<div>` tags.
- **LLM-Driven Heuristics:** Send the raw, cleaned DOM text directly to the Gemini LLM pipeline. The prompt will be designed to act as the primary data extractor, locating price, area, bedrooms, etc., purely from semantic context rather than structural location.
- **Fallback Page Snapshotting:** If the LLM extraction fails (returns empty required fields), the scraper will capture a full-page screenshot and send it to a multimodal LLM (Gemini 1.5 Pro Vision) as a fallback mechanism for extraction.

### 2.3 Multilingual Data Layer
**Architecture:**
- **Schema Extension:** Update the Firestore `Property` and `PropertySnapshot` schemas to support nested localization objects for generative fields. For example:
  ```json
  {
    "target_persona": {
      "pt-BR": ["Família", "Investidor"],
      "en": ["Family", "Investor"]
    },
    "local_advantage": {
      "pt-BR": "Próximo à praia.",
      "en": "Close to the beach."
    }
  }
  ```
- **Parallel Synthesis at Ingestion:** Update the `ingestPropertyData` prompt to require the LLM to output these specific fields in both `pt-BR` and `en` simultaneously within the JSON structure, avoiding multiple LLM calls.
- **Frontend Localization Context:** Implement a React Context provider for internationalization (i18n). The user interface will toggle between `pt-BR` (default) and `en`, dynamically pulling the corresponding strings from the nested localization objects on the property data.