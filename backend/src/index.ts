import { onRequest } from "firebase-functions/v2/https";
import { onTaskDispatched } from "firebase-functions/v2/tasks";
import * as admin from "firebase-admin";
import { getFunctions } from "firebase-admin/functions";
import { VertexAI } from "@google-cloud/vertexai";
import { PropertySchema } from "./schema";
import { fuzzyMatchNeighborhood } from "./utils";
import cors = require("cors");

admin.initializeApp();

const corsHandler = cors({ origin: true });
const db = admin.firestore();

async function verifyAuth(request: any): Promise<boolean> {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }
  const token = authHeader.split("Bearer ")[1];
  const expectedSecret = process.env.WEBHOOK_SECRET || process.env.API_SECRET;

  if (expectedSecret && token === expectedSecret) {
    return true;
  }

  try {
    await admin.auth().verifyIdToken(token);
    return true;
  } catch (error) {
    console.error("Firebase auth verification failed:", error);
    return false;
  }
}

// Initialize Vertex AI
let project = 'imobiliaria-ai-joaopessoa';
if (process.env.GCLOUD_PROJECT) {
  project = process.env.GCLOUD_PROJECT;
} else if (process.env.FIREBASE_CONFIG) {
  try {
    project = JSON.parse(process.env.FIREBASE_CONFIG as string).projectId;
  } catch (e) {
    console.error('Error parsing FIREBASE_CONFIG', e);
  }
}
const location = 'us-central1';
const vertexAi = new VertexAI({ project: project, location: location });


// Queue worker function (process the data asynchronously)
export const processPropertyData = onTaskDispatched({
  timeoutSeconds: 180,
  retryConfig: {
    maxAttempts: 3,
    minBackoffSeconds: 60,
  }
}, async (req) => {
  const { dataToParse, source, image_base64 } = req.data;

  try {
    const prompt = `
      You are an expert real estate data extractor for the Cabo Branco, Tambaú, and Bessa market in João Pessoa.
      Extract the provided data and return a strict JSON object that perfectly matches the following TypeScript interface:

      export interface PropertySnapshot {
        timestamp: string; // ISO 8601 date string
        price_brl: number | null;
        price_per_m2_brl: number | null;
        status: 'na_planta' | 'em_construcao' | 'pronto';
        source: string;
      }

      export interface Property {
        id: string; // unique identifier
        basic_info: {
          title: string;
          developer: string | null;
          delivery_date: string | null; // ISO 8601 date string
        };
        location: {
          neighborhood: 'Cabo Branco' | 'Tambau' | 'Bessa';
          position_to_sea: 'beira_mar' | 'quadra_mar' | 'miolo';
          distance_to_beach_meters: number;
          coordinates: {
            lat: number | null;
            lng: number | null;
          };
        };
        features: {
          area_m2: number | null;
          sun_orientation: 'nascente' | 'nascente_sul' | 'sul' | 'poente';
          bedrooms: number | null;
        };
        snapshots: PropertySnapshot[];
        ai_context: {
          target_persona: {
            'pt-BR': string[];
            'en': string[];
          };
          investment_roi_estimated_percent: number;
          local_advantage: {
            'pt-BR': string;
            'en': string;
          };
        };
      }

      Guidelines:
      1. ONLY return the raw JSON object. Do not include markdown formatting like \`\`\`json.
      2. Set missing fields strictly to null (including for all numeric fields like prices, area, bedrooms, distance to beach). Do not use 0 for missing data.
      3. For target_persona and local_advantage, provide localized strings in both pt-BR and en.
      4. "source" in snapshot should be "${source}".

      Data to extract:
      ${dataToParse}
    `;

    const generativeModel = vertexAi.getGenerativeModel({ model: "gemini-2.5-flash" });
    let parts: any[] = [{ text: prompt }];
    if (image_base64) {
      parts.push({
        inlineData: {
          data: image_base64,
          mimeType: "image/png"
        }
      });
    }

    const result = await generativeModel.generateContent({
      contents: [{ role: 'user', parts: parts }],
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
      console.error("No JSON block found in response:", responseText);
      throw new Error("No JSON block found");
    }

    const sanitizedText = jsonMatch[0];
    let parsedData: any;

    try {
      parsedData = JSON.parse(sanitizedText);
    } catch (parseError) {
      console.error("Failed to parse Gemini response as JSON.", sanitizedText);
      throw new Error("Invalid JSON");
    }

    // Validate using Zod schema
    const validationResult = PropertySchema.safeParse(parsedData);
    if (!validationResult.success) {
      console.error("Schema validation failed:", validationResult.error);
      throw new Error("Schema validation failed");
    }

    let propertyData = validationResult.data as any;

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
        if (!snap.source) {
          snap.source = source || 'admin_upload';
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
           // Default fallback
           propertyData.location.coordinates.lat = -7.1150;
           propertyData.location.coordinates.lng = -34.8630;
        }
      }
    }

    const docRef = db.collection("properties").doc(propertyId);
    const docSnap = await docRef.get();

    if (docSnap.exists) {
      const newSnapshots = propertyData.snapshots || [];
      await docRef.update({
        snapshots: admin.firestore.FieldValue.arrayUnion(...newSnapshots)
      });
      const { snapshots, ...otherData } = propertyData;
      await docRef.set(otherData, { merge: true });
    } else {
      await docRef.set(propertyData);
    }

    // Also save hash back to TargetURLs if we have the original URL from payload
    if (req.data.url && req.data.new_hash) {
       const targetUrlsRef = db.collection("TargetURLs");
       const targetQuery = await targetUrlsRef.where('url', '==', req.data.url).get();
       if (!targetQuery.empty) {
           targetQuery.forEach(async (doc) => {
               await doc.ref.update({ last_content_hash: req.data.new_hash });
           });
       }
    }
  } catch (error) {
    console.error("Error processing property data task:", error);
    throw error; // Will retry via Cloud Tasks
  }
});


