# System Audit & Discovery Preparation Brief

## Português (Brasil)

### A Realidade Técnica (O que está em produção)
- **Scraper Python (Aquisição de Dados):** O scraper utiliza `Playwright` e executa scripts de limpeza do DOM (removendo headers, footers, etc.) para reduzir o ruído antes da extração de texto. Ele é orquestrado via GitHub Actions (CRON) e usa uma estratégia de `requests.Session` com `Retry` para estabilidade. Possui um fallback multimodal: se o texto extraído for muito curto (<500 caracteres), ele tira um screenshot da página para análise visual do Gemini.
- **Roteamento da API e Filas (Backend Firebase):** O backend (Node.js/TypeScript) usa Functions v2. A ingestão de dados (`ingestPropertyData`) não processa os dados sincronicamente; em vez disso, enfileira a carga útil via `Cloud Tasks` (`processPropertyData`) para evitar timeouts de 15 segundos do HTTP. Endpoints são protegidos via Tokens Bearer ou validação de ID Token do Firebase Auth.
- **Ingestão de Dados por IA (Vertex AI/Gemini):** A tarefa em fila usa o modelo `gemini-2.5-flash` para converter o texto bruto/imagens em um schema JSON rigoroso, mapeando valores ausentes como `null`. A extração do JSON é feita via regex para evitar erros de parse, e a estrutura é validada usando schemas do `zod` antes da inserção no Firestore.
- **Frontend (React/Vite):** Uma aplicação "Single Page" com autenticação baseada no Firebase Auth. O UI inclui um "Radar de Mercado" (Fontes de descoberta), "Caixa de Entrada" (Triage Center), "Catálogo e Mapa" (com filtros e mapa Leaflet), e uma aba de ações manuais. O sistema suporta múltiplos idiomas (`pt-BR` e `en`) em tags e callouts de inteligência artificial.

### Fragilidade Arquitetural e Riscos
- **Quedas Silenciosas no Frontend:** A aplicação React tenta iterar de forma defensiva sobre os campos de texto do Gemini, mas há risco contínuo: o código muitas vezes não lida com `null` em matemática sem verificações agressivas (ex: exclusão de preços nulos em Recharts), e a ausência de um tratador seguro pode levar ao temido "White Screen of Death".
- **Dependência de "null" e "Sob Consulta":** Quando a IA encontra valores de preços ausentes, ela devolve "null". O frontend mascara isso como "Sob Consulta". Isso não dispara nenhum alerta para captura manual, criando buracos analíticos no dashboard.
- **Geocoding Impreciso (Resiliência Falha):** Se a extração do Gemini de latitudes e longitudes falha, o backend mapeia coordenadas genéricas hardcoded via fuzzy-matching do bairro (ex: Tambaú vs Tambau). Se os bairros forem escritos de forma imprevista, os marcadores no mapa não serão renderizados ou estarão nos lugares errados.
- **Autorização Hardcoded:** O sistema ainda tem falhas temporárias como checagens de `dev_secret_fallback` para facilitar testes locais. Se as chaves do Secret Manager falharem em produção (ex: por falta de acesso), e o ambiente de CI não for estritamente configurado, há um risco de aceitar auth vazias/inválidas ou estourar a aplicação logo no boot.

### Questões Estratégicas para o Discovery (Com Corretores)
1. Atualmente, se um imóvel em Tambaú não exibe o preço online, nosso sistema marca "Sob Consulta". Com que frequência as construtoras escondem o preço real, e qual é o fluxo interno exato que um corretor usa para descobrir esse valor oculto?
2. Em nosso mapa, usamos posições "Beira Mar", "Quadra Mar" e "Miolo". Além da distância exata até a praia, quais outras métricas hiper-locais (ex: ventilação/posição solar exata) afetam diretamente o preço e a velocidade de venda aqui em João Pessoa?
3. Nosso assistente calcula "ROI Estimado" e sugere "Público-Alvo" de forma genérica. Quais são os fatores ocultos de retorno sobre investimento (como regulamentações de altura de prédio e demanda sazonal por locação em Cabo Branco) que a inteligência artificial não conseguiria deduzir apenas lendo o site da construtora?
4. Estamos identificando novos empreendimentos quase imediatamente assim que o site da construtora é atualizado. Do seu ponto de vista prático, existe algum intervalo de tempo onde o corretor tem "vantagem" e informações privilegiadas via WhatsApp antes mesmo de serem publicadas na internet?

---

## Slovenský (Slovak)

