import { useState } from 'react'
import './App.css'

function App() {
  const [token, setToken] = useState('')
  const [data, setData] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleAnalyzeAndSave = async () => {
    if (!token) {
      setMessage('Please provide a Bearer token.')
      return
    }
    if (!data) {
      setMessage('Please provide property data.')
      return
    }

    setLoading(true)
    setMessage('')

    try {
      // In a real environment, this URL would be the deployed Cloud Function URL.
      // E.g., https://us-central1-imobiliaria-ai-joaopessoa.cloudfunctions.net/ingestPropertyData
      // Alternatively, we can use a relative path if deployed properly with rewrite rules.
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
        setMessage(`Success: ${result.message} (ID: ${result.propertyId})`)
        setData('') // clear data on success
      } else {
        const errorText = await response.text()
        setMessage(`Error: ${response.status} - ${errorText}`)
      }
    } catch (err) {
      console.error(err)
      setMessage(`Error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="admin-container">
      <h1>Imobiliária AI - Admin Dashboard</h1>
      <p className="subtitle">Property Data Ingestion & Time Machine</p>

      <div className="card">
        <div className="form-group">
          <label htmlFor="token">Bearer Token (Authorization)</label>
          <input
            type="password"
            id="token"
            placeholder="Enter secure token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label htmlFor="data">Unstructured Property Data</label>
          <textarea
            id="data"
            placeholder="Paste raw text from PPT, PDF, WhatsApp, or websites here..."
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
          {loading ? 'Analyzing & Saving...' : 'Analyze & Save'}
        </button>

        {message && (
          <div className={`message ${message.startsWith('Success') ? 'success' : 'error'}`}>
            {message}
          </div>
        )}
      </div>
    </div>
  )
}

export default App
