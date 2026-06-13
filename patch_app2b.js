const fs = require('fs');
let content = fs.readFileSync('frontend/src/App.jsx', 'utf8');

// Combine the content of activeTab === 'catalogo' and activeTab === 'mapa' into activeTab === 'catalogo-mapa'
// Find catalogo content
const catalogoContentMatch = content.match(/\{activeTab === 'catalogo' && \([\s\S]*?\}\)\n          \}\)\}\n            <\/div>\n          \)\}\n        <\/div>\n      \)\}/);

// Find mapa content
const mapaContentMatch = content.match(/\{activeTab === 'mapa' && \([\s\S]*?\}\)\n          <\/div>\n        <\/div>\n      \)\}/);

// Replace them and create new combined ones
content = content.replace(/\{activeTab === 'catalogo' && \([\s\S]*?\}\)\n          \}\)\}\n            <\/div>\n          \)\}\n        <\/div>\n      \)\}/, `{activeTab === 'catalogo-mapa' && (
        <>
          <div className="catalog-container" style={{ marginBottom: '2rem' }}>
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
                      <YAxis tickFormatter={(value) => \`R$ \${value}\`} />
                      <Tooltip formatter={(value) => [\`R$ \${value}\`, 'Média (R$/m²)']} />
                      <Legend />
                      <Bar dataKey="Media" fill="#8884d8" name="Média (R$/m²)" />
                    </BarChart>
                  </ResponsiveContainer>
                );
              })()}
            </div>
          </div>
        </>
      )}`);

// Remove old mapa block
content = content.replace(/\{activeTab === 'mapa' && \([\s\S]*?\}\)\n          <\/div>\n        <\/div>\n      \)\}/, ``);

// Combine the content of activeTab === 'ingestao' and activeTab === 'fontes' into activeTab === 'acoes-manuais'
// ingestao replacement
content = content.replace(/\{activeTab === 'ingestao' && \([\s\S]*?\)\}\n        <\/div>\n      \)\}/, `{activeTab === 'acoes-manuais' && (
        <>
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
              <div className={\`message \${message.startsWith('Sucesso') ? 'success' : 'error'}\`}>
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
              {urlMessage && <div className={\`message \${urlMessage.includes('Erro') ? 'error' : 'success'}\`}>{urlMessage}</div>}
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
      )}`);

// Remove old fontes block
content = content.replace(/\{activeTab === 'fontes' && \([\s\S]*?\)\}\n          <\/div>\n        <\/div>\n      \)\}/, ``);

fs.writeFileSync('frontend/src/App.jsx', content);
