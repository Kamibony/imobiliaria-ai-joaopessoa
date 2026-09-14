import React, { useEffect, useState } from 'react';
import { AdvancedMarker } from '@vis.gl/react-google-maps';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';

const GlowingGoldPin = () => (
  <div style={{
    width: '24px',
    height: '24px',
    backgroundColor: 'var(--color-accent-gold)',
    borderRadius: '50%',
    border: '3px solid var(--color-black)',
    boxShadow: '0 0 15px var(--color-accent-gold)',
    cursor: 'pointer',
    transition: 'transform 0.2s ease',
  }}
  onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.2)'}
  onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
  />
);

const ProjectMarkers = () => {
  const [projects, setProjects] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const projectsRef = collection(db, 'projects');
    const unsubscribe = onSnapshot(projectsRef, (snapshot) => {
      const projectsData = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(p => p.resolution_state !== 'staged' && p.coordinates && p.coordinates.lat && p.coordinates.lng);
      setProjects(projectsData);
    });

    return () => unsubscribe();
  }, []);

  return (
    <>
      {projects.map((project) => (
        <AdvancedMarker
          key={project.id}
          position={{ lat: project.coordinates.lat, lng: project.coordinates.lng }}
          title={project.name}
          onClick={() => navigate(`/projetos/${project.id}`)}
        >
          <GlowingGoldPin />
        </AdvancedMarker>
      ))}
    </>
  );
};

export default ProjectMarkers;
