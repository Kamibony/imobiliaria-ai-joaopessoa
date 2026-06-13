const fs = require('fs');
let content = fs.readFileSync('frontend/src/App.jsx', 'utf8');

// I'll replace `{activeTab === 'catalogo' && (` with `{activeTab === 'catalogo-mapa' && (`
content = content.replace(/\{activeTab === 'catalogo' && \(/, "{activeTab === 'catalogo-mapa' && (");

// And `{activeTab === 'mapa' && (` will also be changed to {activeTab === 'catalogo-mapa' && (
content = content.replace(/\{activeTab === 'mapa' && \(/, "{activeTab === 'catalogo-mapa' && (");

fs.writeFileSync('frontend/src/App.jsx', content);
