import * as functions from "firebase-functions";
// import { Property } from "./types/property";

// Empty HTTP Cloud Function serving as webhook for incoming market data
export const ingestPropertyData = functions.https.onRequest(async (request, response) => {
  // TODO: Implement ingestion logic
  response.status(200).send("Webhook received");
});
