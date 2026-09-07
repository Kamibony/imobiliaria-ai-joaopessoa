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
    if (project?.assets?.hero_images && project.assets.hero_images.length > 0) {
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
    }
  }, [project]);

  return (
    <div
      className="public-project-card"
      style={{
        cursor: 'pointer',
        minWidth: '320px',
        backgroundColor: 'var(--color-surface)',
        border: '1px solid #eaeaea',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
        transition: 'transform 0.3s ease, box-shadow 0.3s ease',
        display: 'flex',
        flexDirection: 'column'
      }}
      onClick={() => navigate(`/projetos/${project.id}`)}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-5px)';
        e.currentTarget.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.1)';
        const img = e.currentTarget.querySelector('.card-image');
        if (img) img.style.transform = 'scale(1.05)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.05)';
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

      <div style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--color-black)', fontSize: '1.25rem' }}>
          {project.name || 'Sem Título'}
        </h3>
        <p style={{ margin: '0 0 1rem 0', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
          Por {project.developer || 'Construtora não informada'}
        </p>

        <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid #eaeaea', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.9rem', fontWeight: '500', color: 'var(--color-black)' }}>Explorar Projeto</span>
          <span style={{ color: 'var(--color-accent-gold)' }}>&rarr;</span>
        </div>
      </div>
    </div>
  );
};

const PublicHome = () => {
  const { language } = useLanguage();
  const [projects, setProjects] = useState([]);
  const [featuredProject, setFeaturedProject] = useState(null);
  const [featuredImageUrl, setFeaturedImageUrl] = useState(null);
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
      const featured = projectsData.find(p => p.assets?.hero_images?.length > 0);
      if (featured) {
        setFeaturedProject(featured);
      } else if (projectsData.length > 0) {
        setFeaturedProject(projectsData[0]);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (featuredProject?.assets?.hero_images && featuredProject.assets.hero_images.length > 0) {
      const fetchHeroImage = async () => {
        try {
          const storage = getStorage();
          const fileRef = ref(storage, featuredProject.assets.hero_images[0]);
          const downloadURL = await getDownloadURL(fileRef);
          setFeaturedImageUrl(downloadURL);
        } catch (error) {
          console.error("Error fetching hero image URL:", error);
        }
      };
      fetchHeroImage();
    }
  }, [featuredProject]);

  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      if (filterBairro === 'All') return true;
      const neighborhood = getLocalizedText(p.location?.neighborhood, language);
      return neighborhood && neighborhood.toLowerCase() === filterBairro.toLowerCase();
    });
  }, [projects, filterBairro, language]);

  return (
    <div className="public-home fade-in">
      {/* Hero Section */}
      <div
        className="hero-section"
        style={{
          height: '80vh',
          backgroundColor: 'var(--color-black)',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          textAlign: 'center',
          overflow: 'hidden'
        }}
      >
        {featuredImageUrl ? (
          <img
            src={featuredImageUrl}
            alt={featuredProject?.name}
            style={{
              position: 'absolute',
              top: 0, left: 0, width: '100%', height: '100%',
              objectFit: 'cover', opacity: 0.4
            }}
          />
        ) : (
          <div style={{
            position: 'absolute',
            top: 0, left: 0, width: '100%', height: '100%',
            background: 'linear-gradient(135deg, #1c1c1c 0%, #2c2c2c 100%)', opacity: 0.8
          }} />
        )}

        <div style={{ position: 'relative', zIndex: 1, padding: '2rem', maxWidth: '800px' }}>
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
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-accent-gold-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-accent-gold)'}
            >
              Descobrir {featuredProject.name}
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: '4rem 2rem', maxWidth: '1400px', margin: '0 auto' }}>
        {/* Filters */}
        <div style={{ marginBottom: '3rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <strong style={{ fontSize: '1.1rem', fontFamily: 'var(--font-serif)', color: 'var(--color-text-main)' }}>Filtrar por Região:</strong>
          {['All', 'Cabo Branco', 'Tambaú', 'Manaíra', 'Bessa'].map(bairro => (
            <button
              key={bairro}
              onClick={() => setFilterBairro(bairro)}
              style={{
                padding: '0.5rem 1.25rem',
                borderRadius: '9999px',
                border: filterBairro === bairro ? `1px solid var(--color-black)` : '1px solid #d1d5db',
                backgroundColor: filterBairro === bairro ? 'var(--color-black)' : 'transparent',
                color: filterBairro === bairro ? 'white' : 'var(--color-text-main)',
                fontFamily: 'var(--font-sans)',
                fontWeight: filterBairro === bairro ? '500' : '400',
              }}
            >
              {bairro === 'All' ? 'Todos' : bairro}
            </button>
          ))}
        </div>

        {/* Curated Rows */}
        <div style={{ marginBottom: '5rem' }}>
          <h2 style={{ marginBottom: '2rem', borderBottom: '1px solid #eaeaea', paddingBottom: '1rem' }}>Destaques do Mês</h2>
          <div style={{ display: 'flex', overflowX: 'auto', gap: '2rem', paddingBottom: '2rem', paddingLeft: '0.5rem', paddingRight: '0.5rem', scrollSnapType: 'x mandatory' }}>
            {filteredProjects.slice(0, 5).map(project => (
              <div key={project.id} style={{ scrollSnapAlign: 'start' }}>
                <ProjectCard project={project} />
              </div>
            ))}
            {filteredProjects.length === 0 && (
              <p style={{ color: 'var(--color-text-muted)' }}>Nenhum projeto encontrado para esta região.</p>
            )}
          </div>
        </div>

        <div>
          <h2 style={{ marginBottom: '2rem', borderBottom: '1px solid #eaeaea', paddingBottom: '1rem' }}>Oportunidades para Investidores</h2>
          <div style={{ display: 'flex', overflowX: 'auto', gap: '2rem', paddingBottom: '2rem', paddingLeft: '0.5rem', paddingRight: '0.5rem', scrollSnapType: 'x mandatory' }}>
            {filteredProjects.slice(5, 10).map(project => (
              <div key={project.id} style={{ scrollSnapAlign: 'start' }}>
                <ProjectCard project={project} />
              </div>
            ))}
            {filteredProjects.length <= 5 && (
              <p style={{ color: 'var(--color-text-muted)' }}>Explore nossos destaques acima para encontrar as melhores oportunidades.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicHome;
