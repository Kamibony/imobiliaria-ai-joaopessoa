const { onObjectFinalized } = require("firebase-functions/v2/storage");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { initializeApp } = require("firebase-admin/app");
const { VertexAI } = require('@google-cloud/vertexai');
const path = require('path');

initializeApp();
const db = getFirestore();

// Initialize Vertex AI (using GOOGLE_CLOUD_PROJECT for Cloud Functions v2)
const vertex_ai = new VertexAI({ project: process.env.GOOGLE_CLOUD_PROJECT, location: 'us-central1' });
const model = 'gemini-2.5-flash';

// Define strict JSON schema for the output
const extractionSchema = {
    type: "OBJECT",
    properties: {
        projectName: { type: "STRING" },
        projectNumber: { type: "STRING" },
        budget: { type: "NUMBER" },
        deadline: { type: "STRING", format: "date" },
        keyContacts: {
            type: "ARRAY",
            items: {
                type: "OBJECT",
                properties: {
                    name: { type: "STRING" },
                    role: { type: "STRING" },
                    email: { type: "STRING" }
                },
                required: ["name", "email"]
            }
        },
        requirements: {
            type: "ARRAY",
            items: { type: "STRING" }
        }
    },
    required: ["projectName", "projectNumber", "budget"]
};


exports.processB2BPdf = onObjectFinalized({
    timeoutSeconds: 300,
    memory: "1GiB",
}, async (event) => {
    const fileBucket = event.data.bucket;
    const filePath = event.data.name;
    const contentType = event.data.contentType;

    // Only process PDFs in the b2b_pdfs folder
    if (!filePath.startsWith('b2b_pdfs/') || !contentType.includes('pdf')) {
        console.log(`Skipping non-PDF or non-target file: ${filePath}`);
        return;
    }

    console.log(`Starting processing for PDF: ${filePath}`);

    try {
        const generativeModel = vertex_ai.preview.getGenerativeModel({
            model: model,
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: extractionSchema,
            },
        });

        const req = {
            contents: [
                {
                    role: 'user',
                    parts: [
                        {
                            fileData: {
                                fileUri: `gs://${fileBucket}/${filePath}`,
                                mimeType: 'application/pdf'
                            }
                        },
                        { text: 'Extract project details from this B2B PDF document.' }
                    ]
                }
            ]
        };

        const response = await generativeModel.generateContent(req);
        
        if (!response.response || !response.response.candidates || response.response.candidates.length === 0) {
            throw new Error("No candidates returned from Gemini");
        }

        const rawResult = response.response.candidates[0].content.parts[0].text;
        
        let parsedData;
        try {
            parsedData = JSON.parse(rawResult);
        } catch(e) {
             throw new Error(`Failed to parse Gemini output as JSON: ${e.message}`);
        }
        
        console.log(`Successfully extracted data for project: ${parsedData.projectName}`);

        // Merge/Upsert Logic to prevent duplicates and protect manual overrides
        const projectRef = db.collection('b2b_projects').doc(parsedData.projectNumber);
        
        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(projectRef);
            
            if (!doc.exists) {
                transaction.set(projectRef, {
                    ...parsedData,
                    sourceFile: filePath,
                    ingestedAt: FieldValue.serverTimestamp(),
                    lastUpdated: FieldValue.serverTimestamp(),
                    isManualOverride: false
                });
            } else {
                const existingData = doc.data();
                if (existingData.isManualOverride) {
                    console.log(`Skipping update for ${parsedData.projectNumber} due to manual override.`);
                    return; // Do not overwrite manual edits
                }
                
                // Merge data, prioritizing new extraction if needed, or simply update timestamp
                transaction.set(projectRef, {
                    ...existingData,
                    ...parsedData,
                    sourceFile: filePath,
                    lastUpdated: FieldValue.serverTimestamp()
                }, { merge: true });
            }
        });

        console.log(`Successfully upserted data for project: ${parsedData.projectNumber}`);

    } catch (error) {
        console.error(`Error processing PDF ${filePath}:`, error);
        // Could also write error state to Firestore here for monitoring
        const errorRef = db.collection('ingestion_errors').doc();
        await errorRef.set({
            filePath: filePath,
            error: error.message,
            timestamp: FieldValue.serverTimestamp()
        });
    }
}); 
