import React, { createContext, useState, useContext, useCallback } from 'react';

const MapStateContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export const useMapState = () => useContext(MapStateContext);

export const MapStateProvider = ({ children }) => {
  const [mapInstance, setMapInstance] = useState(null);
  const [activeCameraTarget, setActiveCameraTarget] = useState(null);

  const flyToProject = useCallback((coordinates) => {
    if (mapInstance && coordinates) {
      setActiveCameraTarget(coordinates);
      mapInstance.moveCamera({
        center: coordinates,
        zoom: 16,
        tilt: 45,
        heading: 20,
      });
    }
  }, [mapInstance]);

  return (
    <MapStateContext.Provider value={{
      mapInstance,
      setMapInstance,
      activeCameraTarget,
      setActiveCameraTarget,
      flyToProject
    }}>
      {children}
    </MapStateContext.Provider>
  );
};
