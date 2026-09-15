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
        {heroImageUrl ? (
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
  const [featuredProject, setFeaturedProject] = useState(null);

  const [filterBairro, setFilterBairro] = useState('All');
  const navigate = useNavigate();

  useEffect(() => {
    const projectsRef = collection(db, 'projects');
    const unsubscribe = onSnapshot(projectsRef, (snapshot) => {
      const projectsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).filter(p => p.resolution_state !== 'staged');

      setProjects(projectsData);

      // Prefer projects with actual hero images for the featured spot
      const featured = projectsData.find(p => p.manual_hero_image_url || (p.assets?.hero_images && p.assets.hero_images.length > 0));
      if (featured) {
        setFeaturedProject(featured);
      } else if (projectsData.length > 0) {
        setFeaturedProject(projectsData[0]);
      }
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
      {/* Hero Section */}
      <div
        className="hero-section"
        style={{
          width: '100vw',
          height: '80vh',
          backgroundColor: 'transparent',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          textAlign: 'center',
          overflow: 'hidden',
          marginLeft: 'calc(-50vw + 50%)',
          marginRight: 'calc(-50vw + 50%)',
          pointerEvents: 'none'
        }}
      >
        {/* Gradient Overlay */}
        <div
          style={{
            position: 'absolute',
            top: 0, left: 0, width: '100%', height: '100%',
            background: 'linear-gradient(to top, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0) 60%)',
            zIndex: 1,
            pointerEvents: 'none'
          }}
        />

        <div style={{ position: 'relative', zIndex: 2, padding: '2rem', maxWidth: '800px', pointerEvents: 'none' }}>
          <h1 style={{ color: 'white', marginBottom: '1.5rem', textShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
            O Exclusivo de João Pessoa
          </h1>
          <p style={{ fontSize: '1.25rem', fontFamily: 'var(--font-sans)', fontWeight: '300', margin: '0 auto 2.5rem', color: '#e5e7eb', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
            Uma curadoria premium dos melhores lançamentos e oportunidades de investimento imobiliário de alto padrão na região.
          </p>
          {featuredProject && (
            <button
              onClick={() => navigate(`/projetos/${featuredProject.id}`)}
              style={{
                padding: '1rem 2rem',
                fontSize: '1.1rem',
                backgroundColor: 'var(--color-accent-gold)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                pointerEvents: 'auto'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-accent-gold-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-accent-gold)'}
            >
              Descobrir {featuredProject.name}
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: '4rem 2rem', maxWidth: '1400px', margin: '0 auto', pointerEvents: 'none' }}>
        {/* Filters */}
        <div style={{ marginBottom: '3rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', pointerEvents: 'auto' }}>
          <strong style={{ fontSize: '1.1rem', fontFamily: 'var(--font-sans)', color: 'white' }}>Filtrar por Região:</strong>
          {['All', 'Cabo Branco', 'Tambaú', 'Manaíra', 'Bessa'].map(bairro => (
            <button
              key={bairro}
              onClick={() => setFilterBairro(bairro)}
              style={{
                padding: '0.5rem 1.25rem',
                borderRadius: '9999px',
                border: filterBairro === bairro ? '1px solid var(--color-accent-gold)' : '1px solid rgba(255,255,255,0.3)',
                backgroundColor: filterBairro === bairro ? 'var(--color-accent-gold)' : 'rgba(0,0,0,0.4)',
                color: 'white',
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProjects.map(project => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>

        {filteredProjects.length === 0 && (
          <div style={{ padding: '4rem 0', textAlign: 'center' }}>
            <p style={{ color: '#e5e7eb', fontSize: '1.1rem' }}>Nenhum projeto encontrado para esta região.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PublicHome;
