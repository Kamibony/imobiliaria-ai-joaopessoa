import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, onSnapshot } from 'firebase/firestore';
import { getStorage, ref, getDownloadURL } from 'firebase/storage';
import { db } from '../firebase';
import { useLanguage, getLocalizedText } from '../LanguageContext';

const PublicProjectDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const [project, setProject] = useState(null);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [heroImageUrl, setHeroImageUrl] = useState(null);
  const [hoveredUnitId, setHoveredUnitId] = useState(null);

  useEffect(() => {
    const fetchProject = async () => {
      try {
        const docRef = doc(db, 'projects', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = { id: docSnap.id, ...docSnap.data() };
          setProject(data);

          if (data.assets?.hero_images && data.assets.hero_images.length > 0) {
            const storage = getStorage();
            const fileRef = ref(storage, data.assets.hero_images[0]);
            const downloadURL = await getDownloadURL(fileRef);
            setHeroImageUrl(downloadURL);
          }
        } else {
          console.error("No such project!");
          navigate('/');
        }
      } catch (error) {
        console.error("Error fetching project:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProject();
  }, [id, navigate]);

  useEffect(() => {
    if (!id) return;
    const unitsRef = collection(db, 'projects', id, 'units');
    const unsubscribe = onSnapshot(unitsRef, (snapshot) => {
      const unitsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUnits(unitsData);
    });
    return () => unsubscribe();
  }, [id]);

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Carregando detalhes do projeto...</div>;
  }

  if (!project) return null;

  const getLatestSnapshot = (unit) => {
    if (unit.latest_snapshot) return unit.latest_snapshot;
    const snapshots = unit.snapshots || [];
    const sortedSnapshots = [...snapshots].sort((a, b) => {
      const dateA = new Date(a.timestamp);
      const dateB = new Date(b.timestamp);
      return dateB - dateA;
    });
    return sortedSnapshots.length > 0 ? sortedSnapshots[0] : null;
  };

  const handleWhatsAppContact = (unit, priceFormatted) => {
    const phoneNumber = '5583999999999'; // Dummy number as requested
    const message = `Olá, tenho interesse no apartamento ${unit.unit_number || unit.id} do empreendimento ${project.name || 'Sem Título'}, no valor de ${priceFormatted}.`;
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div className="public-project-detail" style={{ fontFamily: 'sans-serif' }}>
      {/* Header / Hero Image */}
      <div
        style={{
          width: '100%',
          height: '60vh',
          backgroundColor: '#1f2937',
          position: 'relative',
          display: 'flex',
          alignItems: 'flex-end',
          color: 'white',
          padding: '2rem'
        }}
      >
        {heroImageUrl && (
          <img
            src={heroImageUrl}
            alt={project.name}
            style={{
              position: 'absolute',
              top: 0, left: 0, width: '100%', height: '100%',
              objectFit: 'cover', opacity: 0.6
            }}
          />
        )}
        <div style={{ position: 'relative', zIndex: 1, padding: '1rem', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: '8px' }}>
          <button onClick={() => navigate('/')} style={{ marginBottom: '1rem', background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontWeight: 'bold' }}>
            ← Voltar para a Revista
          </button>
          <h1 style={{ fontSize: '3rem', margin: '0 0 0.5rem 0', textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}>
            {project.name || 'Sem Título'}
          </h1>
          <p style={{ fontSize: '1.25rem', margin: 0, textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}>
            {getLocalizedText(project.location?.neighborhood, language) || 'Bairro N/A'}
          </p>
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
        {/* Descriptive Text & Amenities */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', marginBottom: '3rem' }}>
          <div style={{ flex: 1, minWidth: '300px' }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#1f2937' }}>Detalhes do Empreendimento</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '1.1rem', color: '#4b5563' }}>
              <p><strong>Construtora:</strong> {project.developer || 'N/A'}</p>
              <p><strong>Status:</strong> {getLocalizedText(project.status, language) || 'N/A'}</p>
              <p><strong>Entrega:</strong> {project.delivery_date ? new Date(project.delivery_date).toLocaleDateString() : 'N/A'}</p>
            </div>
          </div>

          {Array.isArray(project.amenities) && project.amenities.length > 0 && (
            <div style={{ flex: 1, minWidth: '300px' }}>
              <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#1f2937' }}>Comodidades</h2>
              <ul style={{ listStyleType: 'disc', paddingLeft: '1.5rem', fontSize: '1.1rem', color: '#4b5563' }}>
                {project.amenities.map((amenity, index) => (
                  <li key={index} style={{ marginBottom: '0.25rem' }}>{amenity}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Smart Canvas Unit Grid */}
        <div>
          <h2 style={{ fontSize: '2rem', marginBottom: '1.5rem', color: '#1f2937' }}>Unidades Disponíveis</h2>
          {units.length === 0 ? (
            <p>Nenhuma unidade encontrada para este empreendimento.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
              {units.map(unit => {
                const latest = getLatestSnapshot(unit);
                const priceFormatted = latest && latest.price_brl ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(latest.price_brl) : 'Sob Consulta';
                const areaFormatted = unit.area_m2 ? `${unit.area_m2}m²` : '-';

                return (
                  <div
                    key={unit.id}
                    style={{
                      position: 'relative',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      backgroundColor: '#f9fafb',
                      height: '250px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      alignItems: 'center',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                    }}
                    onMouseEnter={() => setHoveredUnitId(unit.id)}
                    onMouseLeave={() => setHoveredUnitId(null)}
                  >
                    <div style={{ padding: '1rem', textAlign: 'center', color: '#6b7280' }}>
                      <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📐</div>
                      <div style={{ fontWeight: 'bold', fontSize: '1.25rem', color: '#374151' }}>Unidade {unit.unit_number || unit.id}</div>
                    </div>

                    <div
                      style={{
                        position: 'absolute',
                        top: 0, left: 0, width: '100%', height: '100%',
                        backgroundColor: 'rgba(17, 24, 39, 0.95)',
                        color: 'white',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        opacity: hoveredUnitId === unit.id ? 1 : 0,
                        transition: 'opacity 0.2s ease-in-out',
                        padding: '1.5rem',
                        textAlign: 'center',
                        pointerEvents: hoveredUnitId === unit.id ? 'auto' : 'none'
                      }}
                    >
                      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem', color: '#10b981' }}>{priceFormatted}</div>
                      <div style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>{areaFormatted} • {unit.bedrooms || '-'} Quartos</div>
                      <div style={{ fontSize: '1rem', color: '#9ca3af', marginBottom: '1.5rem' }}>Disponível</div>

                      <button
                        onClick={() => handleWhatsAppContact(unit, priceFormatted)}
                        style={{
                          padding: '0.75rem 1.5rem',
                          fontSize: '1rem',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          backgroundColor: '#25D366',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem'
                        }}
                      >
                        Falar com Corretor
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PublicProjectDetail;
