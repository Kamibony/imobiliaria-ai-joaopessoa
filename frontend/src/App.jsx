import ErrorBoundary from './ErrorBoundary';
import { LanguageProvider, useLanguage } from './LanguageContext';
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
          <p><strong>Preço:</strong> {!latestSnapshot.price_brl ? 'Sob Consulta' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(latestSnapshot.price_brl)}</p>
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


const LanguageToggle = () => {
  const { language, toggleLanguage } = useLanguage();
  return (
    <button onClick={toggleLanguage} style={{ padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', background: '#e0e0e0', border: '1px solid #ccc' }}>
      🌐 {language === 'pt-BR' ? 'Português (BR)' : 'English'}
    </button>
  );
};

function App() {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')

  const [activeTab, setActiveTab] = useState('discovery')
    const [data, setData] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [properties, setProperties] = useState([])
  const [targetUrls, setTargetUrls] = useState([])
  const [newUrl, setNewUrl] = useState('')
  const [urlMessage, setUrlMessage] = useState('')

  const [discoverySources, setDiscoverySources] = useState([]);
  const [newSource, setNewSource] = useState('');
  const [sourceMessage, setSourceMessage] = useState('');

  const [triageItems, setTriageItems] = useState([]);
  const [triageMessage, setTriageMessage] = useState('');

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

    // Listen to changes in the "DiscoverySources" collection
    const discoverySourcesRef = collection(db, 'DiscoverySources');
    const unsubscribeSources = onSnapshot(discoverySourcesRef, (snapshot) => {
      const sourcesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setDiscoverySources(sourcesData);
    });

    // Listen to changes in the "ReviewInbox" collection
    const reviewInboxRef = collection(db, 'ReviewInbox');
    const unsubscribeInbox = onSnapshot(reviewInboxRef, (snapshot) => {
      const inboxData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setTriageItems(inboxData.filter(item => item.status === 'PENDING'));
    });

    // Cleanup subscription on unmount
    return () => {
      unsubscribeProps();
      unsubscribeUrls();
      unsubscribeSources();
      unsubscribeInbox();
    };
  }, [user]);

  const handleAddUrl = async (e) => {
    e.preventDefault();
    setUrlMessage('');
    if (!newUrl) return;

    try {
      const normalizedUrl = newUrl.trim().replace(/\/$/, "");
      await addDoc(collection(db, 'TargetURLs'), { url: normalizedUrl });
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

  const handleAddSource = async (e) => {
    e.preventDefault();
    setSourceMessage('');
    try {
      const normalizedSource = newSource.trim().replace(/\/$/, "");

      if (discoverySources.some(s => s.source === normalizedSource)) {
        setSourceMessage('Erro: Esta fonte já está cadastrada.');
        return;
      }

      await addDoc(collection(db, 'DiscoverySources'), { source: normalizedSource, type: 'URL' });
      setNewSource('');
      setSourceMessage('Sucesso: Fonte adicionada com sucesso.');
    } catch (error) {
      console.error("Error adding source:", error);
      setSourceMessage('Erro ao adicionar fonte.');
    }
  };

  const handleDeleteSource = async (id) => {
    try {
      await deleteDoc(doc(db, 'DiscoverySources', id));
    } catch (error) {
      console.error("Error deleting source:", error);
    }
  };

  const handleTriageAction = async (item, action) => {
    setTriageMessage('');
    let token = '';
    try {
      token = await auth.currentUser.getIdToken();
    } catch (e) {
      setTriageMessage('Erro de autenticação: Não foi possível obter o token.');
      return;
    }
    setTriageMessage('Processando...');
    try {
      const response = await fetch('https://us-central1-imobiliaria-ai-joaopessoa.cloudfunctions.net/processTriageAction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          id: item.id,
          action: action,
          type: item.type,
          url: item.url,
          new_hash: item.new_hash,
          raw_text: item.raw_text,
          image_base64: item.image_base64
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      setTriageMessage(`Sucesso: Ação ${action} processada para ${item.url}`);
    } catch (error) {
      console.error("Error processing triage action:", error);
      setTriageMessage(`Erro ao processar ação ${action}. Verifique o token.`);
    }
  };

  const handleAnalyzeAndSave = async () => {
    let token = '';
    try {
      token = await auth.currentUser.getIdToken();
    } catch (e) {
      setMessage('Erro de autenticação: Não foi possível obter o token.');
      return;
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <button onClick={handleLogout} className="logout-btn">Sair</button>
        <LanguageToggle />
      </div>

      <div className="tabs">
        <button
          className={`tab-btn ${activeTab === 'discovery' ? 'active' : ''}`}
          onClick={() => setActiveTab('discovery')}
        >
          Radar de Mercado
        </button>
        <button
          className={`tab-btn ${activeTab === 'triage' ? 'active' : ''}`}
          onClick={() => setActiveTab('triage')}
        >
          Caixa de Entrada
        </button>
        <button
          className={`tab-btn ${activeTab === 'catalogo-mapa' ? 'active' : ''}`}
          onClick={() => setActiveTab('catalogo-mapa')}
        >
          Catálogo & Mapa
        </button>
        <button
          className={`tab-btn ${activeTab === 'acoes-manuais' ? 'active' : ''}`}
          onClick={() => setActiveTab('acoes-manuais')}
        >
          Ações Manuais
        </button>
      </div>

      {activeTab === 'acoes-manuais' && (
        <>
          <div style={{ backgroundColor: '#f8f9fa', padding: '1rem', borderRadius: '8px', borderLeft: '4px solid #007bff', marginBottom: '1.5rem', color: '#555', fontSize: '0.95rem' }}>
            Ações Manuais: "Use estas ferramentas apenas para forçar extrações manuais de URLs específicas ou colar textos brutos."
          </div>
          <div className="card" style={{ marginBottom: '2rem' }}>
            <h2>Ingestão de Dados (Upload Manual)</h2>
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
        </>
      )}

      {activeTab === 'catalogo-mapa' && (
        <div className="catalog-container">
          <div style={{ backgroundColor: '#f8f9fa', padding: '1rem', borderRadius: '8px', borderLeft: '4px solid #007bff', marginBottom: '1.5rem', color: '#555', fontSize: '0.95rem' }}>
            Catálogo & Mapa: "Visualize e analise todos os imóveis verificados e processados."
          </div>
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

      {activeTab === 'discovery' && (
        <div className="card">
          <div style={{ backgroundColor: '#f8f9fa', padding: '1rem', borderRadius: '8px', borderLeft: '4px solid #007bff', marginBottom: '1.5rem', color: '#555', fontSize: '0.95rem' }}>
            Radar de Mercado: "Adicione os sites principais das construtoras. O robô monitorará essas fontes diariamente em busca de novos empreendimentos."
          </div>
          <h2>Fontes de Descoberta (Seed Domains)</h2>
          <p>Adicione URLs base para o Spider explorar (ex: massai.com.br/empreendimentos). O AI irá varrer e enviar possíveis novos projetos para o Triage Center.</p>
          <form onSubmit={handleAddSource} style={{ marginBottom: '2rem' }}>
            <div className="form-group">
              <label htmlFor="newSource">Adicionar Nova Fonte</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="url"
                  id="newSource"
                  placeholder="https://exemplo.com/imoveis"
                  value={newSource}
                  onChange={(e) => setNewSource(e.target.value)}
                  required
                  style={{ flexGrow: 1 }}
                />
                <button type="submit" className="submit-btn" style={{ marginTop: 0, width: 'auto' }}>Adicionar</button>
              </div>
            </div>
            {sourceMessage && <div className={`message ${sourceMessage.includes('Erro') ? 'error' : 'success'}`}>{sourceMessage}</div>}
          </form>

          <div style={{ textAlign: 'left' }}>
            <h3>Fontes Cadastradas</h3>
            {discoverySources.length === 0 ? (
              <p>Nenhuma fonte cadastrada.</p>
            ) : (
              <ul style={{ listStyleType: 'none', padding: 0 }}>
                {discoverySources.map((source) => (
                  <li key={source.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid #ccc' }}>
                    <span style={{ wordBreak: 'break-all', marginRight: '1rem' }}>{source.source}</span>
                    <button
                      onClick={() => handleDeleteSource(source.id)}
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

      {activeTab === 'triage' && (
        <div className="card" style={{ width: '100%', maxWidth: '1000px' }}>
          <div style={{ backgroundColor: '#f8f9fa', padding: '1rem', borderRadius: '8px', borderLeft: '4px solid #007bff', marginBottom: '1.5rem', color: '#555', fontSize: '0.95rem' }}>
            Caixa de Entrada: "Avalie as descobertas da IA. Aprovar um item iniciará a extração profunda de dados de forma automática."
          </div>
          <h2>HITL Triage Center (Review Inbox)</h2>
          <p>Revise novas descobertas e mudanças detectadas antes de processá-las.</p>



          {triageMessage && <div className={`message ${triageMessage.includes('Erro') ? 'error' : 'success'}`}>{triageMessage}</div>}

          <div style={{ display: 'flex', gap: '2rem', marginTop: '2rem', flexDirection: 'column' }}>

            {/* Queue A: Discoveries */}
            <div style={{ border: '1px solid #ddd', padding: '1rem', borderRadius: '8px' }}>
              <h3 style={{ color: '#2a5298', marginTop: 0 }}>Queue A: Novas Descobertas (Discovery)</h3>
              {triageItems.filter(i => i.type === 'DISCOVERY').length === 0 ? (
                <p>Nenhuma nova descoberta pendente.</p>
              ) : (
                <ul style={{ listStyleType: 'none', padding: 0, margin: 0 }}>
                  {triageItems.filter(i => i.type === 'DISCOVERY').map((item) => (
                    <li key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 0', borderBottom: '1px solid #eee' }}>
                      <div style={{ wordBreak: 'break-all', marginRight: '1rem', flexGrow: 1 }}>
                        <a href={item.url} target="_blank" rel="noreferrer" style={{ fontWeight: 'bold' }}>{item.url}</a>
                        <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.5rem' }}>
                          Detectado em: {item.created_at?.toDate().toLocaleString() || 'N/A'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => handleTriageAction(item, 'APPROVE')}
                          style={{ backgroundColor: '#28a745', color: 'white', padding: '0.4rem 0.8rem', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          Aprovar (Deep Scan)
                        </button>
                        <button
                          onClick={() => handleTriageAction(item, 'DISCARD')}
                          style={{ backgroundColor: '#dc3545', color: 'white', padding: '0.4rem 0.8rem', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          Descartar
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Queue B: Changes */}
            <div style={{ border: '1px solid #ddd', padding: '1rem', borderRadius: '8px' }}>
              <h3 style={{ color: '#d35400', marginTop: 0 }}>Queue B: Mudanças Detectadas (Temporal Memory)</h3>
              {triageItems.filter(i => i.type === 'CHANGE').length === 0 ? (
                <p>Nenhuma mudança pendente.</p>
              ) : (
                <ul style={{ listStyleType: 'none', padding: 0, margin: 0 }}>
                  {triageItems.filter(i => i.type === 'CHANGE').map((item) => (
                    <li key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '1rem 0', borderBottom: '1px solid #eee' }}>
                      <div style={{ wordBreak: 'break-all', marginRight: '1rem', flexGrow: 1 }}>
                        <a href={item.url} target="_blank" rel="noreferrer" style={{ fontWeight: 'bold' }}>{item.url}</a>
                        <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.5rem' }}>
                          Novo Hash: {item.new_hash?.substring(0, 8)}...<br/>
                          Detectado em: {item.created_at?.toDate().toLocaleString() || 'N/A'}
                        </div>
                        {item.image_base64 && (
                          <div style={{ marginTop: '0.5rem' }}>
                            <span style={{ fontSize: '0.8rem', backgroundColor: '#eee', padding: '0.2rem 0.4rem', borderRadius: '4px' }}>Screenshot Anexada</span>
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                         <button
                          onClick={() => handleTriageAction(item, 'APPROVE')}
                          style={{ backgroundColor: '#28a745', color: 'white', padding: '0.4rem 0.8rem', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          Aprovar (Atualizar Histórico)
                        </button>
                        <button
                          onClick={() => handleTriageAction(item, 'DISCARD')}
                          style={{ backgroundColor: '#dc3545', color: 'white', padding: '0.4rem 0.8rem', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          Descartar (Falso Positivo)
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

          </div>
        </div>
      )}



      {activeTab === 'catalogo-mapa' && (
        <div className="card" style={{ padding: '1rem', width: '100%' }}>
          <h2>Mapa de Imóveis</h2>
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
                          Preço: {!latestSnapshot.price_brl ? 'Sob Consulta' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(latestSnapshot.price_brl)}<br />
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

                if (latestSnapshot && latestSnapshot.price_per_m2_brl && latestSnapshot.price_per_m2_brl > 0 && stats[neighborhood]) {
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
