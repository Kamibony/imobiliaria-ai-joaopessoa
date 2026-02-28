import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { VertexAI } from "@google-cloud/vertexai";
import { Property } from "./types/property";

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();

// Initialize Vertex AI
const project = process.env.GCLOUD_PROJECT || "imobiliaria-ai-joaopessoa";
const location = "us-central1"; // Assuming us-central1 for Vertex AI
const vertexAi = new VertexAI({ project, location });
const generativeModel = vertexAi.getGenerativeModel({
  model: "gemini-1.5-pro",
});

// Empty HTTP Cloud Function serving as webhook for incoming market data
export const ingestPropertyData = onRequest(async (request, response) => {
  // Require Bearer token in authorization header
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    response.status(401).send("Unauthorized");
    return;
  }
  const token = authHeader.split("Bearer ")[1];
  // Normally you would verify the token here, but for this exercise we just require it
  if (!token) {
    response.status(401).send("Unauthorized");
    return;
  }

  try {
    const payload = request.body;
    let dataToParse = "";

    if (typeof payload === "string") {
      dataToParse = payload;
    } else if (typeof payload === "object") {
      dataToParse = JSON.stringify(payload);
    } else {
      response.status(400).send("Invalid payload format. Expected string or JSON.");
      return;
    }

    const prompt = `
      You are an expert real estate data extractor for the Cabo Branco and Tambaú market in João Pessoa.
      Extract the provided data and return a strict JSON object that perfectly matches the following TypeScript interface:

      export interface Property {
        id: string; // unique identifier
        basic_info: {
          title: string;
          developer: string;
          status: 'na_planta' | 'em_construcao' | 'pronto';
          delivery_date: string; // ISO 8601 date string
        };
        location: {
          neighborhood: 'Cabo Branco' | 'Tambau';
          position_to_sea: 'beira_mar' | 'quadra_mar' | 'miolo';
          distance_to_beach_meters: number;
          coordinates: {
            lat: number;
            lng: number;
          };
        };
        features: {
          area_m2: number;
          sun_orientation: 'nascente' | 'nascente_sul' | 'sul' | 'poente';
          bedrooms: number;
        };
        financials: {
          price_brl: number;
          price_per_m2_brl: number;
        };
        ai_context: {
          target_persona: string[];
          investment_roi_estimated_percent: number;
          local_advantage: string; // System prompt context for Gemini
        };
      }

      Return ONLY the valid JSON object, without any markdown formatting, code blocks, or explanations.
      Ensure the output is parseable by JSON.parse().

      Data to extract:
      ${dataToParse}
    `;

    const result = await generativeModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!responseText) {
      console.error("No response text from Gemini");
      response.status(500).send("Failed to parse data");
      return;
    }

    // Parse the JSON string into an object
    const propertyData = JSON.parse(responseText) as Property;

    // The interface delivery_date is a Date, but Gemini will return a string.
    // Convert it to a Firestore Timestamp or Date object.
    if (propertyData.basic_info && propertyData.basic_info.delivery_date) {
      propertyData.basic_info.delivery_date = new Date(propertyData.basic_info.delivery_date);
    }

    // Save to Firestore
    const propertyId = propertyData.id || db.collection("properties").doc().id;
    propertyData.id = propertyId; // Ensure ID is set in the data

    await db.collection("properties").doc(propertyId).set(propertyData);

    response.status(200).send({
      message: "Data successfully ingested and saved to Firestore",
      propertyId: propertyId,
    });
  } catch (error) {
    console.error("Error ingesting property data:", error);
    response.status(500).send("Internal Server Error");
  }
});
