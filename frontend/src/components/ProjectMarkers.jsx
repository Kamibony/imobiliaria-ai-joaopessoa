import React, { useEffect, useState } from 'react';
import { AdvancedMarker } from '@vis.gl/react-google-maps';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate, useLocation } from 'react-router-dom';

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
        .filter(p => {
          if (p.resolution_state === 'staged') return false;
          const coords = p.coordinates || p.location?.coordinates;
          return coords && coords.lat && coords.lng;
        });
      setProjects(projectsData);
    });

    return () => unsubscribe();
  }, []);

  return (
    <>
      {projects.map((project) => {
        const isActive = project.id === activeProjectId;
        const coords = project.coordinates || project.location?.coordinates;
        return (
          <AdvancedMarker
            key={project.id}
            position={{ lat: Number(coords.lat), lng: Number(coords.lng) }}
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
