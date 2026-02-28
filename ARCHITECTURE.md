# Architecture & System Design: Imobiliária AI (João Pessoa)

## 1. Project Objective
Hyper-local, AI-powered real estate concierge focused exclusively on the premium coastal neighborhoods of Cabo Branco and Tambaú (João Pessoa, Brazil). The system acts as an intelligent, conversational real estate agent. It educates out-of-state investors (e.g., from São Paulo) on local specifics (sun orientation, building height laws) and provides highly personalized property recommendations using RAG (Retrieval-Augmented Generation).

## 2. Tech Stack
* **Frontend:** React + Vite (Single Page Application)
* **Backend:** Firebase Cloud Functions (Node.js / TypeScript)
* **Database (Structured):** Firestore (Properties, Users, Chat Sessions)
* **Database (Vector):** Vertex AI Vector Search / Pinecone (for RAG semantics)
* **Storage:** Firebase Storage (Images, Floor plans, PDFs)
* **AI Engine:** Google Gemini Pro

## 3. Core Architecture Pillars
The system is divided into three main layers:

### A. Data Ingestion & Processing Layer
* **Goal:** Convert unstructured market data (PDF price lists, WhatsApp messages from developers) into structured facts.
* **Flow:** Webhook/Email -> Cloud Function -> Gemini Parsing -> Data Validation -> Firestore & Vector DB update.

### B. AI Orchestrator (The Brain)
* **Goal:** Manage the conversational flow and business logic.
* **Flow:** User Input -> Intent Classification -> RAG (query Firestore/Vector DB) -> Gemini Generation -> Response to Frontend.
* **Smart Triggers:** Automatic ROI calculation and comparative market analysis triggered upon price updates.

### C. Client Interface
* **Goal:** Omnichannel experience.
* **Phase 1:** React Web Application with an integrated AI chat interface and property visualizer.
* **Phase 2:** WhatsApp Business API integration.

## 4. Core Data Model: Property
This is the central entity. All AI logic depends on this strict structure.
*(Jules: Ensure all backend functions adhere to this schema).*

```json
{
  "id": "string (unique identifier)",
  "basic_info": {
    "title": "string",
    "developer": "string",
    "status": "enum: [na_planta, em_construcao, pronto]", 
    "delivery_date": "timestamp"
  },
  "location": {
    "neighborhood": "enum: [Cabo Branco, Tambau]",
    "position_to_sea": "enum: [beira_mar, quadra_mar, miolo]", 
    "distance_to_beach_meters": "number",
    "coordinates": { "lat": "number", "lng": "number" }
  },
  "features": {
    "area_m2": "number",
    "sun_orientation": "enum: [nascente, nascente_sul, sul, poente]", 
    "bedrooms": "number"
  },
  "financials": {
    "price_brl": "number",
    "price_per_m2_brl": "number"
  },
  "ai_context": {
    "target_persona": ["string"],
    "investment_roi_estimated_percent": "number",
    "local_advantage": "string (System prompt context for Gemini)"
  }
}

5. Rules for AI Assistants (Jules)
Read First: Always consult this ARCHITECTURE.md file before proposing architectural changes.

Strict Typing: Use TypeScript for all backend Cloud Functions to ensure data integrity.

No Mocking without asking: Do not generate large mock datasets unless explicitly instructed.

Modular Code: Keep Cloud Functions small and single-purpose. Separate routing, business logic, and database access.
