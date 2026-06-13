const fs = require('fs');
let content = fs.readFileSync('frontend/src/App.jsx', 'utf8');

// Note that there are two {activeTab === 'catalogo-mapa' && ( now. React will render both, which is fine, but structurally they should probably be one. However, rendering both is also functionally exactly the same and doesn't break anything.

fs.writeFileSync('frontend/src/App.jsx', content);