export const ingestPropertyData = onRequest((request, response) => {
  corsHandler(request, response, async () => {
  if (!(await verifyAuth(request))) {
    response.status(401).send("Unauthorized");
    return;
  }

  try {
    const payload = request.body;
    let dataToParse = "";
    let source = "admin_upload";

    if (typeof payload === "string") {
      dataToParse = payload;
    } else if (typeof payload === "object") {
      if (payload.raw_text) {
        dataToParse = payload.raw_text;
      } else {
        dataToParse = JSON.stringify(payload);
      }
      if (payload.source) {
        source = payload.source;
      }
    } else {
      response.status(400).send("Invalid payload format. Expected string or JSON.");
      return;
    }



    const queue = getFunctions().taskQueue('processPropertyData');

    try {
      await queue.enqueue({
        dataToParse,
        source,
        url: payload.url,
        new_hash: payload.new_hash,
        image_base64: payload.image_base64
      });
    } catch (e) {
      console.error("Failed to enqueue task", e);
      throw e;
    }response.status(202).send({ message: "Data received and queued for processing." });

  } catch (error) {
    console.error("Error queueing property data:", error);
    response.status(500).send("Internal Server Error");
  }
  });
});


// HTTP Cloud Function to filter discovered URLs using Gemini
export const filterDiscoveredUrls = onRequest({ timeoutSeconds: 120 }, (request, response) => {
  corsHandler(request, response, async () => {
  if (!(await verifyAuth(request))) {
    response.status(401).send("Unauthorized");
    return;
  }

  try {
    const payload = request.body;

    // Ensure payload is an array of objects
    if (!Array.isArray(payload)) {
      response.status(400).send("Invalid payload format. Expected an array of link objects.");
      return;
    }

    const linksToFilter = payload.filter((link) => typeof link === "object" && link !== null && link.href);

    if (linksToFilter.length === 0) {
      response.status(400).send("No valid links provided in the array.");
      return;
    }

    const prompt = `
      You are an expert real estate data assistant focused on the João Pessoa market, specifically the coastal neighborhoods of Cabo Branco, Tambaú, and Bessa.
      I will provide you a JSON list of links extracted from developer websites.
      Your task is to filter this list and return ONLY the URLs that likely point to individual property/project detail pages in our target geographic area.
      Discard any noise such as contact pages, about us, main index pages, blog posts, generic searches, or projects located in other cities or states.

      Return ONLY a raw JSON array of strings containing the selected URLs, and nothing else. No markdown formatting, no explanations.
      Ensure the output is parseable by JSON.parse().

      Links to evaluate:
      ${JSON.stringify(linksToFilter, null, 2)}
    `;


    const filterModel = vertexAi.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await filterModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!responseText) {
      console.error("No response text from Gemini in filterDiscoveredUrls");
      response.status(500).send("Failed to filter URLs");
      return;
    }

    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error("No JSON array found in response:", responseText);
      response.status(500).send("Internal Server Error: No JSON array found");
      return;
    }
    const sanitizedText = jsonMatch[0];

    // Parse the JSON string into an object
    let filteredUrls: string[] = [];
    try {
      filteredUrls = JSON.parse(sanitizedText);
    } catch (parseError) {
      console.error("Failed to parse Gemini response as JSON in filterDiscoveredUrls.");
      console.error("Raw responseText:", responseText);
      console.error("Sanitized text:", sanitizedText);
      console.error("Parse error:", parseError);
      response.status(500).send("Internal Server Error: Failed to parse filtered URLs");
      return;
    }

    response.status(200).json(filteredUrls);
  } catch (error) {
    console.error("Error filtering URLs:", error);
    response.status(500).send("Internal Server Error");
  }
  });
});

