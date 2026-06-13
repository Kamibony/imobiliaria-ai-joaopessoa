const fs = require('fs');

let content = fs.readFileSync('frontend/src/App.jsx', 'utf8');

// 1. Remove the token state
content = content.replace(/const \[token, setToken\] = useState\(''\)\n?/, '');

// 2. Refactor handleAnalyzeAndSave
content = content.replace(/  const handleAnalyzeAndSave = async \(\) => \{\s*if \(\!token\) \{\s*setMessage\('Por favor, forneça um token Bearer.'\)\s*return\s*\}\s*/, `  const handleAnalyzeAndSave = async () => {
    let token = '';
    try {
      token = await auth.currentUser.getIdToken();
    } catch (e) {
      setMessage('Erro de autenticação: Não foi possível obter o token.');
      return;
    }
`);

// 3. Refactor handleTriageAction
content = content.replace(/  const handleTriageAction = async \(item, action\) => \{\s*if \(\!token\) \{\s*setTriageMessage\('Por favor, forneça um token Bearer.'\);\s*return;\s*\}\s*setTriageMessage\('Processando...'\);\s*try \{/, `  const handleTriageAction = async (item, action) => {
    let token = '';
    try {
      token = await auth.currentUser.getIdToken();
    } catch (e) {
      setTriageMessage('Erro de autenticação: Não foi possível obter o token.');
      return;
    }
    setTriageMessage('Processando...');
    try {`);

// 4. Remove token inputs
content = content.replace(/          <div className="form-group">\s*<label htmlFor="token">Token Bearer \(Autorização\)<\/label>\s*<input\s*type="password"\s*id="token"\s*placeholder="Insira o token seguro"\s*value=\{token\}\s*onChange=\{\(e\) => setToken\(e\.target\.value\)\}\s*\/>\s*<\/div>/g, '');

content = content.replace(/          <div className="form-group" style=\{\{ marginBottom: '2rem' \}\}>\s*<label htmlFor="triageToken">Token Bearer \(Autorização para Ações\)<\/label>\s*<input\s*type="password"\s*id="triageToken"\s*placeholder="Insira o token seguro"\s*value=\{token\}\s*onChange=\{\(e\) => setToken\(e\.target\.value\)\}\s*\/>\s*<\/div>/g, '');

fs.writeFileSync('frontend/src/App.jsx', content);
