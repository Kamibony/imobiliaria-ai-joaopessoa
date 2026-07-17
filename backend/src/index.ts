import { defineSecret } from "firebase-functions/params";
import { onRequest } from "firebase-functions/v2/https";
import { onObjectFinalized } from "firebase-functions/v2/storage";
import * as admin from "firebase-admin";
import { VertexAI } from "@google-cloud/vertexai";
import { PropertySchema } from "./schema";
import { fuzzyMatchNeighborhood } from "./utils";
import cors = require("cors");

admin.initializeApp();

const apiSecret = defineSecret("API_SECRET");

const corsHandler = cors({ origin: true });
const db = admin.firestore();


let vertexAiInstance: VertexAI | null = null;
function getVertexAi() {
  if (!vertexAiInstance) {
    vertexAiInstance = new VertexAI({ project: process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT, location: 'us-central1' });
  }
  return vertexAiInstance;
}

export const ingestPdf = onObjectFinalized({
  timeoutSeconds: 300,
}, async (event) => {
  const fileBucket = event.data.bucket;
  const filePath = event.data.name;

  if (!filePath.startsWith("b2b_pdfs/") || !filePath.toLowerCase().endsWith(".pdf")) {
    console.log("File is not a PDF in b2b_pdfs directory. Ignoring.", filePath);
    return;
  }

  console.log(`Processing PDF: gs://${fileBucket}/${filePath}`);
  const gsUri = `gs://${fileBucket}/${filePath}`;

  try {
    const prompt = `
      Leia este Book e Tabela de Preços imobiliários e extraia as unidades disponíveis.
      O documento é de João Pessoa (bairros como Cabo Branco, Tambaú, Bessa).

      Retorne estritamente um array JSON contendo objetos de imóveis/unidades que se encaixem no seguinte modelo.
      Para propriedades com múltiplas unidades (ex: apartamentos em um prédio), retorne um array com um objeto para cada unidade extraída.
      Se for um único imóvel, retorne um array com um único objeto.

      Formato de saída esperado (Array de objetos):
      [
        {
          "id": "identificador_unico_opcional",
          "basic_info": {
            "title": "nome do empreendimento / unidade",
            "developer": "nome da construtora",
            "delivery_date": "data de entrega ISO 8601 ou null"
          },
          "location": {
            "neighborhood": "Cabo Branco", // Ou "Tambau", ou "Bessa"
            "position_to_sea": "beira_mar", // Ou "quadra_mar", ou "miolo"
            "distance_to_beach_meters": 100, // numero ou null
            "coordinates": {
              "lat": null,
              "lng": null
            }
          },
          "features": {
            "area_m2": 85.5, // área privativa em m2 (numero) ou null
            "sun_orientation": "nascente", // Ou "nascente_sul", "sul", "poente"
            "bedrooms": 3 // numero ou null
          },
          "snapshots": [
            {
              "timestamp": "2024-05-20T12:00:00Z", // data atual
              "price_brl": 850000, // valor total (numero) ou null
              "status": "na_planta", // Ou "em_construcao", "pronto",
              "source": "book_pdf"
            }
          ],
          "ai_context": {
            "target_persona": {
              "pt-BR": ["Investidores", "Famílias"],
              "en": ["Investors", "Families"]
            },
            "investment_roi_estimated_percent": 15, // numero ou null
            "local_advantage": {
              "pt-BR": "Excelente localização perto da praia.",
              "en": "Excellent location near the beach."
            }
          }
        }
      ]

      Diretrizes:
      1. Retorne APENAS o JSON puro. Sem formatação markdown (` + "```json" + `).
      2. Defina os campos numéricos (preço, área, quartos) estritamente como nulo (null) se não encontrar a informação. NUNCA use 0 para dados ausentes.
      3. Extraia o "empreendimento" para basic_info.title, "construtora" para basic_info.developer.
      4. Extraia as unidades para features.area_m2 e snapshots[0].price_brl.
      5. "source" no snapshot deve ser "${filePath}".
    `;

    const generativeModel = getVertexAi().getGenerativeModel({ model: "gemini-2.5-flash" });

    const result = await generativeModel.generateContent({
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          {
            fileData: {
              mimeType: "application/pdf",
              fileUri: gsUri
            }
          }
        ]
      }],
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!responseText) {
      console.error("No response text from Gemini.");
      throw new Error("Failed to extract data");
    }

    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error("No JSON array found in response:", responseText);
      throw new Error("No JSON array found");
    }

    const sanitizedText = jsonMatch[0];
    let extractedUnits;

    try {
      extractedUnits = JSON.parse(sanitizedText);
    } catch (parseError) {
      console.error("Failed to parse Gemini response as JSON.", sanitizedText);
      throw new Error("Invalid JSON");
    }

    if (!Array.isArray(extractedUnits)) {
       console.error("Expected array of units, got something else.");
       throw new Error("Invalid JSON format from LLM");
    }

    for (const unit of extractedUnits) {
      // Validate using Zod schema
      const validationResult = PropertySchema.safeParse(unit);
      if (!validationResult.success) {
        console.error("Schema validation failed for a unit:", validationResult.error);
        continue; // Skip invalid units
      }

      let propertyData = validationResult.data as any;

      // Deterministically calculate price_per_m2_brl
      if (propertyData.features?.area_m2 && propertyData.snapshots && propertyData.snapshots.length > 0) {
          const snapshot = propertyData.snapshots[0];
          if (snapshot.price_brl) {
             snapshot.price_per_m2_brl = Math.round(snapshot.price_brl / propertyData.features.area_m2);
          } else {
             snapshot.price_per_m2_brl = null;
          }
      }

      // Convert string dates to Date objects
      if (propertyData.basic_info?.delivery_date) {
        propertyData.basic_info.delivery_date = new Date(propertyData.basic_info.delivery_date);
      }

      if (propertyData.snapshots && Array.isArray(propertyData.snapshots)) {
        propertyData.snapshots.forEach((snap: any) => {
          if (snap.timestamp) {
            snap.timestamp = new Date(snap.timestamp);
          } else {
            snap.timestamp = new Date();
          }
          if (!snap.source || snap.source === "book_pdf") {
            snap.source = filePath;
          }
        });
      }

      const propertyId = propertyData.id || db.collection("properties").doc().id;
      propertyData.id = propertyId;

      // Coordinate Fallback Logic
      propertyData.needs_geocoding = false;
      if (propertyData.location) {
        if (propertyData.location.coordinates?.lat == null || propertyData.location.coordinates?.lng == null) {
          propertyData.needs_geocoding = true;
          const fuzzyNeighborhood = fuzzyMatchNeighborhood(propertyData.location.neighborhood);

          // Ensure coordinates object exists
          propertyData.location.coordinates = { lat: null, lng: null };

          if (fuzzyNeighborhood === 'Cabo Branco') {
            propertyData.location.coordinates.lat = -7.1354;
            propertyData.location.coordinates.lng = -34.8210;
          } else if (fuzzyNeighborhood === 'Tambau') {
            propertyData.location.coordinates.lat = -7.1165;
            propertyData.location.coordinates.lng = -34.8228;
          } else if (fuzzyNeighborhood === 'Bessa') {
            propertyData.location.coordinates.lat = -7.0658;
            propertyData.location.coordinates.lng = -34.8322;
          } else {
             propertyData.location.coordinates.lat = -7.1150;
             propertyData.location.coordinates.lng = -34.8630;
          }
        }
      }

      const docRef = db.collection("properties").doc(propertyId);

      await db.runTransaction(async (transaction) => {
          const docSnap = await transaction.get(docRef);
          if (docSnap.exists) {
              const newSnapshots = propertyData.snapshots || [];
              const existingData = docSnap.data();
              const existingSnapshots = existingData?.snapshots || [];
              const mergedSnapshots = [...existingSnapshots, ...newSnapshots];

              const { snapshots, ...otherData } = propertyData;
              transaction.set(docRef, { ...otherData, snapshots: mergedSnapshots }, { merge: true });
          } else {
              transaction.set(docRef, propertyData);
          }
      });
      console.log(`Successfully processed PDF unit and saved property ${propertyId}`);
    }

  } catch (error) {
    console.error("Error processing PDF:", error);
    throw error;
  }
});


