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
