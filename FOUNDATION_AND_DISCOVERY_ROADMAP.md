# Architectural Blueprint: AI-Driven Discovery & HITL Update Loop

## 1. The Input & Discovery Layer

To build a continuous and autonomous pipeline for uncovering new real estate data, the architecture must accommodate high-level instructions ("Sources") from human operators, which the AI Spider then continuously explores.

### Frontend "Source Feed" Interface
* **Source Registry Tab:** The React Admin dashboard will introduce a new section for managing "Data Sources" (distinct from the final "Target URLs").
* **Supported Source Types:** The UI will accept diverse inputs:
  * **Root Domains:** e.g., `https://massai.com.br/imoveis`
  * **Social Media Profiles:** e.g., `instagram.com/construtoraX` (handled via specific API integrations or headless browser automation)
  * **Unstructured Tips (Text):** e.g., *"Look for a new launch called 'Oceana' in Cabo Branco by developer Y."*
* **Database Representation:** These inputs are saved to a new Firestore collection `DiscoverySources`, tracking the source string, type, last monitored timestamp, and monitoring frequency (e.g., daily, weekly).

### Autonomous Spider Monitoring
* **Scheduled Discovery Jobs:** The Python Spider (via GitHub Actions CRON) fetches active entries from `DiscoverySources`.
* **Exploratory Crawling:** Instead of deep extraction, the spider performs a shallow "link extraction" crawl on the source.
* **LLM Filtering (The Gatekeeper):** The extracted raw links and text snippets are sent to a new Cloud Function (`analyzeDiscoverySource`). This function uses Gemini to evaluate the links based on unstructured text tips or general real estate patterns, returning an array of *potentially* new project URLs that match the platform's criteria (Cabo Branco/Tambaú, premium).

## 2. The Change-Detection Engine (Temporal Memory)

Deep extraction is computationally expensive (LLM tokens) and slow. The system should only perform deep extraction when a previously scraped page has fundamentally changed.

### Architecture for Temporal Memory
* **Content Hashing:** The Python scraper will compute a cryptographic hash (e.g., SHA-256) of the **cleaned, extracted text** (the payload *after* stripping noise like headers and footers, but *before* sending to Gemini).
* **Metadata Hashing:** Alternatively, hashing specifically structural metadata (like `<meta property="og:price:amount">` or specific div contents if predictable).
* **Firestore Schema Update:** The `TargetURLs` collection will be updated to track these temporal signatures:
  ```typescript
  interface TargetURL {
    url: string;
    last_scraped_at: Date;
    last_content_hash: string;
    status: 'ACTIVE' | 'ARCHIVED';
  }
  ```

### The Diffing Loop
1. The scheduled spider visits a known URL from `TargetURLs`.
2. It extracts and cleans the text, calculating the new hash.
3. It compares the new hash against `last_content_hash`.
4. **If hashes match:** The system logs "No Change" and moves on, saving LLM costs.
5. **If hashes differ:** A significant change has occurred (e.g., price update, status change from 'Na Planta' to 'Pronto', or structural site update). The spider packages this URL for the HITL Triage Center rather than immediately overwriting existing data.

## 3. The HITL Triage Center

Both the Discovery Layer (new URLs) and the Change-Detection Engine (updated URLs) funnel their outputs into a centralized queue for human review before any permanent changes are made to the core property catalog.

### Triaging in the React Frontend
* **The "Review Inbox" UI:** The frontend implements an inbox-style interface displaying items needing attention.
* **Two Queues:**
  * **Queue A: New Discoveries:** "The AI found 3 new URLs on massai.com.br. Are these valid projects?" The operator can click a "Queue for Deep Extraction" button or "Discard".
  * **Queue B: Detected Changes:** "The page for 'Neo Residence' has changed significantly since last week. Review the diff."
* **Reviewing Changes (Diff Viewer):** For Queue B, the UI provides a side-by-side or simplified "Diff" view, allowing the human to see *why* the hash changed.
  * The system can optionally run a lightweight LLM prompt to summarize the change for the human: *"The AI suspects the price changed from R$ 1.5M to R$ 1.6M."*
* **Action Routing:**
  * If the human confirms a discovery, the URL is promoted to the `TargetURLs` collection and dispatched to the Cloud Tasks queue for immediate deep extraction via `ingestPropertyData`.
  * If the human confirms a change on an existing page, a new `PropertySnapshot` extraction is triggered to append the new temporal data to the property's history.