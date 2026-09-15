import React, { createContext, useState, useContext, useCallback } from 'react';

const MapStateContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export const useMapState = () => useContext(MapStateContext);

export const MapStateProvider = ({ children }) => {
  const [mapInstance, setMapInstance] = useState(null);
  const [activeCameraTarget, setActiveCameraTarget] = useState(null);

  const flyToProject = useCallback((coordinates) => {
    if (coordinates) {
      // Force a new object reference so consecutive clicks on the same
      // project will still trigger the effect if needed.
      const target = { ...coordinates, _t: Date.now() };
      setActiveCameraTarget(target);

      // If the map is already ready, move immediately
      if (mapInstance) {
        mapInstance.moveCamera({
          center: target,
          zoom: 18,
          tilt: 45,
          heading: 20,
        });
      }
    }
  }, [mapInstance]);

  React.useEffect(() => {
    if (mapInstance && activeCameraTarget) {
      mapInstance.moveCamera({
        center: activeCameraTarget,
        zoom: 18,
        tilt: 45,
        heading: 20,
      });
    }
  }, [mapInstance, activeCameraTarget]);

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
