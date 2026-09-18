import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { getStorage, ref, getDownloadURL } from 'firebase/storage';
import { useLanguage, getLocalizedText } from '../LanguageContext';
import { useNavigate } from 'react-router-dom';

const ProjectCard = ({ project }) => {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [heroImageUrl, setHeroImageUrl] = useState(null);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    if (project?.manual_hero_image_url) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHeroImageUrl(project.manual_hero_image_url);
    } else if (project?.assets?.hero_images && project.assets.hero_images.length > 0) {
      const fetchHeroImage = async () => {
        try {
          const storage = getStorage();
          const fileRef = ref(storage, project.assets.hero_images[0]);
          const downloadURL = await getDownloadURL(fileRef);
          setHeroImageUrl(downloadURL);
        } catch (error) {
          console.error("Error fetching hero image URL:", error);
        }
      };
      fetchHeroImage();
    } else {
      setHeroImageUrl(null);
    }
  }, [project]);

  return (
    <div
      className="public-project-card"
      style={{
        cursor: 'pointer',
        backgroundColor: 'var(--color-surface)',
        borderRadius: '4px',
        overflow: 'hidden',
        transition: 'all 0.3s ease',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        pointerEvents: 'auto'
      }}
      onClick={() => navigate(`/projetos/${project.id}`)}
      onMouseEnter={(e) => {
        const title = e.currentTarget.querySelector('.card-title');
        if (title) title.style.color = 'var(--color-accent-gold)';
        const img = e.currentTarget.querySelector('.card-image');
        if (img) img.style.transform = 'scale(1.02)';
      }}
      onMouseLeave={(e) => {
        const title = e.currentTarget.querySelector('.card-title');
        if (title) title.style.color = 'var(--color-black)';
        const img = e.currentTarget.querySelector('.card-image');
        if (img) img.style.transform = 'scale(1)';
      }}
    >
      <div style={{ height: '240px', overflow: 'hidden', position: 'relative' }}>
        {heroImageUrl && !imgError ? (
          <img
            className="card-image"
            src={heroImageUrl}
            alt={project.name}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transition: 'transform 0.5s ease'
            }}
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="image-placeholder">Em Breve</div>
        )}

        {/* Badges Overlay */}
        <div style={{ position: 'absolute', top: '1rem', left: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {project.location?.neighborhood && (
            <span className="badge badge-dark">
              {getLocalizedText(project.location.neighborhood, language)}
            </span>
          )}
          {project.status && (
            <span className="badge badge-gold">
              {getLocalizedText(project.status, language)}
            </span>
          )}
        </div>
      </div>

      <div style={{ padding: '1rem 0', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <h3 className="card-title" style={{ margin: '0 0 0.25rem 0', color: 'var(--color-black)', fontSize: '1.25rem', transition: 'color 0.3s ease', fontWeight: '600' }}>
          {project.name || 'Sem Título'}
        </h3>
        <p style={{ margin: '0 0 1rem 0', color: 'var(--color-text-muted)', fontSize: '0.95rem' }}>
          {project.developer || 'Construtora não informada'}
        </p>
      </div>
    </div>
  );
};

const PublicHome = () => {
  const { language } = useLanguage();
  const [projects, setProjects] = useState([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const [filterBairro, setFilterBairro] = useState('All');

  useEffect(() => {
    const event = new CustomEvent('catalogDrawerStateChange', { detail: { isDrawerOpen } });
    window.dispatchEvent(event);

    return () => {
      window.dispatchEvent(new CustomEvent('catalogDrawerStateChange', { detail: { isDrawerOpen: false } }));
    };
  }, [isDrawerOpen]);

  useEffect(() => {
    const projectsRef = collection(db, 'projects');
    const unsubscribe = onSnapshot(projectsRef, (snapshot) => {
      const projectsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).filter(p => p.resolution_state !== 'staged');

      setProjects(projectsData);
    });

    return () => unsubscribe();
  }, []);

  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      if (filterBairro === 'All') return true;
      const neighborhood = getLocalizedText(p.location?.neighborhood, language);
      return neighborhood && neighborhood.toLowerCase() === filterBairro.toLowerCase();
    });
  }, [projects, filterBairro, language]);

  return (
    <div className="public-home fade-in" style={{ pointerEvents: 'none' }}>
      {/* Top Floating Header */}
      <header style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 40, padding: '1.5rem', textAlign: 'center', pointerEvents: 'auto', backdropFilter: 'blur(10px)', backgroundColor: 'rgba(17, 17, 17, 0.7)' }}>
        <h1 style={{ color: 'white', fontSize: '1.5rem', margin: 0, fontFamily: 'var(--font-serif)', letterSpacing: '0.05em' }}>
          O Exclusivo de João Pessoa
        </h1>
        <span className="text-sm font-medium text-gray-300">{filteredProjects.length} Empreendimentos Premium</span>
      </header>

      {/* Bottom Floating Toggle Button */}
      <button
        onClick={() => setIsDrawerOpen(!isDrawerOpen)}
        style={{
          position: 'fixed', bottom: '2rem', left: isDrawerOpen ? 'calc(50% - 200px)' : '50%', transform: 'translateX(-50%)', zIndex: 50,
          pointerEvents: 'auto', borderRadius: '9999px', padding: '0.75rem 2rem',
          backgroundColor: 'var(--color-black)', color: 'white', boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          fontFamily: 'var(--font-sans)', fontWeight: 500, fontSize: '1rem', border: '1px solid rgba(255,255,255,0.1)',
          transition: 'left 0.3s ease-in-out'
        }}
      >
        {isDrawerOpen ? '🗺️ Ver Mapa' : '≡ Ver Lista'}
      </button>

      {/* Off-Canvas Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, height: '100vh', width: '100%', maxWidth: '400px',
        backgroundColor: 'var(--color-surface)', zIndex: 45,
        transform: isDrawerOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.3s ease-in-out', overflowY: 'auto', pointerEvents: 'auto',
        padding: '6rem 1.5rem 2rem', boxShadow: '-4px 0 15px rgba(0,0,0,0.1)'
      }}>
        {/* Filters */}
        <div style={{ marginBottom: '2rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <strong style={{ fontSize: '1.1rem', fontFamily: 'var(--font-sans)', color: 'var(--color-black)', width: '100%', marginBottom: '0.5rem' }}>Filtrar por Região:</strong>
          {['All', 'Cabo Branco', 'Tambaú', 'Manaíra', 'Bessa'].map(bairro => (
            <button
              key={bairro}
              onClick={() => setFilterBairro(bairro)}
              style={{
                padding: '0.5rem 1.25rem',
                borderRadius: '9999px',
                border: filterBairro === bairro ? '1px solid var(--color-accent-gold)' : '1px solid #e5e7eb',
                backgroundColor: filterBairro === bairro ? 'var(--color-accent-gold)' : 'transparent',
                color: filterBairro === bairro ? 'white' : 'var(--color-text-main)',
                fontFamily: 'var(--font-sans)',
                fontWeight: filterBairro === bairro ? '500' : '400',
                pointerEvents: 'auto'
              }}
            >
              {bairro === 'All' ? 'Todos' : bairro}
            </button>
          ))}
        </div>

        {/* Unified Grid */}
        <div className="grid grid-cols-1 gap-6">
          {filteredProjects.map(project => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>

        {filteredProjects.length === 0 && (
          <div style={{ padding: '2rem 0', textAlign: 'center' }}>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '1.1rem' }}>Nenhum projeto encontrado para esta região.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PublicHome;
