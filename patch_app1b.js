const fs = require('fs');
let content = fs.readFileSync('frontend/src/App.jsx', 'utf8');

// The replacement for handleAnalyzeAndSave might have failed due to spacing/indentation differences.
// Let's do a more robust string replacement.

content = content.replace(/  const handleAnalyzeAndSave = async \(\) => \{\n    if \(\!token\) \{\n      setMessage\('Por favor, forneça um token Bearer.'\)\n      return\n    \}\n/g, `  const handleAnalyzeAndSave = async () => {
    let token = '';
    try {
      token = await auth.currentUser.getIdToken();
    } catch (e) {
      setMessage('Erro de autenticação: Não foi possível obter o token.');
      return;
    }
`);

fs.writeFileSync('frontend/src/App.jsx', content);
