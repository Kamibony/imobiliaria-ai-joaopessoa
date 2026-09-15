import React, { useEffect } from 'react';
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
        disableDefaultUI={true}
        gestureHandling={'greedy'}
        colorScheme={'DARK'} // Helps with default canvas color before styles load
      >
        <MapComponentInner />
        <ProjectMarkers />
        {children}
      </Map>
    </div>
  );
};

export default MapComponent;
