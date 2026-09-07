import React from 'react';
import { Routes, Route } from 'react-router-dom';
import PublicHome from './pages/PublicHome';
import PublicProjectDetail from './pages/PublicProjectDetail';
import Admin from './pages/Admin';
import './App.css';

function App() {
  return (
    <Routes>
      <Route path="/" element={<PublicHome />} />
      <Route path="/projetos/:id" element={<PublicProjectDetail />} />
      <Route path="/admin" element={<Admin />} />
    </Routes>
  );
}

export default App;
