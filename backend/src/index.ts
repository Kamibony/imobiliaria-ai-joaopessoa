import { defineSecret } from "firebase-functions/params";
import { onRequest } from "firebase-functions/v2/https";
import { onObjectFinalized } from "firebase-functions/v2/storage";
import * as admin from "firebase-admin";
import { VertexAI } from "@google-cloud/vertexai";
import { ProjectSchema, UnitSchema } from "./schema";
import { fuzzyMatchNeighborhood, normalizeProjectName, levenshteinDistance, normalizeString } from "./utils";

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

async function callGeminiWithRetry(generativeModel: any, request: any, maxRetries = 3) {
  const delays = [3000, 6000, 10000]; // 3s, 6s, 10s
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      return await generativeModel.generateContent(request);
    } catch (error: any) {
      const errorMessage = error?.message || '';
      const isRateLimit = errorMessage.includes('429') || errorMessage.includes('Resource Exhausted');
      const isServiceUnavailable = errorMessage.includes('503') || errorMessage.includes('Service Unavailable');

      if ((isRateLimit || isServiceUnavailable) && attempt < maxRetries) {
        const delay = delays[attempt];
        console.warn(`Vertex AI API Error (${isRateLimit ? '429' : '503'}). Retrying in ${delay}ms... (Attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        attempt++;
      } else {
        throw error; // Re-throw if it's not a retryable error or we've exhausted retries
      }
    }
  }
  throw new Error("Failed to generate content after max retries");
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

  // Extract just the filename without the 'b2b_pdfs/' prefix
  const fileName = filePath.split("/").pop();

  if (fileName) {
    try {
      await db.collection("pdf_jobs").doc(fileName).update({
        status: "Processing",
      });
    } catch (e) {
      console.log("Could not update pdf_jobs to Processing, moving on...", e);
    }
  }

  try {
    const projectsSnapshot = await db.collection("projects").get();
    const existingProjects = projectsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        developer: data.developer
      };
    });

    const prompt = `
      Leia este Book e Tabela de Preços imobiliários e extraia os dados do empreendimento e suas unidades.
      O documento é de João Pessoa (bairros como Cabo Branco, Tambaú, Bessa).

      Your Task: Analyze the text, location, and metadata of the uploaded PDF and extract the following real estate data into a strict JSON format.

      Retorne estritamente um JSON contendo o empreendimento e a lista de unidades.

      Formato de saída esperado (JSON object):
      {
        "project": {
          "name": "nome do empreendimento",
          "developer": "nome da construtora",
          "delivery_date": "data de entrega ISO 8601 ou null",
          "status": "na_planta", // Ou "em_construcao", "pronto", ou null
          "amenities": ["piscina", "academia"], // array de strings
          "location": {
            "neighborhood": "Cabo Branco", // Ou "Tambau", ou "Bessa"
            "position_to_sea": "beira_mar", // Ou "quadra_mar", ou "miolo" ou null
            "distance_to_beach_meters": 100, // numero ou null
            "coordinates": {
              "lat": null,
              "lng": null
            }
          },
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
        },
        "units": [
          {
            "id": "101A", // opcional, numero da unidade
            "unit_number": "101A",
            "area_m2": 85.5, // área privativa em m2 (numero) ou null
            "bedrooms": 3, // numero ou null
            "sun_orientation": "nascente", // Ou "nascente_sul", "sul", "poente" ou null
            "snapshots": [
              {
                "timestamp": "2024-05-20T12:00:00Z", // data atual
                "price_brl": 850000, // valor total (numero) ou null
                "source": "book_pdf"
              }
            ]
          }
        ]
      }

      Diretrizes:
      1. Retorne APENAS o JSON puro. Sem formatação markdown (` + "```json" + `).
      2. Defina os campos numéricos (preço, área, quartos) estritamente como nulo (null) se não encontrar a informação. NUNCA use 0 para dados ausentes.
      3. Extraia o "empreendimento" para project.name, "construtora" para project.developer.
      4. Extraia as unidades para units[].area_m2 e units[].snapshots[0].price_brl.
      5. "source" no snapshot deve ser "${filePath}".
    `;

    const generativeModel = getVertexAi().getGenerativeModel({ model: "gemini-2.5-flash" });

    const result = await callGeminiWithRetry(generativeModel, {
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

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("No JSON object found in response:", responseText);
      throw new Error("No JSON object found");
    }

    const sanitizedText = jsonMatch[0];
    let extractedData;

    try {
      extractedData = JSON.parse(sanitizedText);
    } catch (parseError) {
      console.error("Failed to parse Gemini response as JSON.", sanitizedText);
      throw new Error("Invalid JSON");
    }

    const projectData = extractedData.project;
    const extractedUnits = extractedData.units || [];

    if (!projectData || !projectData.name) {
       console.error("Expected project data with a name.");
       throw new Error("Invalid JSON format from LLM: Missing project name");
    }

    // Deterministic Entity Resolution
    let matchedProjectId = null;
    const extractedNormalizedName = normalizeProjectName(projectData.name);
    const extractedTokens = extractedNormalizedName.split(' ').filter(t => t.length > 2);
    const extractedNormalizedDev = projectData.developer ? normalizeString(projectData.developer) : null;
    let bestMatchDistance = Infinity;
    const possibleMatches: string[] = [];

    for (const p of existingProjects) {
        const dbNormalizedName = normalizeProjectName(p.name);
        const dbTokens = dbNormalizedName.split(' ').filter(t => t.length > 2);

        // Exact Match
        if (dbNormalizedName === extractedNormalizedName) {
            matchedProjectId = p.id;
            break;
        }

        // Token Inclusion (Semantic Match)
        // Check if all extracted tokens are in db name or vice versa
        let isTokenMatch = false;
        if (extractedTokens.length > 0 && dbTokens.length > 0) {
            const allExtractedInDb = extractedTokens.every(t => dbTokens.includes(t));
            const allDbInExtracted = dbTokens.every(t => extractedTokens.includes(t));
            if (allExtractedInDb || allDbInExtracted) {
                isTokenMatch = true;
            } else {
                // Partial token overlap for staging suggestions
                const overlap = extractedTokens.filter(t => dbTokens.includes(t)).length;
                if (overlap > 0) {
                    possibleMatches.push(p.id);
                }
            }
        }

        if (isTokenMatch) {
             matchedProjectId = p.id;
             break;
        }

        // Fuzzy Match
        const distance = levenshteinDistance(extractedNormalizedName, dbNormalizedName);
        if (distance < bestMatchDistance && distance <= 3) {
            // Further qualify with developer if available
            if (extractedNormalizedDev && p.developer) {
                const dbNormalizedDev = normalizeString(p.developer);
                if (dbNormalizedDev === extractedNormalizedDev || levenshteinDistance(extractedNormalizedDev, dbNormalizedDev) <= 2) {
                     bestMatchDistance = distance;
                     matchedProjectId = p.id;
                }
            } else {
                bestMatchDistance = distance;
                matchedProjectId = p.id;
            }
        }
    }

    if (matchedProjectId) {
         console.log(`Matched extracted project "${projectData.name}" to existing project ID: ${matchedProjectId}`);
         projectData.resolution_state = 'active';
    } else {
         console.log(`No high-confidence match found for "${projectData.name}". Routing to staging.`);
         projectData.resolution_state = 'staged';
         if (possibleMatches.length > 0) {
             projectData.possible_matches = possibleMatches;
         }
    }

    const projectId = matchedProjectId || db.collection("projects").doc().id;
    projectData.id = projectId;

    // Coordinate Fallback Logic for Project
    projectData.needs_geocoding = false;
    if (projectData.location) {
      if (projectData.location.coordinates?.lat == null || projectData.location.coordinates?.lng == null) {
        projectData.needs_geocoding = true;
        const fuzzyNeighborhood = projectData.location.neighborhood ? fuzzyMatchNeighborhood(projectData.location.neighborhood) : null;

        // Ensure coordinates object exists
        projectData.location.coordinates = { lat: null, lng: null };

        if (fuzzyNeighborhood === 'Cabo Branco') {
          projectData.location.coordinates.lat = -7.1354;
          projectData.location.coordinates.lng = -34.8210;
        } else if (fuzzyNeighborhood === 'Tambau') {
          projectData.location.coordinates.lat = -7.1165;
          projectData.location.coordinates.lng = -34.8228;
        } else if (fuzzyNeighborhood === 'Bessa') {
          projectData.location.coordinates.lat = -7.0658;
          projectData.location.coordinates.lng = -34.8322;
        } else {
           projectData.location.coordinates.lat = -7.1150;
           projectData.location.coordinates.lng = -34.8630;
        }
      }
    }

    // Validate project
    const projectValidation = ProjectSchema.safeParse(projectData);
    let projectSaved = false;
    if (!projectValidation.success) {
       console.error("Schema validation failed for project:", projectValidation.error);
    } else {
       const docRef = db.collection("projects").doc(projectId);
       await docRef.set(projectValidation.data, { merge: true });
       console.log(`Successfully saved project ${projectId}`);
       projectSaved = true;
    }

    let validUnitsCount = 0;
    const unitsCollectionRef = db.collection("projects").doc(projectId).collection("units");

    if (Array.isArray(extractedUnits)) {
      for (const unit of extractedUnits) {
        // Validate using Zod schema
        const validationResult = UnitSchema.safeParse(unit);
        if (!validationResult.success) {
          console.error("Schema validation failed for a unit:", validationResult.error);
          continue; // Skip invalid units
        }

        let propertyData = validationResult.data as any;

        // Deterministically calculate price_per_m2_brl
        if (propertyData.area_m2 && propertyData.snapshots && propertyData.snapshots.length > 0) {
            const snapshot = propertyData.snapshots[0];
            if (snapshot.price_brl) {
               snapshot.price_per_m2_brl = Math.round(snapshot.price_brl / propertyData.area_m2);
            } else {
               snapshot.price_per_m2_brl = null;
            }
        }

        if (propertyData.snapshots && Array.isArray(propertyData.snapshots)) {
          propertyData.snapshots.forEach((snap: any) => {
            if (snap.timestamp) {
              snap.timestamp = new Date(snap.timestamp).toISOString();
            } else {
              snap.timestamp = new Date().toISOString();
            }
            if (!snap.source || snap.source === "book_pdf") {
              snap.source = filePath;
            }
          });
        }

        let generatedId = propertyData.id || propertyData.unit_number;
        if (generatedId) {
             generatedId = normalizeString(String(generatedId)).replace(/\s+/g, '-');
        } else {
             generatedId = unitsCollectionRef.doc().id;
        }

        const unitId = generatedId;
        propertyData.id = unitId;

        const unitDocRef = unitsCollectionRef.doc(unitId);

        const { snapshots, ...unitDataWithoutSnapshots } = propertyData;

        // Set the latest snapshot on the unit doc for easy querying
        const latestSnapshot = snapshots && snapshots.length > 0 ? snapshots[0] : null;
        if (latestSnapshot) {
             unitDataWithoutSnapshots.latest_snapshot = latestSnapshot;
        }

        await unitDocRef.set(unitDataWithoutSnapshots, { merge: true });

        // Save snapshots to subcollection
        if (snapshots && snapshots.length > 0) {
            const snapshotsCollectionRef = unitDocRef.collection("snapshots");
            for (const snap of snapshots) {
                 const snapId = snapshotsCollectionRef.doc().id;
                 await snapshotsCollectionRef.doc(snapId).set(snap);
            }
        }
        console.log(`Successfully processed PDF unit and saved unit ${unitId} and its snapshots for project ${projectId}`);
        validUnitsCount++;
      }
    }

    if (validUnitsCount > 0) {
       try {
           const docRef = db.collection("projects").doc(projectId);
           await docRef.set({ has_units: true }, { merge: true });
       } catch (e) {
           console.log("Could not update project has_units flag", e);
       }
    }

    if (fileName) {
      try {
        if (!projectSaved && validUnitsCount === 0) {
            await db.collection("pdf_jobs").doc(fileName).update({
              status: "Failed",
              error: "Schema validation failed for both project and units. Nothing saved.",
            });
        } else {
            await db.collection("pdf_jobs").doc(fileName).update({
              status: "Success",
              extracted_count: validUnitsCount,
            });
        }
      } catch (e) {
        console.log("Could not update pdf_jobs, moving on...", e);
      }
    }

  } catch (error: any) {
    console.error("Error processing PDF:", error);
    if (fileName) {
      try {
        await db.collection("pdf_jobs").doc(fileName).update({
          status: "Failed",
          error: error.message || "Unknown error",
        });
      } catch (e) {
        console.log("Could not update pdf_jobs to Failed, moving on...", e);
      }
    }
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
