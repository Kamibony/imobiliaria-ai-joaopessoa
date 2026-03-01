import { useState, useEffect } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from './firebase'
import './App.css'

function App() {
  const [activeTab, setActiveTab] = useState('ingestao') // 'ingestao' or 'catalogo'
  const [token, setToken] = useState('')
  const [data, setData] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [properties, setProperties] = useState([])

  useEffect(() => {
    // Listen to changes in the "properties" collection
    const propertiesRef = collection(db, 'properties');
    const unsubscribe = onSnapshot(propertiesRef, (snapshot) => {
      const propertiesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setProperties(propertiesData);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

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

  return (
    <div className="admin-container">
      <h1>Imobiliária AI - Painel Administrativo</h1>
      <p className="subtitle">Ingestão de Dados e Time Machine</p>

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
          {properties.length === 0 ? (
            <p>Nenhum imóvel encontrado.</p>
          ) : (
            <div className="property-grid">
              {properties.map(property => {
                // Get the latest snapshot
                const snapshots = property.snapshots || [];
                // Sort snapshots by timestamp descending
                const sortedSnapshots = [...snapshots].sort((a, b) => {
                  const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
                  const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
                  return dateB - dateA;
                });

                const latestSnapshot = sortedSnapshots.length > 0 ? sortedSnapshots[0] : null;

                return (
                  <div key={property.id} className="property-card">
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
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default App
