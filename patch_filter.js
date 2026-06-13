const fs = require('fs');
let content = fs.readFileSync('frontend/src/App.jsx', 'utf8');

// The reviewer noted a nitpick: renderFilterBar is rendered twice on the combined Catálogo & Mapa page.
// Let's remove the second one.

// Replace `{renderFilterBar()}` in the map part, leaving only the one in the catalog part.
content = content.replace(/<h2>Mapa de Imóveis<\/h2>\s*\{renderFilterBar\(\)\}/, "<h2>Mapa de Imóveis</h2>");

fs.writeFileSync('frontend/src/App.jsx', content);
