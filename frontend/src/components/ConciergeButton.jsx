import React from 'react';
import { useConcierge } from '../ConciergeContext';

const ConciergeButton = () => {
  const { toggleDrawer } = useConcierge();

  return (
    <button
      onClick={toggleDrawer}
      className="fixed bottom-6 right-6 z-30 flex items-center justify-center gap-2 bg-black hover:bg-[#c5a880] text-white px-6 py-4 rounded-full shadow-2xl transition-all duration-300 transform hover:-translate-y-1 group border-none"
      aria-label="Consultar Concierge"
    >
      <span className="text-xl">✨</span>
      <span className="font-sans text-sm font-medium tracking-wide">Consultar Concierge</span>
    </button>
  );
};

export default ConciergeButton;
