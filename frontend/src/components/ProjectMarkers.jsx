import React, { useEffect, useState } from 'react';
import { AdvancedMarker } from '@vis.gl/react-google-maps';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate, useLocation } from 'react-router-dom';

// Fallback coordinates based on João Pessoa neighborhoods
const NEIGHBORHOOD_COORDS = {
  'cabo branco': { lat: -7.1356, lng: -34.8213 },
  'tambaú': { lat: -7.1123, lng: -34.8239 },
  'tambau': { lat: -7.1123, lng: -34.8239 },
  'bessa': { lat: -7.0658, lng: -34.8329 },
  'manaíra': { lat: -7.0984, lng: -34.8300 },
  'manaira': { lat: -7.0984, lng: -34.8300 },
  'altiplano': { lat: -7.1436, lng: -34.8321 },
  'jardim oceania': { lat: -7.0805, lng: -34.8353 },
  'brisamar': { lat: -7.1086, lng: -34.8361 },
  'miramar': { lat: -7.1189, lng: -34.8394 },
};

const getFallbackCoordinates = (neighborhood) => {
  const defaultCoords = { lat: -7.1150, lng: -34.8250 }; // General Joao Pessoa fallback
  let baseCoords = defaultCoords;

  if (neighborhood) {
    const normalized = neighborhood.toLowerCase();
    // Find exact or partial match
    const match = Object.keys(NEIGHBORHOOD_COORDS).find(k => normalized.includes(k));
    if (match) {
      baseCoords = NEIGHBORHOOD_COORDS[match];
    }
  }

  return baseCoords;
};

const GlowingGoldPin = ({ isActive }) => (
  <div style={{
    width: isActive ? '36px' : '24px',
    height: isActive ? '36px' : '24px',
    backgroundColor: isActive ? '#FFD700' : 'var(--color-accent-gold)', // Brighter gold when active
    borderRadius: '50%',
    border: '3px solid var(--color-black)',
    boxShadow: isActive ? '0 0 25px #FFD700' : '0 0 15px var(--color-accent-gold)',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  }}
  onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.2)'}
  onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
  />
);

const ProjectMarkers = () => {
  const [projects, setProjects] = useState([]);
  const navigate = useNavigate();
  const location = useLocation();

  // Extract the project ID from the URL if we are on a project detail page
  const match = location.pathname.match(/^\/projetos\/([^/]+)$/);
  const activeProjectId = match ? match[1] : null;

  useEffect(() => {
    const projectsRef = collection(db, 'projects');
    const unsubscribe = onSnapshot(projectsRef, (snapshot) => {
      const projectsData = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(p => p.resolution_state !== 'staged');
      setProjects(projectsData);
    });

    return () => unsubscribe();
  }, []);

  return (
    <>
      {projects.map((project) => {
        const isActive = project.id === activeProjectId;

        let rawCoords = project.coordinates || project.location?.coordinates;
        let finalCoords;

        if (rawCoords && rawCoords.lat && rawCoords.lng) {
          finalCoords = {
            lat: Number(rawCoords.lat),
            lng: Number(rawCoords.lng)
          };
        } else {
          // If coordinates are missing or invalid, fall back to neighborhood-based coordinates
          const neighborhood = project.location?.neighborhood || project.ai_context?.local_advantage || '';
          finalCoords = getFallbackCoordinates(neighborhood);
        }

        return (
          <AdvancedMarker
            key={project.id}
            position={finalCoords}
            title={project.name}
            onClick={() => navigate(`/projetos/${project.id}`)}
            zIndex={isActive ? 1000 : undefined}
          >
            <GlowingGoldPin isActive={isActive} />
          </AdvancedMarker>
        );
      })}
    </>
  );
};

export default ProjectMarkers;