export const dispatchScrapingMission = onRequest((request, response) => {
  corsHandler(request, response, async () => {
  if (!(await verifyAuth(request))) {
    response.status(401).send("Unauthorized");
    return;
  }

  try {
    const payload = request.body;

    if (!payload || typeof payload.url !== "string" || !payload.url || typeof payload.instruction !== "string" || !payload.instruction) {
      response.status(400).send("Invalid payload format. Expected an object with 'url' and 'instruction' strings.");
      return;
    }

    const taskSessionsRef = db.collection("task_sessions");
    const newDocRef = taskSessionsRef.doc();

    const missionDoc = {
      doc_id: newDocRef.id,
      status: "PENDING",
      intent: "WEB",
      supervisor_plan: [
        `[WEB] Navigate to URL: ${payload.url}`,
        `[WEB] ${payload.instruction}`
      ],
      created_at: admin.firestore.FieldValue.serverTimestamp()
    };

    await newDocRef.set(missionDoc);

    response.status(200).json({
      message: "Scraping mission dispatched successfully.",
      block_id: newDocRef.id
    });
  } catch (error) {
    console.error("Error dispatching scraping mission:", error);
    response.status(500).send("Internal Server Error");
  }
  });
});

export const addDiscoveredUrls = onRequest((request, response) => {
  corsHandler(request, response, async () => {
  if (!(await verifyAuth(request))) {
    response.status(401).send("Unauthorized");
    return;
  }

  try {
    const payload = request.body;

    // Ensure payload is an array of strings
    if (!Array.isArray(payload)) {
      response.status(400).send("Invalid payload format. Expected an array of URLs.");
      return;
    }

    const newUrls: string[] = payload.filter((url) => typeof url === "string");

    if (newUrls.length === 0) {
      response.status(400).send("No valid URLs provided in the array.");
      return;
    }

    const targetUrlsRef = db.collection("TargetURLs");
    const reviewInboxRef = db.collection("ReviewInbox");

    // Get existing URLs from TargetURLs to prevent pushing already known URLs to review
    const targetSnapshot = await targetUrlsRef.get();
    const existingUrls = new Set<string>();

    targetSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.url) {
        existingUrls.add(data.url.trim().replace(/\/$/, ""));
      }
    });

    // Get URLs already in ReviewInbox to prevent duplicate queue entries
    const inboxSnapshot = await reviewInboxRef.where("type", "==", "DISCOVERY").where("status", "==", "PENDING").get();
    const inboxUrls = new Set<string>();
    inboxSnapshot.forEach((doc) => {
      const data = doc.data();
      if(data.url) {
        inboxUrls.add(data.url.trim().replace(/\/$/, ""));
      }
    });

    let addedCount = 0;

    const normalizeUrl = (url: string) => url.trim().replace(/\/$/, "");

    const batch = db.batch();
    for (const rawUrl of newUrls) {
      const url = normalizeUrl(rawUrl);
      if (!existingUrls.has(url) && !inboxUrls.has(url)) {
        const newDocRef = reviewInboxRef.doc();
        batch.set(newDocRef, {
          id: newDocRef.id,
          type: 'DISCOVERY',
          status: 'PENDING',
          url,
          created_at: admin.firestore.FieldValue.serverTimestamp()
        });
        inboxUrls.add(url);
        addedCount++;
      }
    }

    if (addedCount > 0) {
      await batch.commit();
    }

    response.status(200).json({
      message: `Successfully processed URLs. Added ${addedCount} new URLs to ReviewInbox.`,
      addedCount
    });
  } catch (error) {
    console.error("Error adding discovered URLs:", error);
    response.status(500).send("Internal Server Error");
  }
  });
});

