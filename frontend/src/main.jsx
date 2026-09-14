import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { APIProvider } from '@vis.gl/react-google-maps';
import './index.css'
import App from './App.jsx'
import { LanguageProvider } from './LanguageContext'
import { MapStateProvider } from './MapStateContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'dummy_key'}>
      <BrowserRouter>
        <LanguageProvider>
          <MapStateProvider>
            <App />
          </MapStateProvider>
        </LanguageProvider>
      </BrowserRouter>
    </APIProvider>
  </StrictMode>,
)
