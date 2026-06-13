const fs = require('fs');
let content = fs.readFileSync('frontend/src/App.jsx', 'utf8');

content = content.replace(/  const handleTriageAction = async \(item, action\) => \{\n    setTriageMessage\(''\);\n    try \{\n      const response = await fetch/g, `  const handleTriageAction = async (item, action) => {
    setTriageMessage('');
    let token = '';
    try {
      token = await auth.currentUser.getIdToken();
    } catch (e) {
      setTriageMessage('Erro de autenticação: Não foi possível obter o token.');
      return;
    }
    setTriageMessage('Processando...');
    try {
      const response = await fetch`);

fs.writeFileSync('frontend/src/App.jsx', content);