// HTTP Cloud Function to get dynamic target URLs for the scraper
export const getDiscoverySources = onRequest((request, response) => {
  corsHandler(request, response, async () => {
  if (!(await verifyAuth(request))) {
    response.status(401).send("Unauthorized");
    return;
  }

  try {
    const discoverySourcesRef = db.collection("DiscoverySources");
    const snapshot = await discoverySourcesRef.get();

    const sources: any[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.source) {
        sources.push({
          id: doc.id,
          source: data.source,
          type: data.type || 'URL',
        });
      }
    });

    response.status(200).json(sources);
  } catch (error) {
    console.error("Error fetching discovery sources:", error);
    response.status(500).send("Internal Server Error");
  }
  });
});

export const processTriageAction = onRequest((request, response) => {
  corsHandler(request, response, async () => {
  if (!(await verifyAuth(request))) {
    response.status(401).send("Unauthorized");
    return;
  }

  try {
    const payload = request.body;
    if (!payload || !payload.id || !payload.action || !payload.type) {
      response.status(400).send("Invalid payload format. Expected id, action (APPROVE/DISCARD), and type.");
      return;
    }

    const { id, action, type, url, new_hash, raw_text, image_base64 } = payload;

    if (action !== 'APPROVE' && action !== 'DISCARD') {
        response.status(400).send("Invalid action. Must be APPROVE or DISCARD.");
        return;
    }

    const reviewInboxRef = db.collection("ReviewInbox");
    const docRef = reviewInboxRef.doc(id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
        response.status(404).send("Item not found in Review Inbox.");
        return;
    }

    await docRef.update({ status: action === 'APPROVE' ? 'APPROVED' : 'DISCARDED' });

    if (action === 'APPROVE') {
        const targetUrlsRef = db.collection("TargetURLs");

        if (type === 'DISCOVERY') {
            // Check if already in TargetURLs
            const targetQuery = await targetUrlsRef.where('url', '==', url).get();
            if (targetQuery.empty) {
                await targetUrlsRef.add({
                    url: url,
                    last_content_hash: null,
                });
            }

            // Dispatch scraping mission
            const taskSessionsRef = db.collection("task_sessions");
            await taskSessionsRef.add({
                doc_id: taskSessionsRef.doc().id, // Let Firestore generate ID, but save it in field
                status: "PENDING",
                intent: "WEB",
                supervisor_plan: [
                    `[WEB] Navigate to URL: ${url}`,
                    `[WEB] Extract real estate property details for João Pessoa.`
                ],
                created_at: admin.firestore.FieldValue.serverTimestamp()
            });
        } else if (type === 'CHANGE') {
             // Update hash in TargetURLs
             const targetQuery = await targetUrlsRef.where('url', '==', url).get();
             if (!targetQuery.empty) {
                targetQuery.forEach(async (doc) => {
                     await doc.ref.update({ last_content_hash: new_hash });
                });
             } else {
                 // Add it if it somehow isn't there
                 await targetUrlsRef.add({
                    url: url,
                    last_content_hash: new_hash,
                });
             }

             let fullImageBase64 = null;
             if (image_base64) {
                 const bucket = admin.storage().bucket();
                 const file = bucket.file(image_base64);
                 try {
                     const [buffer] = await file.download();
                     fullImageBase64 = buffer.toString('base64');
                 } catch (e) {
                     console.error("Failed to download image from storage", e);
                 }
             }

             // Enqueue data for deep extraction
             const queue = getFunctions().taskQueue('processPropertyData');
             await queue.enqueue({
                 dataToParse: raw_text,
                 source: 'python_playwright_scraper',
                 url: url,
                 new_hash: new_hash,
                 image_base64: fullImageBase64
             });
        }
    }

    response.status(200).json({ message: `Triage action ${action} processed successfully for ${type}.` });

  } catch (error) {
    console.error("Error processing triage action:", error);
    response.status(500).send("Internal Server Error");
  }
  });
});

