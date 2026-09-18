const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/PublicProjectDetail.jsx', 'utf8');
const replacement = `if (!project) return (
    <div className="public-project-detail fade-in" style={{ backgroundColor: 'var(--color-bg)', minHeight: '100vh', pointerEvents: 'auto', maxWidth: '1400px', margin: '0 auto', padding: '2rem' }}>
      <div
        style={{
          width: '100%',
          height: '350px',
          borderRadius: '12px',
          backgroundColor: 'transparent',
          background: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.8) 100%)',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          color: 'white',
          padding: '4rem 2rem',
          boxSizing: 'border-box',
          overflow: 'hidden'
        }}
      >
        <div style={{ position: 'relative', zIndex: 2, maxWidth: '1200px', width: '100%', margin: '0 auto' }}>
          <h1 style={{ color: 'white', fontSize: '4rem', marginBottom: '0.5rem', fontFamily: 'var(--font-serif)', textShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
            Mock Project
          </h1>
          <p style={{ fontSize: '1.5rem', fontFamily: 'var(--font-sans)', fontWeight: '300', margin: 0, textShadow: '0 2px 4px rgba(0,0,0,0.5)', color: '#e5e7eb' }}>
            Por Mock Developer
          </p>
        </div>
      </div>

      <div style={{ paddingTop: '2rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem', marginBottom: '3rem' }}>
          <div style={{
            backgroundColor: 'var(--color-surface)',
            padding: '3rem',
            borderRadius: '4px',
            border: '1px solid #e5e7eb'
          }}>
            <h2 style={{ fontSize: '2rem', marginBottom: '2rem', borderBottom: '1px solid #eaeaea', paddingBottom: '1rem', fontFamily: 'var(--font-serif)' }}>Ficha Técnica</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
              <div style={{ backgroundColor: '#f9fafb', padding: '1.5rem', borderRadius: '8px', border: '1px solid #eaeaea' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <FaBuilding size={16} color="var(--color-accent-gold)" />
                  <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Construtora</p>
                </div>
                <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: '500', color: 'var(--color-black)' }}>Mock Developer</p>
              </div>
              <div style={{ backgroundColor: '#f9fafb', padding: '1.5rem', borderRadius: '8px', border: '1px solid #eaeaea' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <FaInfoCircle size={16} color="var(--color-accent-gold)" />
                  <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</p>
                </div>
                <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: '500', color: 'var(--color-black)' }}>Em Construção</p>
              </div>
              <div style={{ backgroundColor: '#f9fafb', padding: '1.5rem', borderRadius: '8px', border: '1px solid #eaeaea' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <FaCalendarAlt size={16} color="var(--color-accent-gold)" />
                  <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Entrega Prevista</p>
                </div>
                <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: '500', color: 'var(--color-black)' }}>12/12/2025</p>
              </div>
              <div style={{ backgroundColor: '#f9fafb', padding: '1.5rem', borderRadius: '8px', border: '1px solid #eaeaea' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <FaMapMarkerAlt size={16} color="var(--color-accent-gold)" />
                  <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Localização</p>
                </div>
                <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: '500', color: 'var(--color-black)' }}>Mock Neighborhood</p>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2rem', borderBottom: '2px solid var(--color-black)', paddingBottom: '1rem' }}>
            <h2 style={{ fontSize: '2.5rem', margin: 0, fontFamily: 'var(--font-serif)' }}>Smart Canvas</h2>
            <p style={{ color: 'var(--color-text-muted)', margin: 0, fontWeight: '500' }}>0 Unidades Disponíveis</p>
          </div>

          <div style={{ textAlign: 'center', padding: '4rem', backgroundColor: '#faf9f6', borderRadius: '8px', border: '1px solid #eaddcf' }}>
            <p style={{ fontSize: '1.1rem', color: 'var(--color-charcoal)', marginBottom: '2rem' }}>
              As unidades e valores detalhados deste empreendimento estão sob consulta exclusiva.
            </p>
            <button
              onClick={() => {}}
              style={{
                backgroundColor: 'var(--color-accent-gold)',
                color: 'white',
                padding: '0.75rem 1.5rem',
                borderRadius: '4px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: '500',
                fontSize: '1rem',
                transition: 'background-color 0.2s'
              }}
            >
              Solicitar Tabela de Preços ao Concierge
            </button>
          </div>
        </div>
      </div>
    </div>
  );`;
code = code.replace('if (!project) return null;', replacement);
fs.writeFileSync('frontend/src/pages/PublicProjectDetail.jsx', code);
