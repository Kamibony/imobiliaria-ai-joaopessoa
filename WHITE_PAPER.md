# Imobiliária AI: Project White Paper & Architecture Document

## 1. Executive Summary

Imobiliária AI is a highly specialized, AI-driven PropTech platform designed to act as an intelligent, conversational real estate concierge. The primary goal of this system is to serve out-of-state investors (such as those from São Paulo) by providing expert-level, hyper-local insights into the premium real estate market of João Pessoa, Brazil—with an exclusive focus on the coastal neighborhoods of **Cabo Branco** and **Tambaú**.

By leveraging Retrieval-Augmented Generation (RAG) and generative AI, the platform translates unstructured market data (such as developer websites, PDFs, and WhatsApp messages) into structured, actionable intelligence. It educates investors on local nuances like sun orientation and building height laws, offering highly personalized property recommendations and automated financial insights.

---

## 2. System Architecture (The 3 Pillars)

The system is constructed across three decoupled pillars, ensuring scalability, robust data extraction, and a dynamic user experience.

### Pillar 1: Data Acquisition (Python/Playwright via GitHub Actions)
The data collection layer acts as a target-agnostic "dumb" microservice. It is designed to autonomously fetch unstructured content from various real estate sources.
* **Target-Agnostic Approach & Anti-Bot Evasion:** By specifically targeting local developer websites rather than massive aggregators, the scraper successfully bypasses aggressive anti-bot protections like Cloudflare.
* **Pre-Extraction DOM Cleaning:** Built with Playwright, the scraper navigates to the target URL and executes a DOM manipulation script to strip away noisy elements (`<header>`, `<footer>`, `<nav>`, `<script>`, `<style>`). It prioritizes the `<main>` tag over `<body>`, significantly reducing the token count and noise sent to the LLM.
* **Timeout Strategy:** The data ingestion process employs a robust 120s timeout strategy for LLM processing, ensuring that complex scraping and AI parsing tasks have sufficient time to complete without silently failing.

### Pillar 2: AI Processing Pipeline (Firebase Cloud Functions + Vertex AI)
The AI Orchestrator receives raw text and converts it into structured, strictly typed property entities.
* **Model Configuration:** Powered by the Google Vertex AI SDK using the `gemini-2.5-flash` model (optimized for speed and supported in the target deployment region).
* **"Forgiving Schema" Strategy:** The prompt engineering utilizes a forgiving schema. When specific brochure data (like prices, area, or delivery date) is missing from the raw text, the AI is instructed to assign `null` (or `0` for numbers) rather than hallucinating or injecting conversational text.
* **Robust JSON Extraction:** To prevent `JSON.parse` 500 errors caused by unexpected markdown or conversational prefixes from the LLM, the backend applies a strict regular expression extraction logic (`/\{[\s\S]*\}/`) to guarantee that only valid JSON payloads are processed.

### Pillar 3: Frontend Dashboard (React/Vite)
The client interface is a modern Single Page Application (SPA) providing an Admin Dashboard experience in Brazilian Portuguese (pt-BR).
* **Expandable Property Cards & "AI Insights":** The dashboard presents properties in a grid of expandable cards. The "AI Insights" section visually highlights generative data, including **ROI badges**, **Target Persona** pill tags, and **Local Advantage** callouts.
* **Smart State-Based Filtering:** Users can filter the property catalog seamlessly based on Neighborhood (e.g., Cabo Branco vs. Tambaú) and Construction Status (e.g., Na Planta, Em Construção, Pronto).
* **Dynamic Mapping & Analytics:** The dashboard integrates a dynamic `Leaflet` map featuring status-based, color-coded markers for geographical visualization. Additionally, `Recharts` is used to visualize analytics, such as the average price per square meter per neighborhood.

---

## 3. Data Model

The platform uses Firestore for structured data storage, employing an event-sourced "Time Machine" architectural pattern to track historical market changes.

* **Property (Static Data):** The central entity (`Property`) stores immutable or rarely changing physical traits, such as title, developer, delivery date, neighborhood, area, and sun orientation.
* **PropertySnapshot (Time-Series Data):** Dynamic, time-sensitive attributes—most importantly **price** and **status**—are separated into a `PropertySnapshot` array nested within the property document. Every time a property is re-ingested or updated, a new snapshot is appended, allowing the system to track pricing trends and calculate investment ROI over time without losing historical context.

---

## 4. Deployment & DevOps Workflow

The project utilizes a decoupled CI/CD strategy powered by GitHub Actions, ensuring that backend/frontend deployments are completely separate from the scheduled data scraping tasks.

* **Application Deployment (`deploy.yml`):** The React frontend and Firebase Cloud Functions backend are continuously integrated and deployed to Firebase upon code changes to the `main` branch. This workflow utilizes Google Cloud Workload Identity Federation for keyless, secure authentication.
* **Automated Scraper Operations (`run-scraper.yml`):** The Python data acquisition scraper operates independently. It runs on a scheduled CRON job (daily at 06:00 UTC) via GitHub Actions, dynamically fetching target URLs from the backend and submitting the cleaned raw text back to the secure webhook endpoint.
