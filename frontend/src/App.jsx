import React from 'react';
import { Routes, Route } from 'react-router-dom';
import PublicHome from './pages/PublicHome';
import PublicProjectDetail from './pages/PublicProjectDetail';
import Admin from './pages/Admin';
import { ConciergeProvider } from './ConciergeContext';
import ConciergeDrawer from './components/ConciergeDrawer';
import ConciergeButton from './components/ConciergeButton';
import './App.css';

function App() {
  return (
    <ConciergeProvider>
      <div className="relative min-h-screen">
        <Routes>
          <Route path="/" element={<PublicHome />} />
          <Route path="/projetos/:id" element={<PublicProjectDetail />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
        <ConciergeButton />
        <ConciergeDrawer />
      </div>
    </ConciergeProvider>
  );
}

export default App;
