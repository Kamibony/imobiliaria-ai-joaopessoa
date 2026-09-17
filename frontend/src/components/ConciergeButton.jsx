import React, { useState, useEffect } from 'react';
import { useConcierge } from '../ConciergeContext';

const ConciergeButton = () => {
  const { toggleDrawer } = useConcierge();
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);

  useEffect(() => {
    const handleDrawerStateChange = (e) => {
      setIsCatalogOpen(e.detail.isDrawerOpen);
    };

    window.addEventListener('catalogDrawerStateChange', handleDrawerStateChange);
    return () => {
      window.removeEventListener('catalogDrawerStateChange', handleDrawerStateChange);
    };
  }, []);

  return (
    <button
      onClick={toggleDrawer}
      style={{
        transform: isCatalogOpen ? 'translateX(-400px)' : 'translateX(0)',
        transition: 'transform 0.3s ease-in-out'
      }}
      className="fixed bottom-6 right-6 z-30 flex items-center justify-center gap-2 bg-black hover:bg-[#c5a880] hover:-translate-y-1 text-white px-6 py-4 rounded-full shadow-2xl group border-none"
      aria-label="Consultar Concierge"
    >
      <span className="text-xl">✨</span>
      <span className="font-sans text-sm font-medium tracking-wide">Consultar Concierge</span>
    </button>
  );
};

export default ConciergeButton;
