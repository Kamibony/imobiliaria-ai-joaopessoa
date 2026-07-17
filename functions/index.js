functions/index.js
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
frontend/src/components/PDFUploader.jsx
import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { getStorage, ref, uploadBytes } from 'firebase/storage';
// Ensure firebase is initialized somewhere in the app before this component is used

const PDFUploader = () => {
  const [uploadStatus, setUploadStatus] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  const onDrop = useCallback(async (acceptedFiles, rejectedFiles) => {
    setErrorMessage('');
    setUploadStatus(null);

    if (rejectedFiles.length > 0) {
      setErrorMessage('Please upload a valid PDF file under 50MB.');
      return;
    }

    const file = acceptedFiles[0];
    if (!file) return;

    setUploadStatus('uploading');

    try {
      const storage = getStorage();
      const storageRef = ref(storage, `b2b_pdfs/${Date.now()}_${file.name}`);
      
      await uploadBytes(storageRef, file);

      setUploadStatus('success');
    } catch (error) {
      console.error("Upload failed", error);
      setUploadStatus('error');
      setErrorMessage(error.message || 'An error occurred during upload.');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    maxSize: 50 * 1024 * 1024, // 50MB max size
    multiple: false
  });

  return (
    <div className="pdf-uploader-container p-6 max-w-lg mx-auto bg-white rounded-xl shadow-md space-y-4">
      <h2 className="text-2xl font-bold text-gray-800">B2B PDF Ingestion</h2>
      <p className="text-gray-600">Drag and drop your B2B project PDF to trigger the extraction pipeline.</p>
      
      <div 
        {...getRootProps()} 
        className={`dropzone border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
          isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <input {...getInputProps()} />
        {isDragActive ? (
          <p className="text-blue-500 font-medium">Drop the PDF here...</p>
        ) : (
          <div>
            <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
              <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p className="mt-1 text-sm text-gray-600">Drag & drop a PDF, or click to select</p>
            <p className="text-xs text-gray-500 mt-2">Max size: 50MB</p>
          </div>
        )}
      </div>

      {uploadStatus === 'uploading' && (
        <div className="text-blue-600 flex items-center justify-center space-x-2">
           <svg className="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Uploading to secure storage...</span>
        </div>
      )}

      {uploadStatus === 'success' && (
        <div className="text-green-600 font-medium p-3 bg-green-50 rounded-md">
          ✅ Upload successful! The extraction pipeline has been triggered.
        </div>
      )}

      {errorMessage && (
        <div className="text-red-600 p-3 bg-red-50 rounded-md border border-red-200">
          ❌ {errorMessage}
        </div>
      )}
    </div>
  );
};

export default PDFUploader;
storage.rules
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    
    // Secure B2B PDF uploads
    match /b2b_pdfs/{pdfId} {
      // Allow upload if:
      // 1. User is authenticated (requires custom token setup or standard Firebase Auth)
      // 2. File size is under 50MB
      // 3. File type is PDF
      allow write: if request.auth != null 
                   && request.resource.size < 50 * 1024 * 1024 
                   && request.resource.contentType.matches('application/pdf');
                   
      // Allow read for authenticated users to view processed PDFs
      allow read: if request.auth != null;
    }

    // Default deny all
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
