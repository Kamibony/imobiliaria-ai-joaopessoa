1. **Update `backend/src/index.ts`**
   - Import `defineSecret` from `firebase-functions/params`.
   - Define `apiSecret = defineSecret("API_SECRET");`.
   - Update `verifyAuth` to use `apiSecret.value()` instead of `process.env.API_SECRET` when checking. (Wait, what about `WEBHOOK_SECRET`? I will leave `WEBHOOK_SECRET` as is, or maybe checking `process.env.API_SECRET` is replaced by `apiSecret.value()`). Let's keep `process.env.WEBHOOK_SECRET` but replace `process.env.API_SECRET` with `apiSecret.value()`.
   - Update `onRequest` options to include `secrets: [apiSecret]` across all HTTP functions:
     - `ingestPropertyData`
     - `filterDiscoveredUrls`
     - `dispatchScrapingMission`
     - `addDiscoveredUrls`
     - `getDiscoverySources`
     - `processTriageAction`
     - `reportDetectedChange`
     - `getTargetUrls`
     - `whatsappWebhook`

2. **Update `.github/workflows/deploy.yml`**
   - Remove the `Configure backend environment secrets` step which manually echoes `API_SECRET` to `.env`.

3. Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.

4. Submit the changes.