export const reportDetectedChange = onRequest((request, response) => {
  corsHandler(request, response, async () => {
  if (!(await verifyAuth(request))) {
    response.status(401).send("Unauthorized");
    return;
  }

  try {
    const payload = request.body;

    if (!payload || !payload.url || !payload.new_hash || !payload.raw_text) {
      response.status(400).send("Invalid payload format. Expected url, new_hash, and raw_text.");
      return;
    }

    let storagePath = null;
    if (payload.image_base64) {
      const bucket = admin.storage().bucket();
      const imageBuffer = Buffer.from(payload.image_base64, 'base64');
      const filename = `changes/${Date.now()}_${payload.url.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
      const file = bucket.file(filename);
      await file.save(imageBuffer, {
        metadata: { contentType: 'image/png' },
      });
      storagePath = filename;
    }

    const reviewInboxRef = db.collection("ReviewInbox");
    const newDocRef = reviewInboxRef.doc();

    await newDocRef.set({
      id: newDocRef.id,
      type: 'CHANGE',
      status: 'PENDING',
      url: payload.url,
      new_hash: payload.new_hash,
      raw_text: payload.raw_text,
      image_base64: storagePath, // Store path instead of massive string
      created_at: admin.firestore.FieldValue.serverTimestamp()
    });

    response.status(200).json({ message: "Change reported successfully." });
  } catch (error) {
    console.error("Error reporting change:", error);
    response.status(500).send("Internal Server Error");
  }
  });
});

export const getTargetUrls = onRequest((request, response) => {
  corsHandler(request, response, async () => {
  if (!(await verifyAuth(request))) {
    response.status(401).send("Unauthorized");
    return;
  }

  try {
    const targetUrlsRef = db.collection("TargetURLs");
    const snapshot = await targetUrlsRef.get();

    const urls: any[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.url) {
        urls.push({
          url: data.url.trim().replace(/\/$/, ""),
          last_content_hash: data.last_content_hash || null,
        });
      }
    });

    response.status(200).json(urls);
  } catch (error) {
    console.error("Error fetching target URLs:", error);
    response.status(500).send("Internal Server Error");
  }
  });
});


// WhatsApp Webhook
export const whatsappWebhook = onRequest((request, response) => {
  corsHandler(request, response, async () => {
  if (request.method === 'GET') {
    // WhatsApp Verification
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
          const from = message.from; // Sender's phone number
          const text = message.text?.body;

          if (text) {
            // Intent Router
            const intentPrompt = `
              Analyze the following WhatsApp message from a real estate context.
              Determine the user's intent. Return ONLY "INGESTION" if the message contains property details to be added to the catalog (e.g., price, area, description, "I have a property").
              Return ONLY "INQUIRY" if the user is asking a question about properties, prices, or recommendations (e.g., "What do you have in Bessa?", "Looking for a 2 bedroom").
              If unsure, return "INQUIRY".

              Message: "${text}"
            `;

            const routerModel = vertexAi.getGenerativeModel({ model: "gemini-2.5-flash" });
            const routerResult = await routerModel.generateContent({
              contents: [{ role: 'user', parts: [{ text: intentPrompt }] }],
            });
            const intent = routerResult.response.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toUpperCase();

            if (intent === 'INGESTION') {
              // Queue for ingestion
              const queue = getFunctions().taskQueue('processPropertyData');
              try {
                  await queue.enqueue({
                    dataToParse: text,
                    source: 'whatsapp_broker'
                  });
                  console.log(`Queued WhatsApp ingestion for ${from}`);
              } catch(e) {
                  console.error("Failed to queue WhatsApp ingestion", e);
              }

              // Send summary/confirmation via WhatsApp API (mocked here, would use actual WhatsApp API)
              console.log(`Sending WhatsApp reply to ${from}: "Entendi! Estou processando as informações deste imóvel e adicionando ao catálogo."`);
            } else {
              // Inquiry handling (RAG simulation)
              const ragPrompt = `
                You are a helpful Real Estate Concierge for João Pessoa (Cabo Branco, Tambaú, Bessa).
                Answer the user's question concisely in Brazilian Portuguese. Highlight ROI and local advantages if relevant.

                User question: "${text}"
              `;
              const ragModel = vertexAi.getGenerativeModel({ model: "gemini-2.5-flash" });
              const ragResult = await ragModel.generateContent({
                contents: [{ role: 'user', parts: [{ text: ragPrompt }] }],
              });
              const replyText = ragResult.response.candidates?.[0]?.content?.parts?.[0]?.text;

              // Send reply via WhatsApp API (mocked)
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
