import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { VertexAI } from "@google-cloud/vertexai";

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

      export interface PropertySnapshot {
        timestamp: string; // ISO 8601 date string
        price_brl: number;
        price_per_m2_brl: number;
        status: 'na_planta' | 'em_construcao' | 'pronto';
        source: string; // E.g., 'admin_upload', 'scraper'
      }

      export interface Property {
        id: string; // unique identifier
        basic_info: {
          title: string;
          developer: string;
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
        snapshots: PropertySnapshot[]; // Must contain exactly one snapshot with the extracted status and financials
        ai_context: {
          target_persona: string[]; // MUST be generated exclusively in Brazilian Portuguese (pt-BR)
          investment_roi_estimated_percent: number;
          local_advantage: string; // System prompt context for Gemini. MUST be generated exclusively in Brazilian Portuguese (pt-BR)
        };
      }

      Return ONLY the valid JSON object, without any markdown formatting, code blocks, or explanations.
      Ensure the output is parseable by JSON.parse().
      IMPORTANT: The fields ai_context.target_persona and ai_context.local_advantage MUST be generated exclusively in Brazilian Portuguese (pt-BR).

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
    const propertyData = JSON.parse(responseText) as any;

    // The interface delivery_date and timestamp are Dates, but Gemini will return a string.
    // Convert them to Date objects.
    if (propertyData.basic_info && propertyData.basic_info.delivery_date) {
      propertyData.basic_info.delivery_date = new Date(propertyData.basic_info.delivery_date);
    }

    if (propertyData.snapshots && Array.isArray(propertyData.snapshots)) {
      propertyData.snapshots.forEach((snap: any) => {
        if (snap.timestamp) {
          snap.timestamp = new Date(snap.timestamp);
        } else {
          snap.timestamp = new Date(); // Fallback to current time
        }
        if (!snap.source) {
          snap.source = 'admin_upload'; // Default source
        }
      });
    }

    // Determine property ID
    const propertyId = propertyData.id || db.collection("properties").doc().id;
    propertyData.id = propertyId;

    const docRef = db.collection("properties").doc(propertyId);
    const docSnap = await docRef.get();

    if (docSnap.exists) {
      // Append the new snapshot to existing ones
      const newSnapshots = propertyData.snapshots || [];
      await docRef.update({
        snapshots: admin.firestore.FieldValue.arrayUnion(...newSnapshots)
      });
      // Update other fields as well (using merge)
      // Exclude snapshots from set to avoid overwriting all existing snapshots
      const { snapshots, ...otherData } = propertyData;
      await docRef.set(otherData, { merge: true });
    } else {
      // Create new document
      await docRef.set(propertyData);
    }

    response.status(200).send({
      message: "Data successfully ingested and saved to Firestore",
      propertyId: propertyId,
    });
  } catch (error) {
    console.error("Error ingesting property data:", error);
    response.status(500).send("Internal Server Error");
  }
});
