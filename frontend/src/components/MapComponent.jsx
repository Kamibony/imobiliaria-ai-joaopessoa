import React, { useEffect, useState } from 'react';
import { FaMap, FaGlobeAmericas } from 'react-icons/fa';
import { Map, useMap } from '@vis.gl/react-google-maps';
import { useMapState } from '../MapStateContext';
import ProjectMarkers from './ProjectMarkers';

const MapComponentInner = () => {
  const map = useMap();
  const { setMapInstance } = useMapState();

  useEffect(() => {
    if (map) {
      setMapInstance(map);
    }
  }, [map, setMapInstance]);

  return null;
};

const MapComponent = ({ children }) => {
  const [mapType, setMapType] = useState('roadmap');
  // Using a custom Map ID configured in Google Cloud Console
  // We expect this mapId to have styling applied (dark background, gold roads, hidden POIs)
  const MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || "cad1b1a245eea208d67502a4";

  return (
    <div style={{ width: '100%', height: '100vh', position: 'fixed', top: 0, left: 0, zIndex: 0 }}>
      <Map
        defaultCenter={{ lat: -7.1195, lng: -34.8450 }} // João Pessoa
        defaultZoom={13}
        defaultTilt={45}
        mapId={MAP_ID}
        mapTypeId={mapType}
        disableDefaultUI={true}
        gestureHandling={'greedy'}
        colorScheme={'DARK'} // Helps with default canvas color before styles load
      >
        <MapComponentInner />
        <ProjectMarkers />
        {children}
      </Map>

      {/* Map Type Control */}
      <div style={{
        position: 'absolute',
        bottom: '2rem',
        left: '2rem',
        zIndex: 10,
        display: 'flex',
        gap: '0.5rem',
        backgroundColor: 'var(--color-surface)',
        padding: '0.5rem',
        borderRadius: '8px',
        boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
      }}>
        <button
          onClick={() => setMapType('roadmap')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            backgroundColor: mapType === 'roadmap' ? 'var(--color-black)' : 'transparent',
            color: mapType === 'roadmap' ? 'white' : 'var(--color-text-main)',
            border: 'none',
            padding: '0.5rem 1rem',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '0.9rem',
            transition: 'all 0.3s ease'
          }}
        >
          <FaMap /> Mapa
        </button>
        <button
          onClick={() => setMapType('hybrid')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            backgroundColor: mapType === 'hybrid' ? 'var(--color-black)' : 'transparent',
            color: mapType === 'hybrid' ? 'white' : 'var(--color-text-main)',
            border: 'none',
            padding: '0.5rem 1rem',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '0.9rem',
            transition: 'all 0.3s ease'
          }}
        >
          <FaGlobeAmericas /> Satélite 3D
        </button>
      </div>
    </div>
  );
};

export default MapComponent;
