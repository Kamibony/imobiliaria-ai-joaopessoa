const fs = require('fs');
let content = fs.readFileSync('frontend/src/App.jsx', 'utf8');

// The styles
const guideStyle = `style={{ backgroundColor: '#f8f9fa', padding: '1rem', borderRadius: '8px', borderLeft: '4px solid #007bff', marginBottom: '1.5rem', color: '#555', fontSize: '0.95rem' }}`;

// Radar de Mercado (discovery)
content = content.replace(/\{activeTab === 'discovery' && \(\s*<div className="card">/, `{activeTab === 'discovery' && (\n        <div className="card">\n          <div ${guideStyle}>\n            Radar de Mercado: "Adicione os sites principais das construtoras. O robô monitorará essas fontes diariamente em busca de novos empreendimentos."\n          </div>`);

// Caixa de Entrada (triage)
content = content.replace(/\{activeTab === 'triage' && \(\s*<div className="card" style=\{\{ width: '100%', maxWidth: '1000px' \}\}>/, `{activeTab === 'triage' && (\n        <div className="card" style={{ width: '100%', maxWidth: '1000px' }}>\n          <div ${guideStyle}>\n            Caixa de Entrada: "Avalie as descobertas da IA. Aprovar um item iniciará a extração profunda de dados de forma automática."\n          </div>`);

// Catálogo & Mapa (catalogo-mapa)
// I will just add it to the first catalogo-mapa block
content = content.replace(/\{activeTab === 'catalogo-mapa' && \(\s*<div className="catalog-container">/, `{activeTab === 'catalogo-mapa' && (\n        <div className="catalog-container">\n          <div ${guideStyle}>\n            Catálogo & Mapa: "Visualize e analise todos os imóveis verificados e processados."\n          </div>`);

// Ações Manuais (acoes-manuais)
content = content.replace(/\{activeTab === 'acoes-manuais' && \(\s*<>\s*<div className="card" style=\{\{ marginBottom: '2rem' \}\}>/, `{activeTab === 'acoes-manuais' && (\n        <>\n          <div ${guideStyle}>\n            Ações Manuais: "Use estas ferramentas apenas para forçar extrações manuais de URLs específicas ou colar textos brutos."\n          </div>\n          <div className="card" style={{ marginBottom: '2rem' }}>`);


fs.writeFileSync('frontend/src/App.jsx', content);
