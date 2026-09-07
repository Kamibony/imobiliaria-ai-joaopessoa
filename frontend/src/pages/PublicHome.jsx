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
        minWidth: '300px',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        overflow: 'hidden',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
      }}
      onClick={() => navigate(`/projetos/${project.id}`)}
    >
      <div style={{ height: '200px', backgroundColor: '#f3f4f6', overflow: 'hidden' }}>
        {heroImageUrl ? (
          <img src={heroImageUrl} alt={project.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#9ca3af' }}>Sem Imagem</div>
        )}
      </div>
      <div style={{ padding: '1rem' }}>
        <h3 style={{ margin: '0 0 0.5rem 0' }}>{project.name || 'Sem Título'}</h3>
        <p style={{ margin: '0 0 0.25rem 0', color: '#4b5563' }}><strong>Construtora:</strong> {project.developer || 'N/A'}</p>
        <p style={{ margin: '0 0 0.25rem 0', color: '#4b5563' }}><strong>Bairro:</strong> {getLocalizedText(project.location?.neighborhood, language) || 'N/A'}</p>
        <p style={{ margin: 0, color: '#4b5563' }}><strong>Status:</strong> {getLocalizedText(project.status, language) || 'N/A'}</p>
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

      const featured = projectsData.find(p => p.assets?.hero_images?.length > 0);
      if (featured) {
        setFeaturedProject(featured);
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
    <div className="public-home" style={{ fontFamily: 'sans-serif' }}>
      {/* Hero Section */}
      <div
        className="hero-section"
        style={{
          height: '60vh',
          backgroundColor: '#1f2937',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          textAlign: 'center',
          overflow: 'hidden'
        }}
      >
        {featuredImageUrl && (
          <img
            src={featuredImageUrl}
            alt={featuredProject?.name}
            style={{
              position: 'absolute',
              top: 0, left: 0, width: '100%', height: '100%',
              objectFit: 'cover', opacity: 0.5
            }}
          />
        )}
        <div style={{ position: 'relative', zIndex: 1, padding: '2rem' }}>
          <h1 style={{ fontSize: '3rem', marginBottom: '1rem', textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}>
            Digital Magazine João Pessoa
          </h1>
          <p style={{ fontSize: '1.25rem', maxWidth: '600px', margin: '0 auto', textShadow: '1px 1px 2px rgba(0,0,0,0.5)' }}>
            Descubra os melhores lançamentos e oportunidades de investimento imobiliário na região.
          </p>
          {featuredProject && (
            <button
              onClick={() => navigate(`/projetos/${featuredProject.id}`)}
              style={{
                marginTop: '2rem', padding: '0.75rem 1.5rem', fontSize: '1rem', fontWeight: 'bold',
                backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer'
              }}
            >
              Ver Destaque: {featuredProject.name}
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Filters */}
        <div style={{ marginBottom: '2rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <strong style={{ fontSize: '1.1rem' }}>Filtrar por Bairro:</strong>
          {['All', 'Cabo Branco', 'Tambaú', 'Manaíra'].map(bairro => (
            <button
              key={bairro}
              onClick={() => setFilterBairro(bairro)}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '9999px',
                border: filterBairro === bairro ? 'none' : '1px solid #d1d5db',
                backgroundColor: filterBairro === bairro ? '#3b82f6' : 'white',
                color: filterBairro === bairro ? 'white' : '#374151',
                cursor: 'pointer',
                fontWeight: filterBairro === bairro ? 'bold' : 'normal'
              }}
            >
              {bairro === 'All' ? 'Todos' : bairro}
            </button>
          ))}
        </div>

        {/* Curated Rows */}
        <div style={{ marginBottom: '3rem' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Destaques do Mês</h2>
          <div style={{ display: 'flex', overflowX: 'auto', gap: '1.5rem', paddingBottom: '1rem' }}>
            {filteredProjects.slice(0, 5).map(project => (
              <ProjectCard key={project.id} project={project} />
            ))}
            {filteredProjects.length === 0 && <p>Nenhum projeto encontrado.</p>}
          </div>
        </div>

        <div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Oportunidades para Investidores</h2>
          <div style={{ display: 'flex', overflowX: 'auto', gap: '1.5rem', paddingBottom: '1rem' }}>
            {filteredProjects.slice(5, 10).map(project => (
              <ProjectCard key={project.id} project={project} />
            ))}
            {filteredProjects.length <= 5 && <p>Nenhum projeto adicional encontrado.</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicHome;
