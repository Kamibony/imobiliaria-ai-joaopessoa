const { onObjectFinalized } = require("firebase-functions/v2/storage");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { initializeApp } = require("firebase-admin/app");
const { VertexAI } = require('@google-cloud/vertexai');

initializeApp();
const db = getFirestore();

// Initialize Vertex AI (using GOOGLE_CLOUD_PROJECT for Cloud Functions v2)
const vertex_ai = new VertexAI({ project: process.env.GOOGLE_CLOUD_PROJECT, location: 'us-central1' });
const model = 'gemini-2.5-flash';

// Prísna realitná schéma pre štruktúrovaný výstup z Gemini
const extractionSchema = {
    type: "OBJECT",
    properties: {
        empreendimento: { type: "STRING" },
        construtora: { type: "STRING" },
        foco_vendas: { type: "STRING" },
        unidades: {
            type: "ARRAY",
            items: {
                type: "OBJECT",
                properties: {
                    unidade: { type: "STRING" },
                    tipologia: { type: "STRING" },
                    area_privativa_m2: { type: "NUMBER" },
                    quartos: { type: "NUMBER" },
                    valor_total: { type: "NUMBER" }
                },
                required: ["unidade", "valor_total", "area_privativa_m2"]
            }
        },
        comodidades_premium: {
            type: "ARRAY",
            items: { type: "STRING" }
        }
    },
    required: ["empreendimento", "unidades"]
};

exports.processB2BPdf = onObjectFinalized({
    timeoutSeconds: 300,
    memory: "1GiB",
}, async (event) => {
    const fileBucket = event.data.bucket;
    const filePath = event.data.name;
    const contentType = event.data.contentType;

    // Spracovanie iba PDF súborov zo zložky b2b_pdfs
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
                        { text: 'Leia este Book e Tabela de Preços imobiliários. Extraia os dados do empreendimento, comodidades e a lista exata de unidades disponíveis com seus respectivos preços e metragens.' }
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
        
        console.log(`Successfully extracted data for project: ${parsedData.empreendimento}`);

        // Deterministický výpočet ceny za meter štvorcový (R$/m²) na backendovom úseku
        if (parsedData.unidades && Array.isArray(parsedData.unidades)) {
            parsedData.unidades = parsedData.unidades.map(u => {
                if (u.valor_total && u.area_privativa_m2) {
                    u.valor_m2 = parseFloat((u.valor_total / u.area_privativa_m2).toFixed(2));
                }
                return u;
            });
        }

        // Generovanie čistého ID dokumentu na základe názvu projektu (odstránenie diakritiky a znakov)
        const docId = parsedData.empreendimento.replace(/[^a-z0-9]/gi, '').toLowerCase();
        const projectRef = db.collection('properties').doc(docId);
        
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
                    console.log(`Skipping update for ${docId} due to manual override.`);
                    return; // Ak maklér upravil dáta ručne, neprepísať ich automatikou
                }
                
                // Zlúčenie nových cien a dostupnosti s ponechaním statických dát
                transaction.set(projectRef, {
                    ...existingData,
                    ...parsedData,
                    sourceFile: filePath,
                    lastUpdated: FieldValue.serverTimestamp()
                }, { merge: true });
            }
        });

        console.log(`Successfully upserted data for project: ${docId}`);

    } catch (error) {
        console.error(`Error processing PDF ${filePath}:`, error);
        const errorRef = db.collection('ingestion_errors').doc();
        await errorRef.set({
            filePath: filePath,
            error: error.message,
            timestamp: FieldValue.serverTimestamp()
        });
    }
});
