const fs = require('fs');
let content = fs.readFileSync('frontend/src/App.jsx', 'utf8');

// 1. Update initial state of activeTab to 'discovery'
content = content.replace(/const \[activeTab, setActiveTab\] = useState\('ingestao'\) \/\/ .*/, `const [activeTab, setActiveTab] = useState('discovery')`);

// 2. Restructure the tabs navigation
const tabsRegex = /<div className="tabs">[\s\S]*?<\/div>/;
const newTabs = `<div className="tabs">
        <button
          className={\`tab-btn \${activeTab === 'discovery' ? 'active' : ''}\`}
          onClick={() => setActiveTab('discovery')}
        >
          Radar de Mercado
        </button>
        <button
          className={\`tab-btn \${activeTab === 'triage' ? 'active' : ''}\`}
          onClick={() => setActiveTab('triage')}
        >
          Caixa de Entrada
        </button>
        <button
          className={\`tab-btn \${activeTab === 'catalogo-mapa' ? 'active' : ''}\`}
          onClick={() => setActiveTab('catalogo-mapa')}
        >
          Catálogo & Mapa
        </button>
        <button
          className={\`tab-btn \${activeTab === 'acoes-manuais' ? 'active' : ''}\`}
          onClick={() => setActiveTab('acoes-manuais')}
        >
          Ações Manuais
        </button>
      </div>`;

content = content.replace(tabsRegex, newTabs);

fs.writeFileSync('frontend/src/App.jsx', content);
