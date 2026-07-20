import ErrorBoundary from './ErrorBoundary';
import { LanguageProvider, useLanguage, getLocalizedText } from './LanguageContext';
import React, { useState, useEffect, useMemo } from 'react'
import { collection, onSnapshot, addDoc, deleteDoc, doc, getDocs } from 'firebase/firestore'
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth'
import { getStorage, ref, getDownloadURL } from 'firebase/storage'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { db, auth } from './firebase'
import PDFUploader from './components/PDFUploader';
import './App.css'

const ProjectDetailModal = ({ project, onClose, onVerifySource, onDelete }) => {
  const { language } = useLanguage();
  const [units, setUnits] = useState([]);
  const [loadingUnits, setLoadingUnits] = useState(true);

  useEffect(() => {
    if (!project || !project.id) return;
    const unitsRef = collection(db, 'projects', project.id, 'units');
    const unsubscribe = onSnapshot(unitsRef, (snapshot) => {
      const unitsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUnits(unitsData);
      setLoadingUnits(false);
    });
    return () => unsubscribe();
  }, [project]);

  if (!project) return null;

  const aiContext = project.ai_context;
  const targetPersonaRaw = aiContext ? getLocalizedText(aiContext.target_persona, language) : null;
  const targetPersona = Array.isArray(targetPersonaRaw) ? targetPersonaRaw : (typeof targetPersonaRaw === 'string' ? [targetPersonaRaw] : []);

  const getLatestSnapshot = (unit) => {
    const snapshots = unit.snapshots || [];
    const sortedSnapshots = [...snapshots].sort((a, b) => {
      const dateA = new Date(a.timestamp);
      const dateB = new Date(b.timestamp);
      return dateB - dateA;
    });
    return sortedSnapshots.length > 0 ? sortedSnapshots[0] : null;
  };

  return (
    <div className="audit-modal">
      <div className="audit-modal-content" style={{ width: '80%', maxWidth: '1000px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="audit-modal-header" style={{ padding: '1.5rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>{project.name || 'Sem Título'}</h2>
          <div>
            <button
              onClick={() => onDelete(project.id)}
              style={{ backgroundColor: '#dc2626', color: 'white', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', border: 'none', marginRight: '1rem', fontWeight: 'bold' }}
            >
              Excluir Empreendimento
            </button>
            <button onClick={onClose} className="close-btn" style={{ fontSize: '1.5rem' }}>✕</button>
          </div>
        </div>
        <div className="audit-modal-body" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '300px' }}>
              <h3>Detalhes do Empreendimento</h3>
              <p><strong>Construtora:</strong> {project.developer || 'N/A'}</p>
              <p><strong>Bairro:</strong> {getLocalizedText(project.location?.neighborhood, language) || 'N/A'}</p>
              <p><strong>Status:</strong> {getLocalizedText(project.status, language) || 'N/A'}</p>
              <p><strong>Entrega:</strong> {project.delivery_date ? new Date(project.delivery_date).toLocaleDateString() : 'N/A'}</p>
              {Array.isArray(project.amenities) && project.amenities.length > 0 && (
                <p><strong>Comodidades:</strong> {project.amenities.join(', ')}</p>
              )}
            </div>
            {aiContext && (
              <div style={{ flex: 1, minWidth: '300px' }} className="ai-insights">
                <h4>✨ AI Insights</h4>
                <div className="roi-badge">
                  <strong>ROI Estimado:</strong> {aiContext.investment_roi_estimated_percent != null ? `${aiContext.investment_roi_estimated_percent}%` : 'N/A'}
                </div>
                {targetPersona && targetPersona.length > 0 && (
                  <div className="persona-tags">
                    <strong>Público-alvo:</strong>
                    <div className="tags-container">
                      {targetPersona.map((persona, index) => (
                        <span key={index} className="persona-tag">{persona}</span>
                      ))}
                    </div>
                  </div>
                )}
                {aiContext.local_advantage && (
                  <div className="local-advantage-callout">
                    <span>💡</span>
                    <p>{getLocalizedText(aiContext.local_advantage, language)}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ marginTop: '2rem' }}>
            <h3>Inventário (Unidades)</h3>
            {loadingUnits ? (
              <p>Carregando unidades...</p>
            ) : units.length === 0 ? (
              <p>Nenhuma unidade encontrada para este empreendimento.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #ddd', textAlign: 'left', backgroundColor: '#f9fafb' }}>
                    <th style={{ padding: '12px' }}>Unidade</th>
                    <th style={{ padding: '12px' }}>Área (m²)</th>
                    <th style={{ padding: '12px' }}>Quartos</th>
                    <th style={{ padding: '12px' }}>Preço</th>
                    <th style={{ padding: '12px' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {units.map(unit => {
                    const latest = getLatestSnapshot(unit);
                    return (
                      <tr key={unit.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '12px' }}><strong>{unit.unit_number || unit.id}</strong></td>
                        <td style={{ padding: '12px' }}>{unit.area_m2 || '-'}</td>
                        <td style={{ padding: '12px' }}>{unit.bedrooms || '-'}</td>
                        <td style={{ padding: '12px' }}>
                          {latest && latest.price_brl ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(latest.price_brl) : 'Sob Consulta'}
                        </td>
                        <td style={{ padding: '12px' }}>
                          {latest && latest.source && (
                            <button
                              onClick={() => onVerifySource(latest.source)}
                              style={{ padding: '4px 8px', fontSize: '0.85em', cursor: 'pointer', backgroundColor: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', borderRadius: '4px' }}
                            >
                              Ver Fonte
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const ProjectCard = ({ project, onSelectProject }) => {
  const { language } = useLanguage();

  const hasBookData = project.amenities?.length > 0 || project.ai_context?.investment_roi_estimated_percent != null;
  const hasTabelaData = !!project.has_units;

  return (
    <div className="property-card" style={{ cursor: 'pointer' }} onClick={() => onSelectProject(project)}>
      <h3>{project.name || 'Sem Título'}</h3>
      <p><strong>Construtora:</strong> {project.developer || 'N/A'}</p>
      <p><strong>Bairro:</strong> {getLocalizedText(project.location?.neighborhood, language) || 'N/A'}</p>
      <p><strong>Status:</strong> {getLocalizedText(project.status, language) || 'N/A'}</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
        {!hasBookData && (
          <div style={{ padding: '0.2rem 0.5rem', backgroundColor: '#fff3cd', color: '#856404', borderRadius: '4px', fontSize: '0.8rem', display: 'inline-block', width: 'fit-content' }}>
            ⚠️ Aguardando Book do Projeto
          </div>
        )}

        {!hasTabelaData && (
          <div style={{ padding: '0.2rem 0.5rem', backgroundColor: '#f8d7da', color: '#721c24', borderRadius: '4px', fontSize: '0.8rem', display: 'inline-block', width: 'fit-content' }}>
            📄 Aguardando Tabela de Preços
          </div>
        )}
      </div>

      <div style={{ marginTop: '1rem', color: '#007bff', fontWeight: 'bold' }}>
        Ver Detalhes e Unidades ➔
      </div>
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
  const { language } = useLanguage();
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')

  const [activeTab, setActiveTab] = useState('upload')
  const [projects, setProjects] = useState([])
  const [pdfJobs, setPdfJobs] = useState([]);

  const [auditSourceUrl, setAuditSourceUrl] = useState(null)
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false)
  const [auditLoading, setAuditLoading] = useState(false)
  const [selectedProject, setSelectedProject] = useState(null)

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

  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      const bairroMatch = filterBairro === 'All' ||
                          (p.location?.neighborhood === filterBairro) ||
                          (p.location?.neighborhood === 'Tambaú' && filterBairro === 'Tambau') ||
                          (p.location?.neighborhood === 'Tambau' && filterBairro === 'Tambaú');
      const statusMatch = filterStatus === 'All' ||
                          p.status === filterStatus;
      return bairroMatch && statusMatch;
    });
  }, [projects, filterBairro, filterStatus]);

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
    const jobsRef = collection(db, 'pdf_jobs')
    const unsubscribe = onSnapshot(jobsRef, (snapshot) => {
      const jobsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      // Sort jobs by uploadedAt descending
      jobsData.sort((a, b) => {
         const dateA = a.uploadedAt?.toDate ? a.uploadedAt.toDate() : new Date(a.uploadedAt || 0);
         const dateB = b.uploadedAt?.toDate ? b.uploadedAt.toDate() : new Date(b.uploadedAt || 0);
         return dateB - dateA;
      });
      setPdfJobs(jobsData)
    })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (!user) {
      setProjects([]);
      return;
    }

    // Listen to changes in the "projects" collection
    const projectsRef = collection(db, 'projects');
    const unsubscribeProps = onSnapshot(projectsRef, (snapshot) => {
      const projectsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setProjects(projectsData);
    });

    // Cleanup subscription on unmount
    return () => {
      unsubscribeProps();
    };
  }, [user]);

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

  const handleDeleteJob = async (jobId) => {
    if (window.confirm('Tem certeza de que deseja excluir este registro? Isso apenas limpará o histórico, não os imóveis extraídos.')) {
      try {
        await deleteDoc(doc(db, 'pdf_jobs', jobId));
      } catch (err) {
        console.error("Erro ao excluir registro de job:", err);
        alert("Erro ao excluir. Verifique se você tem permissões de administrador.");
      }
    }
  };

  const handleDeleteProject = async (projectId) => {
    if (window.confirm('Tem certeza que deseja excluir este empreendimento e todas as suas unidades? Esta ação não pode ser desfeita.')) {
      try {
        const unitsRef = collection(db, 'projects', projectId, 'units');
        const unitsSnapshot = await getDocs(unitsRef);

        const deletePromises = unitsSnapshot.docs.map(unitDoc =>
          deleteDoc(doc(db, 'projects', projectId, 'units', unitDoc.id))
        );
        await Promise.all(deletePromises);

        await deleteDoc(doc(db, 'projects', projectId));
        setSelectedProject(null);
      } catch (err) {
        console.error("Erro ao excluir empreendimento:", err);
        alert("Erro ao excluir empreendimento. Verifique se você tem permissões de administrador.");
      }
    }
  };

  const handleVerifySource = async (sourcePath) => {
    try {
      setAuditLoading(true);
      setIsAuditModalOpen(true);
      const storage = getStorage();
      const fileRef = ref(storage, `b2b_pdfs/${sourcePath}`);
      const downloadURL = await getDownloadURL(fileRef);
      setAuditSourceUrl(downloadURL);
    } catch (error) {
      console.error("Error fetching PDF URL:", error);
      alert("Não foi possível carregar o arquivo fonte. Ele pode ter sido removido.");
      setIsAuditModalOpen(false);
    } finally {
      setAuditLoading(false);
    }
  };

  const closeAuditModal = () => {
    setIsAuditModalOpen(false);
    setAuditSourceUrl(null);
  };

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
          className={`tab-btn ${activeTab === 'upload' ? 'active' : ''}`}
          onClick={() => setActiveTab('upload')}
        >
          Upload B2B PDF
        </button>
        <button
          className={`tab-btn ${activeTab === 'catalogo-mapa' ? 'active' : ''}`}
          onClick={() => setActiveTab('catalogo-mapa')}
        >
          Catálogo & Mapa
        </button>
      </div>

      {activeTab === 'upload' && (
        <>
          <div style={{ backgroundColor: '#f8f9fa', padding: '1rem', borderRadius: '8px', borderLeft: '4px solid #007bff', marginBottom: '1.5rem', color: '#555', fontSize: '0.95rem' }}>
            Upload B2B PDF: Faça upload de Tabelas de Preço ou Books B2B para ingestão automatizada na base de dados.
          </div>
          <div className="card" style={{ marginBottom: '2rem' }}>
            <PDFUploader />
          </div>

          <div className="card">
            <h2>Pipeline Monitor</h2>
            <p>Acompanhe o status de extração de dados dos documentos PDF enviados.</p>
            {pdfJobs.length === 0 ? (
              <p style={{ color: '#666', fontStyle: 'italic' }}>Nenhum upload registrado.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f4f4f4', borderBottom: '2px solid #ddd' }}>
                    <th style={{ padding: '10px', textAlign: 'left' }}>Documento</th>
                    <th style={{ padding: '10px', textAlign: 'left' }}>Status</th>
                    <th style={{ padding: '10px', textAlign: 'left' }}>Upload em</th>
                    <th style={{ padding: '10px', textAlign: 'left' }}>Erro (se houver)</th>
                    <th style={{ padding: '10px', textAlign: 'center' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {pdfJobs.map(job => (
                    <React.Fragment key={job.id}>
                      <tr style={{ borderBottom: job.status === 'Success' && job.stats ? 'none' : '1px solid #eee' }}>
                        <td style={{ padding: '10px', wordBreak: 'break-all' }}>{job.fileName}</td>
                        <td style={{ padding: '10px' }}>
                          <span style={{
                            padding: '4px 8px',
                            borderRadius: '12px',
                            fontSize: '0.85em',
                            fontWeight: 'bold',
                            backgroundColor: job.status === 'Success' ? '#d4edda' :
                                             job.status === 'Processing' ? '#fff3cd' :
                                             job.status === 'Failed' ? '#f8d7da' : '#e2e3e5',
                            color: job.status === 'Success' ? '#155724' :
                                   job.status === 'Processing' ? '#856404' :
                                   job.status === 'Failed' ? '#721c24' : '#383d41'
                          }}>
                            {job.status}
                          </span>
                        </td>
                        <td style={{ padding: '10px', fontSize: '0.9em' }}>
                          {job.uploadedAt?.toDate ? job.uploadedAt.toDate().toLocaleString() : 'N/A'}
                        </td>
                        <td style={{ padding: '10px', fontSize: '0.9em', color: '#dc3545' }}>
                          {job.error || '-'}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'center' }}>
                          <button
                            onClick={() => handleDeleteJob(job.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: '4px' }}
                            title="Excluir registro"
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                      {job.status === 'Success' && job.stats && (
                        <tr style={{ borderBottom: '1px solid #eee' }}>
                          <td colSpan="5" style={{ padding: '0 10px 15px 10px' }}>
                            <div style={{
                              display: 'flex', gap: '1rem', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0',
                              padding: '1rem', borderRadius: '8px', color: '#166534', fontSize: '0.9em'
                            }}>
                              <div style={{ flex: 1, textAlign: 'center' }}>
                                <div style={{ fontSize: '0.8em', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#15803d' }}>Unidades Extraídas</div>
                                <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{job.stats.total_units || 0}</div>
                              </div>
                              <div style={{ width: '1px', backgroundColor: '#bbf7d0' }}></div>
                              <div style={{ flex: 1, textAlign: 'center' }}>
                                <div style={{ fontSize: '0.8em', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#15803d' }}>VGV Estimado</div>
                                <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                                  {job.stats.total_inventory_value
                                    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(job.stats.total_inventory_value)
                                    : 'N/A'}
                                </div>
                              </div>
                              <div style={{ width: '1px', backgroundColor: '#bbf7d0' }}></div>
                              <div style={{ flex: 1, textAlign: 'center' }}>
                                <div style={{ fontSize: '0.8em', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#15803d' }}>Preço Médio / m²</div>
                                <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                                  {job.stats.avg_price_per_m2
                                    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(job.stats.avg_price_per_m2)
                                    : 'N/A'}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {activeTab === 'catalogo-mapa' && (
        <div className="catalog-container">
          <div style={{ backgroundColor: '#f8f9fa', padding: '1rem', borderRadius: '8px', borderLeft: '4px solid #007bff', marginBottom: '1.5rem', color: '#555', fontSize: '0.95rem' }}>
            Catálogo & Mapa: "Visualize e analise todos os imóveis verificados e processados."
          </div>
          {renderFilterBar()}
          {filteredProjects.length === 0 ? (
            <p>Nenhum imóvel encontrado.</p>
          ) : (
            <div className="property-grid">
              {filteredProjects.map(project => {
                return (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onSelectProject={setSelectedProject}
                  />
                );
              })}
            </div>
          )}
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
              {filteredProjects.filter(p => p.location?.coordinates?.lat && p.location?.coordinates?.lng).map(project => {
                return (
                  <Marker
                    key={project.id}
                    position={[project.location.coordinates.lat, project.location.coordinates.lng]}
                    icon={createCustomIcon(project.status || 'pronto')}
                  >
                    <Popup>
                      <strong>{project.name || 'Sem Título'}</strong><br />
                      <strong>Construtora:</strong> {project.developer || 'N/A'}<br />
                      <strong>Status:</strong> {getLocalizedText(project.status, language) || 'N/A'}<br />
                      {project.ai_context?.investment_roi_estimated_percent != null && (
                        <span>ROI Estimado: {project.ai_context.investment_roi_estimated_percent}%</span>
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

              filteredProjects.forEach(project => {
                const neighborhood = getLocalizedText(project.location?.neighborhood, language);
                if (!neighborhood) return;

                // Analytics logic will be updated later
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
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 14 }} dy={10} />
                    <YAxis
                      tickFormatter={(value) => `R$ ${value}`}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#6b7280', fontSize: 14 }}
                      dx={-10}
                    />
                    <Tooltip
                      formatter={(value) => [`R$ ${value}`, 'Média (R$/m²)']}
                      cursor={{ fill: '#f3f4f6' }}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                    />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    <Bar
                      dataKey="Media"
                      fill="#4F46E5"
                      name="Média (R$/m²)"
                      radius={[6, 6, 0, 0]}
                      activeBar={{ stroke: '#4338ca', strokeWidth: 2 }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              );
            })()}
          </div>
        </div>
      )}

      {selectedProject && (
        <ProjectDetailModal
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
          onVerifySource={handleVerifySource}
          onDelete={handleDeleteProject}
        />
      )}

      {isAuditModalOpen && (
        <div className="audit-modal">
          <div className="audit-modal-content">
            <div className="audit-modal-header">
              <h2>X-Ray Audit Mode</h2>
              <button onClick={closeAuditModal} className="close-btn">✕</button>
            </div>
            <div className="audit-modal-body">
              {auditLoading ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#fff' }}>Carregando documento original...</div>
              ) : auditSourceUrl ? (
                <iframe src={auditSourceUrl} title="PDF Source X-Ray" width="100%" height="100%" style={{ border: 'none', backgroundColor: '#333' }} />
              ) : (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#fff' }}>Erro ao carregar documento.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
