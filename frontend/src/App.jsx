import { useState, useEffect, useMemo } from 'react'
import { collection, onSnapshot, addDoc, deleteDoc, doc } from 'firebase/firestore'
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { db, auth } from './firebase'
import './App.css'

const PropertyCard = ({ property, latestSnapshot }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const aiContext = property.ai_context;

  return (
    <div className="property-card">
      <h3>{property.basic_info?.title || 'Sem Título'}</h3>
      <p><strong>Construtora:</strong> {property.basic_info?.developer || 'N/A'}</p>
      <p><strong>Bairro:</strong> {property.location?.neighborhood || 'N/A'}</p>
      {latestSnapshot ? (
        <>
          <p><strong>Preço:</strong> {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(latestSnapshot.price_brl || 0)}</p>
          <p><strong>Status:</strong> {latestSnapshot.status || 'N/A'}</p>
        </>
      ) : (
        <p><em>Sem dados financeiros/status no momento</em></p>
      )}

      <button className="expand-btn" onClick={() => setIsExpanded(!isExpanded)}>
        {isExpanded ? 'Ocultar Detalhes' : 'Ver Detalhes'}
      </button>

      {isExpanded && (
        <div className="expanded-details">
          <h4>Detalhes Físicos</h4>
          <p><strong>Área:</strong> {property.features?.area_m2 ? `${property.features.area_m2} m²` : 'N/A'}</p>
          <p><strong>Quartos:</strong> {property.features?.bedrooms || 'N/A'}</p>
          <p><strong>Posição Solar:</strong> {property.features?.sun_orientation || 'N/A'}</p>
          <p><strong>Distância do Mar:</strong> {property.location?.distance_to_beach_meters != null ? `${property.location.distance_to_beach_meters} m` : 'N/A'}</p>

          {aiContext && (
            <div className="ai-insights">
              <h4>✨ AI Insights</h4>

              <div className="roi-badge">
                <strong>ROI Estimado:</strong> {aiContext.investment_roi_estimated_percent != null ? `${aiContext.investment_roi_estimated_percent}%` : 'N/A'}
              </div>

              {aiContext.target_persona && aiContext.target_persona.length > 0 && (
                <div className="persona-tags">
                  <strong>Público-alvo:</strong>
                  <div className="tags-container">
                    {aiContext.target_persona.map((persona, index) => (
                      <span key={index} className="persona-tag">{persona}</span>
                    ))}
                  </div>
                </div>
              )}

              {aiContext.local_advantage && (
                <div className="local-advantage-callout">
                  <span>💡</span>
                  <p>{aiContext.local_advantage}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

function App() {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')

  const [activeTab, setActiveTab] = useState('ingestao') // 'ingestao', 'catalogo', or 'fontes'
  const [token, setToken] = useState('')
  const [data, setData] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [properties, setProperties] = useState([])
  const [targetUrls, setTargetUrls] = useState([])
  const [newUrl, setNewUrl] = useState('')
  const [urlMessage, setUrlMessage] = useState('')

  const [filterBairro, setFilterBairro] = useState('All')
  const [filterStatus, setFilterStatus] = useState('All')

  const getStatusColor = (status) => {
    switch(status) {
      case 'na_planta': return '#dc143c'; // Crimson
      case 'em_construcao': return '#ff8c00'; // Orange
      case 'pronto': return '#28a745'; // Green
      default: return '#808080'; // Gray
    }
  }

  const createCustomIcon = (status) => {
    const color = getStatusColor(status);
    return L.divIcon({
      className: 'custom-marker',
      html: `<div style="background-color: ${color}; width: 100%; height: 100%; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.5);"></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
      popupAnchor: [0, -10]
    });
  };

  const getLatestSnapshot = (property) => {
    const snapshots = property.snapshots || [];
    const sortedSnapshots = [...snapshots].sort((a, b) => {
      const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
      const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
      return dateB - dateA;
    });
    return sortedSnapshots.length > 0 ? sortedSnapshots[0] : null;
  }

  const filteredProperties = useMemo(() => {
    return properties.filter(p => {
      const latestSnapshot = getLatestSnapshot(p);
      const bairroMatch = filterBairro === 'All' ||
                          (p.location?.neighborhood === filterBairro) ||
                          (p.location?.neighborhood === 'Tambaú' && filterBairro === 'Tambau') ||
                          (p.location?.neighborhood === 'Tambau' && filterBairro === 'Tambaú');
      const statusMatch = filterStatus === 'All' ||
                          (latestSnapshot && latestSnapshot.status === filterStatus);
      return bairroMatch && statusMatch;
    });
  }, [properties, filterBairro, filterStatus]);

  const renderFilterBar = () => (
    <div className="filter-bar">
      <div className="form-group inline">
        <label htmlFor="filterBairro">Bairro:</label>
        <select id="filterBairro" value={filterBairro} onChange={(e) => setFilterBairro(e.target.value)}>
          <option value="All">Todos</option>
          <option value="Cabo Branco">Cabo Branco</option>
          <option value="Tambau">Tambaú</option>
        </select>
      </div>
      <div className="form-group inline">
        <label htmlFor="filterStatus">Status:</label>
        <select id="filterStatus" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="All">Todos</option>
          <option value="na_planta">Na Planta</option>
          <option value="em_construcao">Em Construção</option>
          <option value="pronto">Pronto</option>
        </select>
      </div>
    </div>
  );

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) {
      setProperties([]);
      setTargetUrls([]);
      return;
    }

    // Listen to changes in the "properties" collection
    const propertiesRef = collection(db, 'properties');
    const unsubscribeProps = onSnapshot(propertiesRef, (snapshot) => {
      const propertiesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setProperties(propertiesData);
    });

    // Listen to changes in the "TargetURLs" collection
    const targetUrlsRef = collection(db, 'TargetURLs');
    const unsubscribeUrls = onSnapshot(targetUrlsRef, (snapshot) => {
      const urlsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setTargetUrls(urlsData);
    });

    // Cleanup subscription on unmount
    return () => {
      unsubscribeProps();
      unsubscribeUrls();
    };
  }, [user]);

  const handleAddUrl = async (e) => {
    e.preventDefault();
    setUrlMessage('');
    if (!newUrl) return;

    try {
      await addDoc(collection(db, 'TargetURLs'), { url: newUrl });
      setNewUrl('');
      setUrlMessage('URL adicionada com sucesso!');
    } catch (err) {
      console.error(err);
      setUrlMessage('Erro ao adicionar URL.');
    }
  };

  const handleDeleteUrl = async (id) => {
    try {
      await deleteDoc(doc(db, 'TargetURLs', id));
    } catch (err) {
      console.error(err);
      setUrlMessage('Erro ao deletar URL.');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      console.error(err);
      setAuthError('Falha no login. Verifique suas credenciais.');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAnalyzeAndSave = async () => {
    if (!token) {
      setMessage('Por favor, forneça um token Bearer.')
      return
    }
    if (!data) {
      setMessage('Por favor, forneça os dados do imóvel.')
      return
    }

    setLoading(true)
    setMessage('')

    try {
      const url = 'https://us-central1-imobiliaria-ai-joaopessoa.cloudfunctions.net/ingestPropertyData'

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ data })
      })

      if (response.ok) {
        const result = await response.json()
        setMessage(`Sucesso: ${result.message} (ID: ${result.propertyId})`)
        setData('') // clear data on success
      } else {
        const errorText = await response.text()
        setMessage(`Erro: ${response.status} - ${errorText}`)
      }
    } catch (err) {
      console.error(err)
      setMessage(`Erro: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  if (authLoading) {
    return <div className="admin-container"><p>Carregando...</p></div>;
  }

  if (!user) {
    return (
      <div className="admin-container">
        <h1>Login - Imobiliária AI</h1>
        <div className="card">
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="password">Senha</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {authError && <div className="message error">{authError}</div>}
            <button type="submit" className="submit-btn">Entrar</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-container">
      <h1>Imobiliária AI - Painel Administrativo</h1>
      <p className="subtitle">Ingestão de Dados e Time Machine</p>
      <button onClick={handleLogout} className="logout-btn" style={{ marginBottom: '1rem' }}>Sair</button>

      <div className="tabs">
        <button
          className={`tab-btn ${activeTab === 'ingestao' ? 'active' : ''}`}
          onClick={() => setActiveTab('ingestao')}
        >
          Ingestão (Upload)
        </button>
        <button
          className={`tab-btn ${activeTab === 'catalogo' ? 'active' : ''}`}
          onClick={() => setActiveTab('catalogo')}
        >
          Catálogo de Imóveis (Dashboard)
        </button>
        <button
          className={`tab-btn ${activeTab === 'fontes' ? 'active' : ''}`}
          onClick={() => setActiveTab('fontes')}
        >
          Fontes (URLs)
        </button>
        <button
          className={`tab-btn ${activeTab === 'mapa' ? 'active' : ''}`}
          onClick={() => setActiveTab('mapa')}
        >
          Mapa & Analytics
        </button>
      </div>

      {activeTab === 'ingestao' && (
        <div className="card">
          <div className="form-group">
            <label htmlFor="token">Token Bearer (Autorização)</label>
            <input
              type="password"
              id="token"
              placeholder="Insira o token seguro"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="data">Dados Desestruturados do Imóvel</label>
            <textarea
              id="data"
              placeholder="Cole aqui o texto bruto de PPT, PDF, WhatsApp ou sites..."
              value={data}
              onChange={(e) => setData(e.target.value)}
              rows={10}
            />
          </div>

          <button
            onClick={handleAnalyzeAndSave}
            disabled={loading}
            className="submit-btn"
          >
            {loading ? 'Analisando e Salvando...' : 'Analisar e Salvar'}
          </button>

          {message && (
            <div className={`message ${message.startsWith('Sucesso') ? 'success' : 'error'}`}>
              {message}
            </div>
          )}
        </div>
      )}

      {activeTab === 'catalogo' && (
        <div className="catalog-container">
          {renderFilterBar()}
          {filteredProperties.length === 0 ? (
            <p>Nenhum imóvel encontrado.</p>
          ) : (
            <div className="property-grid">
              {filteredProperties.map(property => {
                return (
                  <PropertyCard key={property.id} property={property} latestSnapshot={getLatestSnapshot(property)} />
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'fontes' && (
        <div className="card">
          <h2>Gerenciar URLs Alvo</h2>

          <form onSubmit={handleAddUrl} style={{ marginBottom: '2rem' }}>
            <div className="form-group">
              <label htmlFor="newUrl">Adicionar Nova URL</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="url"
                  id="newUrl"
                  placeholder="https://exemplo.com"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  required
                  style={{ flexGrow: 1 }}
                />
                <button type="submit" className="submit-btn" style={{ marginTop: 0, width: 'auto' }}>Adicionar</button>
              </div>
            </div>
            {urlMessage && <div className={`message ${urlMessage.includes('Erro') ? 'error' : 'success'}`}>{urlMessage}</div>}
          </form>

          <div style={{ textAlign: 'left' }}>
            <h3>URLs Cadastradas</h3>
            {targetUrls.length === 0 ? (
              <p>Nenhuma URL cadastrada.</p>
            ) : (
              <ul style={{ listStyleType: 'none', padding: 0 }}>
                {targetUrls.map((target) => (
                  <li key={target.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid #ccc' }}>
                    <span style={{ wordBreak: 'break-all', marginRight: '1rem' }}>{target.url}</span>
                    <button
                      onClick={() => handleDeleteUrl(target.id)}
                      style={{ backgroundColor: '#dc3545', color: 'white', padding: '0.4rem 0.8rem', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      Deletar
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {activeTab === 'mapa' && (
        <div className="card" style={{ padding: '1rem', width: '100%' }}>
          <h2>Mapa de Imóveis</h2>
          {renderFilterBar()}
          <div style={{ height: '400px', width: '100%', marginBottom: '2rem', zIndex: 0 }}>
            <MapContainer center={[-7.115, -34.863]} zoom={13} style={{ height: '100%', width: '100%', zIndex: 0 }}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {filteredProperties.filter(p => p.location?.coordinates?.lat && p.location?.coordinates?.lng).map(property => {
                const latestSnapshot = getLatestSnapshot(property);

                return (
                  <Marker
                    key={property.id}
                    position={[property.location.coordinates.lat, property.location.coordinates.lng]}
                    icon={createCustomIcon(latestSnapshot?.status)}
                  >
                    <Popup>
                      <strong>{property.basic_info?.title || 'Sem Título'}</strong><br />
                      {latestSnapshot ? (
                        <>
                          Preço: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(latestSnapshot.price_brl || 0)}<br />
                          Status: {latestSnapshot.status || 'N/A'}<br />
                        </>
                      ) : <>Sem preço<br /></> }
                      {property.ai_context?.investment_roi_estimated_percent != null && (
                        <span>ROI Estimado: {property.ai_context.investment_roi_estimated_percent}%</span>
                      )}
                    </Popup>
                  </Marker>
                )
              })}
            </MapContainer>
          </div>

          <h2>Analytics: Preço por m² (Média)</h2>
          <div style={{ height: '300px', width: '100%' }}>
            {(() => {
              const stats = {
                'Cabo Branco': { sum: 0, count: 0 },
                'Tambau': { sum: 0, count: 0 },
                'Tambaú': { sum: 0, count: 0 } // Handle accent variation
              };

              filteredProperties.forEach(property => {
                const neighborhood = property.location?.neighborhood;
                if (!neighborhood) return;

                const latestSnapshot = getLatestSnapshot(property);

                if (latestSnapshot && latestSnapshot.price_per_m2_brl && stats[neighborhood]) {
                  stats[neighborhood].sum += latestSnapshot.price_per_m2_brl;
                  stats[neighborhood].count += 1;
                }
              });

              const chartData = [
                {
                  name: 'Cabo Branco',
                  Media: stats['Cabo Branco'].count > 0 ? Math.round(stats['Cabo Branco'].sum / stats['Cabo Branco'].count) : 0
                },
                {
                  name: 'Tambaú',
                  Media: (stats['Tambau'].count + stats['Tambaú'].count) > 0 ? Math.round((stats['Tambau'].sum + stats['Tambaú'].sum) / (stats['Tambau'].count + stats['Tambaú'].count)) : 0
                }
              ];

              return (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(value) => `R$ ${value}`} />
                    <Tooltip formatter={(value) => [`R$ ${value}`, 'Média (R$/m²)']} />
                    <Legend />
                    <Bar dataKey="Media" fill="#8884d8" name="Média (R$/m²)" />
                  </BarChart>
                </ResponsiveContainer>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  )
}

export default App
