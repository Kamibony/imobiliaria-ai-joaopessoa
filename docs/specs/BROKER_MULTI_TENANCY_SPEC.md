# Broker Multi-Tenancy Specification

## Overview
We are pivoting the platform from a generic B2C catalog into a B2B "White-label SaaS" for autonomous real estate brokers. Brokers will share a personalized link (e.g., `?ref=broker-slug`). The platform will then dynamically adapt to show their name, photo, and CRECI. All contact buttons and the AI Concierge must route to the specific broker's WhatsApp.

## 1. Data Layer
A new `brokers` collection will be created in Firestore.

**Schema (`brokers` collection):**
- `slug` (String, Primary Key/Document ID)
- `name` (String)
- `creci` (String)
- `whatsapp` (String, format: E.164 without '+')
- `photo_url` (String, optional)

**Seed Script Concept:**
To facilitate easy demo generation and development, we will create a temporary seed script (e.g., a Firebase HTTP Cloud Function using `onRequest` in `backend/src/index.ts` as per architectural guidelines) that populates the `brokers` collection with dummy data (e.g., a "demo-broker"). The JSON schema `schemas/schema.json` will also be updated to include the `Broker` entity definition.

## 2. State Management
We will introduce a React Context to manage the active broker's state.

**Capturing the `?ref` Parameter:**
A higher-order component or a custom hook (e.g., `useBrokerState`) will inspect the URL search parameters (`window.location.search`) for the `ref` key on the initial page load.

**Fetching and Persisting:**
- If `?ref` is present, fetch the broker document from Firestore using the `slug`.
- Persist the fetched broker data into `sessionStorage` so that the user's session remains white-labeled as they navigate the site, even if the URL parameter is lost.
- If no `?ref` is present, check `sessionStorage` for a previously stored broker.
- Fallback to a default generic state if no broker is active.

**Proposed Files:**
- **New:** `frontend/src/BrokerContext.jsx` (or similar) to provide the broker state globally.

## 3. UI Layer Updates
The UI must dynamically adapt based on the active broker context.

**Navbar Branding:**
- If a broker is active, the Navbar should display the broker's `name`, `photo_url` (if available), and `creci` alongside or replacing the default branding.

**WhatsApp CTA Buttons:**
- All "Contact via WhatsApp" buttons across the site (e.g., in project details, global CTA) must use the active broker's `whatsapp` number to route the message correctly.
- Fallback to the default company WhatsApp if no broker is active.

**Visual Markers:**
- Add subtle visual indicators in the footer or side drawers indicating "Powered by [Platform Name] - Agent: [Broker Name]".

**Files to Modify:**
- Main layout components containing the Navbar.
- Contact and WhatsApp CTA buttons components.
- Project detail pages and any other views containing contact buttons.

## 4. AI Layer Updates
The AI Concierge must be aware of the active broker to accurately represent them.

**System Prompt Injection:**
- When the frontend calls the AI Concierge backend endpoint, it must pass the active broker's context (Name, CRECI, Phone).
- The `getConciergeSystemPrompt` helper function (in `backend/src/index.ts`) will be updated to accept broker details and dynamically inject them into the system instruction (e.g., "You are the AI assistant for {Broker Name}, CRECI: {CRECI}. Direct all final inquiries to {Phone}.").

**Files to Modify:**
- `backend/src/index.ts` (update `getConciergeSystemPrompt` and the concierge HTTP endpoint)
- `frontend/src/ConciergeContext.jsx` (pass broker context to the backend)

## Summary of Changes

### New Files:
- `docs/specs/BROKER_MULTI_TENANCY_SPEC.md`
- `frontend/src/BrokerContext.jsx` (or equivalent context file)

### Modified Files:
- `backend/src/index.ts`
- `frontend/src/main.jsx` (to wrap the app with the new Provider)
- `frontend/src/ConciergeContext.jsx`
- Frontend UI components (Navbar, CTA buttons, Layouts as needed)
- `schemas/schema.json` (to define the new `Broker` entity)