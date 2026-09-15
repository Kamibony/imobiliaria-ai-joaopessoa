import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import PublicHome from './pages/PublicHome';
import PublicProjectDetail from './pages/PublicProjectDetail';
import Admin from './pages/Admin';
import { ConciergeProvider } from './ConciergeContext';
import ConciergeDrawer from './components/ConciergeDrawer';
import ConciergeButton from './components/ConciergeButton';
import MapComponent from './components/MapComponent';
import './App.css';

function App() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin');

  return (
    <ConciergeProvider>
      <div className="relative min-h-screen">
        {/* Render Map globally behind everything on public routes */}
        {!isAdmin && <MapComponent />}

        {/* Main routes overlay the map */}
        <div style={{ position: 'relative', zIndex: 10, pointerEvents: 'none' }}>
          <Routes>
            <Route path="/" element={<PublicHome />} />
            <Route path="/projetos/:id" element={<PublicProjectDetail />} />
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </div>

        {/* Concierge elements */}
        {!isAdmin && (
          <>
            <ConciergeButton />
            <ConciergeDrawer />
          </>
        )}
      </div>
    </ConciergeProvider>
  );
}

export default App;
