echo "1. *Automate Bearer Token Fetching in App.jsx.*
   - Remove the manual token state and input fields in the 'ingestao' and 'triage' tabs.
   - Refactor handleAnalyzeAndSave and handleTriageAction to fetch the token using await auth.currentUser.getIdToken() dynamically.

2. *Restructure Navigation Tabs in App.jsx.*
   - Reorder the tabs exactly from left to right as requested: 'Radar de Mercado' (formerly 'Fontes de Descoberta'), 'Caixa de Entrada' (formerly 'HITL Triage Center'), 'Catálogo & Mapa' (Combine 'Catálogo de Imóveis (Dashboard)' and 'Mapa & Analytics'?), and 'Ações Manuais' (Combine 'Ingestão (Upload)' and 'Fontes (URLs)').
   - Based on user request, the tabs should be reorganized into 4 items, let's double check if I should combine some state. The user says:
     - Radar de Mercado (Rename from 'Fontes de Descoberta' -> activeTab 'discovery')
     - Caixa de Entrada (Rename from 'HITL Triage Center' -> activeTab 'triage')
     - Catálogo & Mapa (Currently 'Catálogo de Imóveis (Dashboard)' -> activeTab 'catalogo', and 'Mapa & Analytics' -> activeTab 'mapa' are separated. I should combine them into a single tab 'catalogo-mapa' or similar). The user says 'Catálogo & Mapa'.
     - Ações Manuais (Combine 'Ingestão' and 'Fontes URLs' here -> activeTab 'acoes-manuais').

3. *Add Inline UI Guides in App.jsx.*
   - Add the specified micro-copy text at the top of each corresponding activeTab block, styled as a muted alert box or card.

4. *Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.*

5. *Submit the change.*"
