import ErrorBoundary from '../ErrorBoundary';
import { LanguageProvider, useLanguage, getLocalizedText } from '../LanguageContext';
import React, { useState, useEffect, useMemo } from 'react'
import { collection, onSnapshot, deleteDoc, doc, getDocs, updateDoc, setDoc } from 'firebase/firestore'
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth'
import { getStorage, ref, getDownloadURL, uploadBytesResumable } from 'firebase/storage'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { db, auth } from '../firebase'
import PDFUploader from '../components/PDFUploader';
import '../App.css'

const ProjectDetailModal = ({ project, onClose, onVerifySource, onDelete }) => {
  const { language } = useLanguage();
  const [units, setUnits] = useState([]);
  const [loadingUnits, setLoadingUnits] = useState(true);
  const [heroImageUrl, setHeroImageUrl] = useState(null);
  const [hoveredUnitId, setHoveredUnitId] = useState(null);

  const [overrideImageUrl, setOverrideImageUrl] = useState(project?.manual_hero_image_url || '');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    if (project?.manual_hero_image_url) {
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

    setOverrideImageUrl(project?.manual_hero_image_url || '');
  }, [project]);

  const handleSaveOverrideImage = async () => {
    try {
      await updateDoc(doc(db, 'projects', project.id), {
        manual_hero_image_url: overrideImageUrl
      });
      alert('Hero Image atualizada com sucesso!');
    } catch (err) {
      console.error("Erro ao salvar Hero Image:", err);
      alert('Erro ao salvar imagem.');
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingImage(true);
    const storage = getStorage();
    const storageRef = ref(storage, `hero_images/${project.id}/${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadProgress(progress);
      },
      (error) => {
        console.error("Upload error:", error);
        alert('Falha no upload da imagem.');
        setUploadingImage(false);
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        setOverrideImageUrl(downloadURL);
        try {
          await updateDoc(doc(db, 'projects', project.id), {
            manual_hero_image_url: downloadURL
          });
          alert('Upload concluído e imagem atualizada!');
        } catch (err) {
          console.error("Erro ao salvar Hero Image após upload:", err);
          alert('Erro ao salvar URL da imagem após o upload.');
        } finally {
          setUploadingImage(false);
          setUploadProgress(0);
        }
      }
    );
  };

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
    // Utilize the pre-calculated latest_snapshot if available
    if (unit.latest_snapshot) return unit.latest_snapshot;

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
          {heroImageUrl && (
            <div style={{ width: '100%', marginBottom: '2rem', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
              <img src={heroImageUrl} alt="Project Hero Render" style={{ width: '100%', height: 'auto', maxHeight: '400px', objectFit: 'cover' }} />
            </div>
          )}

          <div style={{ marginBottom: '2rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Override de Hero Image</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Colar URL Externa:</label>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <input
                    type="text"
                    value={overrideImageUrl}
                    onChange={(e) => setOverrideImageUrl(e.target.value)}
                    placeholder="https://..."
                    style={{ flex: 1, padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                  />
                  <button
                    onClick={handleSaveOverrideImage}
                    style={{ padding: '0.5rem 1rem', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    Salvar URL
                  </button>
                </div>
              </div>
              <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Ou Fazer Upload (.jpg, .png):</label>
                <input
                  type="file"
                  accept="image/jpeg, image/png"
                  onChange={handleFileUpload}
                  disabled={uploadingImage}
                />
                {uploadingImage && <div style={{ marginTop: '0.5rem', color: '#007bff' }}>Upload: {Math.round(uploadProgress)}%</div>}
              </div>
            </div>
          </div>

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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1.5rem', marginTop: '1rem' }}>
                {units.map(unit => {
                  const latest = getLatestSnapshot(unit);
                  const priceFormatted = latest && latest.price_brl ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(latest.price_brl) : 'Sob Consulta';
                  const areaFormatted = unit.area_m2 ? `${unit.area_m2}m²` : '-';
                  const statusFormatted = 'Disponível';
                  return (
                    <div
                      key={unit.id}
                      style={{
                        position: 'relative',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        backgroundColor: '#f9fafb',
                        height: '200px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={() => setHoveredUnitId(unit.id)}
                      onMouseLeave={() => setHoveredUnitId(null)}
                    >
                      {/* Floor plan placeholder or image if available */}
                      <div style={{ padding: '1rem', textAlign: 'center', color: '#9ca3af' }}>
                        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📐</div>
                        <div style={{ fontWeight: 'bold', color: '#374151' }}>Unidade {unit.unit_number || unit.id}</div>
                      </div>

                      {/* Dynamic Hover Overlay */}
                      <div
                        className="unit-overlay"
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%',
                          backgroundColor: 'rgba(17, 24, 39, 0.9)',
                          color: 'white',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center',
                          alignItems: 'center',
                          opacity: hoveredUnitId === unit.id ? 1 : 0,
                          transition: 'opacity 0.2s ease-in-out',
                          padding: '1rem',
                          textAlign: 'center',
                          pointerEvents: hoveredUnitId === unit.id ? 'auto' : 'none'
                        }}
                      >
                        <div style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem', color: '#10b981' }}>{priceFormatted}</div>
                        <div style={{ fontSize: '0.9rem', marginBottom: '0.25rem' }}>{areaFormatted} • {unit.bedrooms || '-'} Quartos</div>
                        <div style={{ fontSize: '0.85rem', color: '#9ca3af', marginBottom: '1rem' }}>Status: {statusFormatted}</div>
                        {latest && latest.source && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onVerifySource(latest.source); }}
                            style={{ padding: '6px 12px', fontSize: '0.85em', cursor: 'pointer', backgroundColor: 'transparent', color: '#38bdf8', border: '1px solid #38bdf8', borderRadius: '4px' }}
                          >
                            Ver Fonte
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const ProjectCard = ({ project, onSelectProject }) => {
  const { language } = useLanguage();
  const [showImageOverride, setShowImageOverride] = useState(false);
  const [overrideImageUrl, setOverrideImageUrl] = useState(project?.manual_hero_image_url || '');

  const hasBookData = project.amenities?.length > 0 || project.ai_context?.investment_roi_estimated_percent != null;
  const hasTabelaData = !!project.has_units;

  const handleSaveOverrideImage = async (e) => {
    e.stopPropagation();
    try {
      await updateDoc(doc(db, 'projects', project.id), {
        manual_hero_image_url: overrideImageUrl
      });
      alert('Hero Image atualizada com sucesso!');
      setShowImageOverride(false);
    } catch (err) {
      console.error("Erro ao salvar Hero Image:", err);
      alert('Erro ao salvar imagem.');
    }
  };

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

      <div className="mt-4 pt-4 border-t border-gray-100" onClick={(e) => e.stopPropagation()}>
        {!showImageOverride ? (
          <button
            onClick={() => setShowImageOverride(true)}
            className="text-sm px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors w-full mb-2"
          >
            📸 Alterar Imagem de Capa
          </button>
        ) : (
          <div className="flex flex-col gap-2 mb-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <label className="text-xs font-semibold text-gray-600">URL da Imagem:</label>
            <input
              type="text"
              value={overrideImageUrl}
              onChange={(e) => setOverrideImageUrl(e.target.value)}
              placeholder="https://exemplo.com/imagem.jpg"
              className="text-sm p-2 rounded border border-gray-300 w-full"
            />
            <div className="flex gap-2">
              <button
                onClick={handleSaveOverrideImage}
                className="text-sm px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors flex-1"
              >
                Salvar URL
              </button>
              <button
                onClick={() => setShowImageOverride(false)}
                className="text-sm px-3 py-1 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: '0.5rem', color: '#007bff', fontWeight: 'bold' }}>
        Ver Detalhes e Unidades ➔
      </div>
    </div>
  );
};

const LanguageToggle = () => {
  const { language, toggleLanguage } = useLanguage();
  return (
    <button
      onClick={toggleLanguage}
      className="px-4 py-2 rounded-md font-medium bg-gray-100 text-gray-800 border border-gray-300 hover:bg-gray-200 transition-colors"
    >
      🌐 {language === 'pt-BR' ? 'Português (BR)' : 'English'}
    </button>
  );
};

function Admin() {
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
  const [mergeModalOpen, setMergeModalOpen] = useState(false)
  const [stagedProjectToMerge, setStagedProjectToMerge] = useState(null)
  const [selectedTargetMergeId, setSelectedTargetMergeId] = useState('')
  const [selectedProject, setSelectedProject] = useState(null)

  const [filterBairro, setFilterBairro] = useState('All')
  const [filterStatus, setFilterStatus] = useState('All')

  const normalizeStatus = (statusRaw, lang) => {
    const text = getLocalizedText(statusRaw, lang);
    if (!text || typeof text !== 'string') return 'unknown';
    const lower = text.toLowerCase().trim();
    if (lower.includes('na_planta') || lower.includes('na planta') || lower.includes('lançamento') || lower.includes('lancamento')) {
      return 'na_planta';
    }
    if (lower.includes('em_construcao') || lower.includes('construção') || lower.includes('construcao')) {
      return 'em_construcao';
    }
    if (lower.includes('pronto')) {
      return 'pronto';
    }
    return lower;
  };

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

  // eslint-disable-next-line no-unused-vars
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
      // Hide staged projects from the main catalog
      if (p.resolution_state === 'staged') return false;

      const bairroMatch = filterBairro === 'All' ||
                          (p.location?.neighborhood === filterBairro) ||
                          (p.location?.neighborhood === 'Tambaú' && filterBairro === 'Tambau') ||
                          (p.location?.neighborhood === 'Tambau' && filterBairro === 'Tambaú');
      const statusMatch = filterStatus === 'All' ||
                          normalizeStatus(p.status, language) === filterStatus;
      return bairroMatch && statusMatch;
    });
  }, [projects, filterBairro, filterStatus, language]);

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

  const handleConfirmAsNew = async (projectId) => {
    try {
      await updateDoc(doc(db, 'projects', projectId), {
        resolution_state: 'active'
      });
      alert('Projeto confirmado com sucesso!');
    } catch (err) {
      console.error("Erro ao confirmar projeto:", err);
      alert("Erro ao confirmar projeto.");
    }
  };

  const handleMergeSubmit = async () => {
    if (!stagedProjectToMerge || !selectedTargetMergeId) return;
    try {
      // 1. Get all units from the staged project
      const stagedUnitsRef = collection(db, 'projects', stagedProjectToMerge.id, 'units');
      const stagedUnitsSnapshot = await getDocs(stagedUnitsRef);

      // 2. Iterate through each unit to perform deep copy and deep delete
      const processUnitsPromises = stagedUnitsSnapshot.docs.map(async (unitDoc) => {
        const unitId = unitDoc.id;
        const unitData = unitDoc.data();

        // Copy unit to target project
        await setDoc(doc(db, 'projects', selectedTargetMergeId, 'units', unitId), unitData);

        // Query snapshots for this unit
        const snapshotsRef = collection(db, 'projects', stagedProjectToMerge.id, 'units', unitId, 'snapshots');
        const snapshotsSnapshot = await getDocs(snapshotsRef);

        // Copy snapshots to target project and delete from staged project
        const snapshotPromises = snapshotsSnapshot.docs.map(async (snapDoc) => {
          const snapId = snapDoc.id;
          const snapData = snapDoc.data();

          // Copy snapshot
          await setDoc(doc(db, 'projects', selectedTargetMergeId, 'units', unitId, 'snapshots', snapId), snapData);

          // Delete old snapshot
          await deleteDoc(doc(db, 'projects', stagedProjectToMerge.id, 'units', unitId, 'snapshots', snapId));
        });
        await Promise.all(snapshotPromises);

        // Delete old unit
        await deleteDoc(doc(db, 'projects', stagedProjectToMerge.id, 'units', unitId));
      });
      await Promise.all(processUnitsPromises);

      // 3. Delete the staged project document itself
      await deleteDoc(doc(db, 'projects', stagedProjectToMerge.id));

      setMergeModalOpen(false);
      setStagedProjectToMerge(null);
      setSelectedTargetMergeId('');
      alert('Projeto mesclado com sucesso!');
    } catch (err) {
      console.error("Erro ao mesclar projetos:", err);
      alert("Erro ao mesclar projetos. Verifique o console.");
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
      const fileRef = ref(storage, sourcePath); // Remove redundant prefix to fix 404
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
    return <div className="max-w-7xl mx-auto px-4 py-8 flex flex-col items-center w-full"><p className="text-gray-600">Carregando...</p></div>;
  }

  if (!user) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 flex flex-col items-center w-full">
        <h1 className="text-3xl font-bold mb-8">Login - Imobiliária AI</h1>
        <div className="bg-white rounded-xl shadow border border-gray-200 p-6 w-full max-w-md">
          <form onSubmit={handleLogin}>
            <div className="flex flex-col text-left mb-4">
              <label htmlFor="email" className="font-semibold mb-2 text-gray-700">Email</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-black"
                required
              />
            </div>
            <div className="flex flex-col text-left mb-6">
              <label htmlFor="password" className="font-semibold mb-2 text-gray-700">Senha</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-black"
                required
              />
            </div>
            {authError && <div className="mt-2 mb-4 p-3 rounded bg-red-100 text-red-700 border border-red-200">{authError}</div>}
            <button type="submit" className="w-full bg-black text-white p-3 rounded-lg font-semibold shadow hover:bg-gray-800 transition">Entrar</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 flex flex-col items-center w-full text-gray-900">
      <div className="w-full max-w-4xl flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Imobiliária AI - Painel Administrativo</h1>
          <p className="text-gray-500 font-medium">Ingestão de Dados e Time Machine</p>
        </div>
        <div className="flex gap-4 items-center">
          <LanguageToggle />
          <button onClick={handleLogout} className="px-4 py-2 border border-red-200 text-red-600 rounded-md hover:bg-red-50 transition-colors">Sair</button>
        </div>
      </div>

      <div className="flex space-x-2 border-b-2 border-gray-900 mb-8 w-full max-w-4xl">
        <button
          className={`px-4 py-2 font-medium rounded-t-lg focus:outline-none transition-colors border-t border-l border-r ${activeTab === 'upload' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
          onClick={() => setActiveTab('upload')}
        >
          1. Ingestão de PDFs
        </button>
        <button
          className={`px-4 py-2 font-medium rounded-t-lg focus:outline-none transition-colors border-t border-l border-r ${activeTab === 'catalogo-mapa' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
          onClick={() => setActiveTab('catalogo-mapa')}
        >
          2. Catálogo de Projetos
        </button>
        <button
          className={`px-4 py-2 font-medium rounded-t-lg focus:outline-none transition-colors border-t border-l border-r ${activeTab === 'staging' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
          onClick={() => setActiveTab('staging')}
        >
          3. Staging (Revisão)
        </button>
      </div>

      {activeTab === 'upload' && (
        <div className="w-full max-w-4xl flex flex-col gap-6">
          <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500 text-gray-700 text-sm">
            Upload B2B PDF: Faça upload de Tabelas de Preço ou Books B2B para ingestão automatizada na base de dados.
          </div>

          <div className="bg-white rounded-xl shadow border border-gray-200 w-full p-6">
            <PDFUploader />
          </div>

          <div className="bg-white rounded-xl shadow border border-gray-200 w-full p-6">
            <h2 className="text-xl font-bold mb-2">Pipeline Monitor</h2>
            <p className="text-gray-500 mb-4">Acompanhe o status de extração de dados dos documentos PDF enviados.</p>
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
        </div>
      )}

      {activeTab === 'catalogo-mapa' && (
        <div className="w-full max-w-7xl flex flex-col gap-6">
          <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500 text-gray-700 text-sm">
            Catálogo & Mapa: "Visualize e analise todos os imóveis verificados e processados."
          </div>
          {(() => {
            const activeProjects = projects.filter(p => p.resolution_state !== 'staged');
            const total = activeProjects.length;
            const naPlanta = activeProjects.filter(p => normalizeStatus(p.status, language) === 'na_planta').length;
            const emConstrucao = activeProjects.filter(p => normalizeStatus(p.status, language) === 'em_construcao').length;
            const prontos = activeProjects.filter(p => normalizeStatus(p.status, language) === 'pronto').length;

            return (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl shadow border border-gray-200 p-4 flex flex-col items-center justify-center">
                  <div className="text-sm text-gray-500 font-medium uppercase tracking-wide text-center">Total de Empreendimentos</div>
                  <div className="text-3xl font-bold text-gray-900 mt-2">{total}</div>
                </div>
                <div className="bg-white rounded-xl shadow border border-gray-200 p-4 flex flex-col items-center justify-center">
                  <div className="text-sm text-gray-500 font-medium uppercase tracking-wide text-center">Na Planta</div>
                  <div className="text-3xl font-bold text-blue-600 mt-2">{naPlanta}</div>
                </div>
                <div className="bg-white rounded-xl shadow border border-gray-200 p-4 flex flex-col items-center justify-center">
                  <div className="text-sm text-gray-500 font-medium uppercase tracking-wide text-center">Em Construção</div>
                  <div className="text-3xl font-bold text-yellow-600 mt-2">{emConstrucao}</div>
                </div>
                <div className="bg-white rounded-xl shadow border border-gray-200 p-4 flex flex-col items-center justify-center">
                  <div className="text-sm text-gray-500 font-medium uppercase tracking-wide text-center">Prontos</div>
                  <div className="text-3xl font-bold text-green-600 mt-2">{prontos}</div>
                </div>
              </div>
            );
          })()}
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




      {activeTab === 'staging' && (
        <div className="w-full max-w-7xl flex flex-col gap-6">
           <div className="bg-yellow-50 p-4 rounded-lg border-l-4 border-yellow-500 text-yellow-800 text-sm">
            Staging (Revisão): Imóveis que não tiveram correspondência exata e precisam de aprovação manual.
          </div>
          {projects.filter(p => p.resolution_state === 'staged').length === 0 ? (
            <p className="text-gray-600">Nenhum projeto em staging no momento.</p>
          ) : (
            <div className="property-grid">
              {projects.filter(p => p.resolution_state === 'staged').map(project => (
                <div key={project.id} className="bg-white rounded-xl shadow border border-gray-200 p-6">
                  <h3>{project.name}</h3>
                  <p><strong>Desenvolvedor:</strong> {project.developer || 'N/A'}</p>
                  <p><strong>Bairro:</strong> {project.location?.neighborhood || 'N/A'}</p>
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                    <button
                      style={{ backgroundColor: '#28a745', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer' }}
                      onClick={() => handleConfirmAsNew(project.id)}
                    >
                      Confirmar como Novo
                    </button>
                    <button
                      style={{ backgroundColor: '#007bff', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer' }}
                      onClick={() => {
                        setStagedProjectToMerge(project);
                        setMergeModalOpen(true);
                      }}
                    >
                      Mesclar com Existente
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'catalogo-mapa' && (
        <div className="bg-white rounded-xl shadow border border-gray-200 p-6 w-full mt-6">
          <h2 className="text-xl font-bold mb-4">Mapa de Imóveis</h2>
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
                    icon={createCustomIcon(normalizeStatus(project.status, language) || 'pronto')}
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

          <h2 className="text-xl font-bold mb-4 mt-8">Analytics: Preço por m² (Média)</h2>
          <div style={{ height: '300px', minHeight: '300px', width: '100%', minWidth: '100%' }}>
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
                <ResponsiveContainer width="100%" height={300}>
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

      {mergeModalOpen && stagedProjectToMerge && (
        <div className="modal" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div className="modal-content" style={{ backgroundColor: '#fff', padding: '2rem', borderRadius: '8px', width: '500px', maxWidth: '90%' }}>
            <h2>Mesclar: {stagedProjectToMerge.name}</h2>
            <p>Selecione um projeto existente para mover as unidades e mesclar os dados.</p>
            <div className="form-group" style={{ marginTop: '1rem' }}>
              <select
                value={selectedTargetMergeId}
                onChange={(e) => setSelectedTargetMergeId(e.target.value)}
                style={{ width: '100%', padding: '0.5rem' }}
              >
                <option value="">Selecione um projeto destino...</option>
                {projects.filter(p => p.resolution_state !== 'staged').map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.developer || 'Sem construtora'})</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
               <button
                 style={{ backgroundColor: '#6c757d', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer' }}
                 onClick={() => {
                 setMergeModalOpen(false);
                 setStagedProjectToMerge(null);
                 setSelectedTargetMergeId('');
               }}>Cancelar</button>
               <button
                 style={{ backgroundColor: '#007bff', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer' }}
                 disabled={!selectedTargetMergeId}
                 onClick={() => handleMergeSubmit()}
               >
                 Confirmar Mesclagem
               </button>
            </div>
          </div>
        </div>
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

export default Admin