### Technická Realita (Čo je v produkcii)
- **Python Scraper (Zber dát):** Scraper využíva `Playwright` na navigáciu na weboch lokálnych developerov. Pred extrakciou čistí DOM (odstraňuje navigáciu, scripty, atď.) kvôli zníženiu šumu pre LLM. Je spúšťaný cez GitHub Actions (CRON) a má zabudovanú vizuálnu poistku – ak je extrahovaný text príliš krátky, vyhotoví screenshot stránky pre multimodálnu analýzu Gemini.
- **API Smerovanie a Fronty (Firebase Backend):** Backend beží na Cloud Functions v2. Webhook `ingestPropertyData` nečaká na synchrónne spracovanie dát; miesto toho ich pridáva do fronty cez `Cloud Tasks`, aby predišiel HTTP timeoutom. Všetky endpointy vyžadujú overenie pomocou Bearer tokenov (Firebase Auth alebo statické sekréty).
- **Spracovanie UI (Vertex AI/Gemini):** Fronta spúšťa model `gemini-2.5-flash`, ktorý transformuje surový text a obrázky na prísne definovaný JSON. Údaje, ktoré nie sú na webe, Gemini priradí ako `null`. JSON sa pred zápisom do Firestore extrahuje pomocou regulárnych výrazov a validuje pomocou `zod`.
- **Frontend Vykresľovanie (React/Vite):** Ide o Single Page Application (SPA), ktorá funguje ako administrátorský dashboard. Ponúka viacero tabov, napríklad: "Radar trhu", "Doručená pošta" na manuálne potvrdzovanie a "Katalóg a mapa" pre zobrazenie vlastností cez Leaflet. UI podporuje portugalčinu a angličtinu a reaguje v reálnom čase na zmeny z Firestore.

### Architektonická Krehkosť a Riziká
- **Tiché Zlyhania Frontendu:** Napriek implementácii React Error Boundaries, aplikácia môže skolabovať, ak AI nepredvídateľne vráti namiesto poľa inštanciu typu string (napríklad pri metadátach ako `target_persona`). Zobrazovanie matematických analýz (Recharts) tiež môže padnúť, ak nenarazí na presne ošetrené nulové hodnoty.
- **Krehký "Fallback" Súradníc:** Keď AI nedokáže vyčítať zemepisnú šírku a dĺžku, backend použije hardcodované lokality podľa "fuzzy" názvu štvrte. Ak sa názov štvrte zásadne líši v dôsledku neočakávaných formátov, systém súradnice vôbec nevytvorí, čo spôsobí, že sa objekty nezobrazia na mape.
- **Akceptácia Nedostatočných Dát:** Stratégia AI vrátiť "null" pre chýbajúce ceny alebo rozmery udržuje systém v behu, no spôsobuje tiché "dátové diery". Zákazník vidí iba nápis "Sob Consulta" (Na vyžiadanie), avšak systém nevygeneruje pre operátora žiadny alarm, aby išiel cenu zistiť manuálne.
- **Skryté Problémy s Prostredím:** Bezpečnostná logika spoliehajúca na padanie späť na `dev_secret_fallback` pri absencii produkčných premenných (Webhooks, API kľúče) môže byť nebezpečná. Ak `defineSecret` vo Firebase zlyhá pri štarte, API volania sa buď úplne zastavia alebo môžu ostať otvorené, ak by nebolo použité striktné fail-fast riadenie prístupu.

### Strategické Otázky na "Discovery" Stretnutie (S Maklérmi)
1. Ak dnes v systéme nájdeme byt v Tambaú bez ceny, označíme ho ako "Na vyžiadanie". Ako často developeri takto cielene skrývajú ceny a aký presne manuálny proces musí maklér vykonať, aby sa k týmto cenám reálne dostal?
2. Náš algoritmus pri oceňovaní aktuálne počíta iba so vzdialenosťou od mora. Aké ďalšie skryté, striktne lokálne parametre (napríklad orientácia vetra, tienenie budov v Joao Pessoa) v realite najviac hýbu finálnou cenou?
3. Náš asistent momentálne vypočítava "Odhadované ROI" z čísel. Aké zásadné investičné prekážky a výhody (napríklad obmedzenia výšky stavieb pri pláži alebo sezónnosť prenájmov), o ktorých sa nepíše na weboch developerov, musíme klientom zo Sao Paula okamžite vysvetľovať?
4. Monitorujeme weby a získavame nové dáta v momente zverejnenia. Máte z vlastnej skúsenosti pocit, že existuje "slepé okno", kedy kľúčové informácie o nových projektoch zdieľate výhradne cez WhatsApp skupiny dlho pred tým, než ich vôbec zavesia na nejaký oficiálny web?
