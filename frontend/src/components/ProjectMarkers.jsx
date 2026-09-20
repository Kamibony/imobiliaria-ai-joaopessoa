import React, { useEffect, useState } from 'react';
import { AdvancedMarker, InfoWindow } from '@vis.gl/react-google-maps';
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
    const normalized = (neighborhood || '').toString().toLowerCase();
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
    boxShadow: isActive ? '0 0 25px #FFD700, 0 4px 8px rgba(0,0,0,0.6)' : '0 0 15px var(--color-accent-gold), 0 4px 8px rgba(0,0,0,0.6)',
    cursor: isActive ? 'default' : 'pointer',
    transition: 'all 0.3s ease',
  }}
  onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.2)'}
  onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
  />
);

const ProjectMarkers = () => {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
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
            onClick={() => setSelectedProject({ ...project, finalCoords })}
            zIndex={isActive ? 1000 : undefined}
          >
            <GlowingGoldPin isActive={isActive} />
          </AdvancedMarker>
        );
      })}

      {selectedProject && (
        <InfoWindow
          position={selectedProject.finalCoords}
          onCloseClick={() => setSelectedProject(null)}
          options={{ pixelOffset: new window.google.maps.Size(0, -36) }}
        >
          <div style={{ padding: '0.5rem', maxWidth: '200px', fontFamily: 'var(--font-sans)', color: 'var(--color-text-main)' }}>
            {(selectedProject.manual_hero_image_url || (selectedProject.hero_images && selectedProject.hero_images[0])) && (
              <img
                src={selectedProject.manual_hero_image_url || selectedProject.hero_images[0]}
                alt={selectedProject.name}
                style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: '4px', marginBottom: '0.5rem' }}
              />
            )}
            <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.1rem', fontFamily: 'var(--font-serif)', color: 'var(--color-black)' }}>{selectedProject.name}</h3>
            <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>{selectedProject.developer}</p>

            {/* Price Metric */}
            <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', fontWeight: '600', color: 'var(--color-black)' }}>
              {selectedProject.summary?.min_price_brl
                ? `A partir de ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(selectedProject.summary.min_price_brl)}`
                : 'Preço: Consulte'}
            </p>

            <button
              onClick={() => navigate(`/projetos/${selectedProject.id}`)}
              style={{
                width: '100%',
                padding: '0.5rem',
                backgroundColor: 'var(--color-accent-gold)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '0.9rem'
              }}
            >
              Ver Detalhes
            </button>
          </div>
        </InfoWindow>
      )}
    </>
  );
};

export default ProjectMarkers;