// Keep whatsappWebhook for WhatsApp concierge multi-agent logic
export const whatsappWebhook = onRequest({ secrets: [apiSecret] }, (request, response) => {
  corsHandler(request, response, async () => {
  if (request.method === 'GET') {
    const mode = request.query['hub.mode'];
    const token = request.query['hub.verify_token'];
    const challenge = request.query['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      response.status(200).send(challenge);
    } else {
      response.sendStatus(403);
    }
    return;
  }

  if (request.method === 'POST') {
    try {
      const body = request.body;
      if (body.object) {
        if (body.entry && body.entry[0].changes && body.entry[0].changes[0] && body.entry[0].changes[0].value.messages && body.entry[0].changes[0].value.messages[0]) {
          const message = body.entry[0].changes[0].value.messages[0];
          const from = message.from;
          const text = message.text?.body;

          if (text) {
            const intentPrompt = `
              Analyze the following WhatsApp message from a real estate context.
              Determine the user's intent. Return ONLY "INGESTION" se for para ingestão de dados,
              ou ONLY "INQUIRY" se for pergunta sobre o catálogo.

              Message: "${text}"
            `;

            const routerModel = getVertexAi().getGenerativeModel({ model: "gemini-2.5-flash" });
            const routerResult = await routerModel.generateContent({
              contents: [{ role: 'user', parts: [{ text: intentPrompt }] }],
            });
            const intent = routerResult.response.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toUpperCase();

            if (intent === 'INGESTION') {
              console.log(`WhatsApp INGESTION detected for ${from}`);
            } else {
              const ragPrompt = `
                You are a helpful Real Estate Concierge for João Pessoa (Cabo Branco, Tambaú, Bessa).
                Answer the user's question concisely in Brazilian Portuguese.

                User question: "${text}"
              `;
              const ragModel = getVertexAi().getGenerativeModel({ model: "gemini-2.5-flash" });
              const ragResult = await ragModel.generateContent({
                contents: [{ role: 'user', parts: [{ text: ragPrompt }] }],
              });
              const replyText = ragResult.response.candidates?.[0]?.content?.parts?.[0]?.text;
              console.log(`Sending WhatsApp reply to ${from}: "${replyText}"`);
            }
          }
        }
        response.sendStatus(200);
      } else {
        response.sendStatus(404);
      }
    } catch (error) {
      console.error("Error processing WhatsApp webhook:", error);
      response.sendStatus(500);
    }
  }
  });
});
