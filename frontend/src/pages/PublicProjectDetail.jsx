import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useLanguage, getLocalizedText } from '../LanguageContext';
import { useMapState } from '../MapStateContext';

const PublicProjectDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { flyToProject } = useMapState();
  const [project, setProject] = useState(null);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hoveredUnitId, setHoveredUnitId] = useState(null);

  useEffect(() => {
    const fetchProject = async () => {
      try {
        const docRef = doc(db, 'projects', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = { id: docSnap.id, ...docSnap.data() };
          setProject(data);
          const coords = data.coordinates || data.location?.coordinates;
          if (coords) {
            flyToProject(coords);
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
  }, [id, navigate, flyToProject]);

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
    return (
      <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: 'var(--color-bg)' }}>
        <p style={{ fontFamily: 'var(--font-sans)', color: 'var(--color-text-muted)', fontSize: '1.2rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          Carregando Projeto...
        </p>
      </div>
    );
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
    <div className="public-project-detail fade-in" style={{ pointerEvents: 'none' }}>
      {/* Header / Hero Image */}
      <div
        style={{
          width: '100vw',
          minHeight: '70vh',
          backgroundColor: 'transparent',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          color: 'white',
          padding: '4rem 2rem',
          boxSizing: 'border-box',
          marginLeft: 'calc(-50vw + 50%)',
          marginRight: 'calc(-50vw + 50%)',
          pointerEvents: 'none'
        }}
      >
        {/* Navbar-ish back button */}
        <div style={{ position: 'absolute', top: '2rem', left: '2rem', zIndex: 10, pointerEvents: 'auto' }}>
          <button
            onClick={() => navigate('/')}
            style={{
              background: 'rgba(0,0,0,0.5)',
              border: '1px solid rgba(255,255,255,0.2)',
              backdropFilter: 'blur(10px)',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1.25rem',
              borderRadius: '9999px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              fontSize: '0.8rem'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.8)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.5)'}
          >
            &larr; Voltar
          </button>
        </div>

        <div style={{ position: 'relative', zIndex: 2, maxWidth: '1200px', width: '100%', margin: '0 auto' }}>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
            {project.location?.neighborhood && (
              <span className="badge badge-gold" style={{ fontSize: '0.85rem' }}>
                {getLocalizedText(project.location.neighborhood, language)}
              </span>
            )}
            {project.status && (
              <span className="badge badge-dark" style={{ border: '1px solid rgba(255,255,255,0.2)', fontSize: '0.85rem' }}>
                {getLocalizedText(project.status, language)}
              </span>
            )}
          </div>
          <h1 style={{ color: 'white', fontSize: '4rem', marginBottom: '0.5rem', fontFamily: 'var(--font-serif)', textShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
            {project.name || 'Sem Título'}
          </h1>
          <p style={{ fontSize: '1.5rem', fontFamily: 'var(--font-sans)', fontWeight: '300', margin: 0, textShadow: '0 2px 4px rgba(0,0,0,0.5)', color: '#e5e7eb' }}>
            Por {project.developer || 'Construtora não informada'}
          </p>
        </div>
      </div>

      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '4rem 2rem', pointerEvents: 'none' }}>

        {/* Layout Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem', marginBottom: '5rem' }}>

          {/* General Info Card */}
          <div style={{
            backgroundColor: 'var(--color-surface)',
            padding: '3rem',
            borderRadius: '4px',
            border: '1px solid #e5e7eb',
            pointerEvents: 'auto'
          }}>
            <h2 style={{ fontSize: '2rem', marginBottom: '2rem', borderBottom: '1px solid #eaeaea', paddingBottom: '1rem', fontFamily: 'var(--font-serif)' }}>Ficha Técnica</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
              <div>
                <p style={{ margin: '0 0 0.5rem 0', color: 'var(--color-text-muted)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Construtora</p>
                <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: '500', color: 'var(--color-black)' }}>{project.developer || 'N/A'}</p>
              </div>
              <div>
                <p style={{ margin: '0 0 0.5rem 0', color: 'var(--color-text-muted)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</p>
                <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: '500', color: 'var(--color-black)' }}>{getLocalizedText(project.status, language) || 'N/A'}</p>
              </div>
              <div>
                <p style={{ margin: '0 0 0.5rem 0', color: 'var(--color-text-muted)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Entrega Prevista</p>
                <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: '500', color: 'var(--color-black)' }}>
                  {project.delivery_date ? new Date(project.delivery_date).toLocaleDateString('pt-BR') : 'N/A'}
                </p>
              </div>
              <div>
                <p style={{ margin: '0 0 0.5rem 0', color: 'var(--color-text-muted)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Localização</p>
                <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: '500', color: 'var(--color-black)' }}>
                  {getLocalizedText(project.location?.neighborhood, language) || 'N/A'}
                </p>
              </div>
            </div>
          </div>

          {/* Amenities Card */}
          {Array.isArray(project.amenities) && project.amenities.length > 0 && (
            <div style={{
              backgroundColor: 'var(--color-surface)',
              padding: '3rem',
              borderRadius: '4px',
              border: '1px solid #e5e7eb',
              pointerEvents: 'auto'
            }}>
              <h2 style={{ fontSize: '2rem', marginBottom: '2rem', borderBottom: '1px solid #eaeaea', paddingBottom: '1rem', fontFamily: 'var(--font-serif)' }}>Comodidades</h2>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                {project.amenities.map((amenity, index) => (
                  <div key={index} style={{
                    color: 'var(--color-charcoal)',
                    fontSize: '1rem',
                    fontWeight: '400',
                  }}>
                    {amenity}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Smart Canvas Unit Grid */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2rem', borderBottom: '2px solid var(--color-black)', paddingBottom: '1rem', pointerEvents: 'auto' }}>
            <h2 style={{ fontSize: '2.5rem', margin: 0, fontFamily: 'var(--font-serif)' }}>Smart Canvas</h2>
            <p style={{ color: 'var(--color-text-muted)', margin: 0, fontWeight: '500' }}>{units.length} Unidades Disponíveis</p>
          </div>

          {units.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem', backgroundColor: 'var(--color-surface)', borderRadius: '16px', border: '1px dashed #ccc' }}>
              <p style={{ fontSize: '1.2rem', color: 'var(--color-text-muted)' }}>Nenhuma unidade catalogada para este empreendimento no momento.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '2rem' }}>
              {units.map(unit => {
                const latest = getLatestSnapshot(unit);
                const priceFormatted = latest && latest.price_brl ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(latest.price_brl) : 'Sob Consulta';
                const areaFormatted = unit.area_m2 ? `${unit.area_m2}m²` : 'Área N/A';

                return (
                  <div
                    key={unit.id}
                    style={{
                      position: 'relative',
                      border: '1px solid #e5e7eb',
                      borderRadius: '4px',
                      overflow: 'hidden',
                      backgroundColor: 'var(--color-surface)',
                      height: '280px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      alignItems: 'center',
                      transition: 'all 0.3s ease',
                      pointerEvents: 'auto'
                    }}
                    onMouseEnter={() => setHoveredUnitId(unit.id)}
                    onMouseLeave={() => setHoveredUnitId(null)}
                  >
                    {/* Default State */}
                    <div style={{ padding: '2rem', textAlign: 'center', transition: 'opacity 0.3s ease', opacity: hoveredUnitId === unit.id ? 0 : 1 }}>
                      <p style={{ margin: '0 0 1rem 0', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.85rem' }}>Unidade</p>
                      <div style={{ fontWeight: '600', fontSize: '3rem', color: 'var(--color-black)', fontFamily: 'var(--font-serif)', lineHeight: 1 }}>
                        {unit.unit_number || unit.id}
                      </div>
                      <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', justifyContent: 'center', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                        <span>{areaFormatted}</span>
                        <span>&bull;</span>
                        <span>{unit.bedrooms || '-'} Quartos</span>
                      </div>
                    </div>

                    {/* Hover State Overlay */}
                    <div
                      style={{
                        position: 'absolute',
                        top: 0, left: 0, width: '100%', height: '100%',
                        backgroundColor: 'rgba(17, 17, 17, 0.98)',
                        backdropFilter: 'blur(5px)',
                        color: 'white',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        opacity: hoveredUnitId === unit.id ? 1 : 0,
                        transition: 'opacity 0.3s ease-in-out',
                        padding: '2rem',
                        textAlign: 'center',
                        pointerEvents: hoveredUnitId === unit.id ? 'auto' : 'none'
                      }}
                    >
                      <div style={{ fontSize: '2rem', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--color-accent-gold)', fontFamily: 'var(--font-serif)' }}>
                        {priceFormatted}
                      </div>
                      <div style={{ fontSize: '1rem', marginBottom: '2rem', color: '#e5e7eb' }}>
                        {areaFormatted} &bull; {unit.bedrooms || '-'} Quartos
                      </div>

                      <button
                        onClick={() => handleWhatsAppContact(unit, priceFormatted)}
                        style={{
                          padding: '0.8rem 1.5rem',
                          fontSize: '0.95rem',
                          fontWeight: '600',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          cursor: 'pointer',
                          backgroundColor: 'var(--color-accent-gold)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-accent-gold-hover)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-accent-gold)'}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                        </svg>
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
