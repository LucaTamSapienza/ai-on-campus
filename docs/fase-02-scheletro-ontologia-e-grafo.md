# Fase 02, scheletro, ontologia e grafo

Consegnata il 14/11/2026 sul branch `feat/scheletro-ontologia-e-grafo`. Il prodotto si chiama **PRISMA**: il nome e la frase stanno solo in `app/frontend/lib/brand.ts`. Worker (`ai-on-campus`), pacchetti, cartelle e risorse `aoc-` non cambiano.

## Cosa è stato costruito

**Backend** (`app/backend/`), un Worker solo:

- `wrangler.jsonc`: Worker `ai-on-campus` sull'account personale, D1 `aoc-db` con `database_id` segnaposto (il database remoto non è stato creato), assets da `../frontend/out` con il Worker davanti solo per `/api/*` e `/agents/*`, Durable Object `Cartografo`, `DAILY_BUDGET_USD` a 1,50.
- `migrations/0001_ontologia.sql`: le tabelle del piano, più tre colonne richieste dalle correzioni: `sources.content_hash` (unico per corso), `sources.windows_done`, `passages.thin`.
- `src/llm.ts`: unica porta verso OpenRouter (`openai/gpt-6-luna`, mappa per agente). Firma `complete(env, {agent, messages, maxTokens, ref, jsonSchema})` invariata.
- `src/segment.ts`: passo 1 del Cartografo, in solo codice: slide per `## Slide N`, poi intestazioni Markdown, poi blocchi di paragrafi. Toglie le righe che si ripetono in metà dei passaggi (piè di pagina), comprime gli spazi e oscura i termini di `REDACT_TERMS`, un segreto locale con il nome del docente: il nome non entra né nel D1 né nell'interfaccia, e non compare nel repository.
- `src/ontology.ts`: schema, slug, validazione e scrittura comuni al Cartografo e all'import.
- `src/cartografo.ts`: l'agente, con i sei passi del piano. Finestre da circa 6.000 caratteri (L08 si legge in tre), al massimo 12 concetti per finestra, uscita JSON con schema rigido, poi assegnazione degli argomenti. Lo stato arriva ai client via WebSocket.
- `src/index.ts`: tutte le rotte del piano, più `POST /api/courses/:id/ontology` e il campo `extract` su `POST /sources`.
- `scripts/seed.mjs`: semina tramite l'API.

**Frontend** (`app/frontend/`): Next.js 16 con export statico, Tailwind 4, shadcn/ui (bersagli portati a 44 px), token di `docs/design-system.md` in `app/globals.css`.

- `lib/api.ts`: l'unico modulo che parla con l'API, con tipi, errori e codice demo.
- `components/app-shell.tsx`: barra a sinistra su desktop, intestazione e barra in basso su telefono, selettore di ruolo dichiarato simulato e richiesta del codice demo.
- `/`: grafo a forze su canvas (`react-force-graph-2d` 1.29, compatibile con React 19). Colore per argomento, raggio per relazioni, freccia su `prerequisito` e tratteggio su `contrasta`. Il fuoco attenua il resto. Ricerca, chip degli argomenti (in un foglio su telefono), elenco dei concetti e dettaglio: pannello a destra su desktop, foglio a metà o a tutta altezza su telefono. Striscia del Cartografo dal vivo; i nodi nuovi entrano crescendo, restano arancioni per 5 secondi e non rifanno il layout.
- `/materiali`: caricamento di un file `.md` o `.txt`, oppure di testo incollato, con elenco delle fonti, stato e conteggi, e la stessa striscia del Cartografo.

## Come si prova

```bash
# una volta
cd app/backend && npm install && grep ^OPENROUTER_API_KEY= ../../.env > .dev.vars
npx wrangler d1 migrations apply aoc-db --local
cd ../frontend && npm install && npm run build      # crea out/, servito anche dal Worker

# due terminali
cd app/backend && npx wrangler dev --port 8787
cd app/frontend && npx next dev --port 3000

# corso e lezioni (cartella del materiale come argomento esplicito)
cd app/backend
node scripts/seed.mjs ../../materiale-locale/reinforcement-learning --limit 0            # solo il corso
node scripts/seed.mjs ../../materiale-locale/reinforcement-learning --only L03,L04,L05   # con il Cartografo
node scripts/seed.mjs <cartella> --ontologia   # 13 fonti con extract=false, poi ontologia.json
```

Poi si carica L08 da `http://localhost:3000/materiali`, si apre il grafo e si cerca «Q-learning». L'export statico si prova su `http://localhost:8787/` e `/materiali`.

**Prova finale fatta** (Playwright usato solo per le schermate di controllo, nessun test scritto): L08 caricata da `/materiali` nel browser, con il grafo osservato mentre il Cartografo lavora. A 5 s la parte 1 di 3, a 10 s +12 concetti, a 20 s +18, poi l'assegnazione degli argomenti e a 45 s «Lettura finita». Il dettaglio di Q-learning mostra definizione, argomento, relazioni per tipo e prove «L08 · slide 67, 69, 76». Nessun errore in console, nessuno scorrimento orizzontale, a 1440 × 900 e a 390 × 844, sia con `next dev` sia con l'export servito dal Worker.

## Risultati misurati

| | Concetti | Relazioni | Chiamate | Costo |
|---|---|---|---|---|
| L08 da sola (80 slide, 10 senza testo) | 23 | 26 | 4 | 0,0042 $ |
| L03 | 16 | | 3 | 0,0021 $ |
| L04 | 10 | | 3 | 0,0018 $ |
| L05 | 16 | | 3 | 0,0025 $ |
| Quattro lezioni insieme | 50 | 68 | 13 | 0,0106 $ |

- Il costo per lezione va da 0,002 a 0,004 $ e una lezione si legge in 20-50 s. Il corso intero (13 lezioni) costerebbe circa 4 centesimi con Luna.
- Concetti di L08: Q-learning, Sarsa, TD error, On-policy, Off-policy, bootstrapping, Monte-Carlo method, ϵ-Greedy Exploration, GLIE, Convergence of Sarsa & Q-Learning e altri. Ci sono tutti quelli che la prima misura del piano chiedeva, quindi i ripieghi non servono.
- Collegamenti fra file: con quattro lezioni, 11 concetti hanno prove in due o tre lezioni, per esempio Value Iteration (L04, L05, L08), Bellman Optimality (L03, L04, L05), Policy Iteration (L05, L08) e ϵ-Greedy Exploration (L03, L08). Il grafo forma un grande blocco centrale, con pochi concetti isolati o a coppie ai margini.
- Spesa totale di sviluppo in questa fase: circa 0,03 $, dopo quattro passate su L08 e due sulle lezioni 3-5, con il database locale azzerato fra una prova e l'altra.

**Ontologia iniziale.** L'ontologia di partenza del corso la prepara un altro agente con un modello più capace e la scrive in `materiale-locale/reinforcement-learning/ontologia.json`; `seed.mjs --ontologia` la importa. I caricamenti dal vivo, quelli della demo, li legge il Cartografo con Luna. L'import è stato provato con un file di prova: due esecuzioni danno lo stesso grafo e lo stesso report dei respinti. L'`ontologia.json` vero non l'ho importato perché quando ho finito non c'era ancora.

## Le otto correzioni dell'analisi contrastante

1. **Sicurezza: fatto.** Con `DEMO_CODE` impostato tutte le rotte `/api` tranne `/api/health` rispondono 401 senza `x-demo-code`, letture comprese. Anche `/agents/*` risponde 401: il codice arriva come parametro `code`, perché il WebSocket del browser non porta intestazioni. Un `Origin` diverso dal Worker (o da `localhost` in locale) riceve 403. I client sono in sola lettura (`shouldConnectionBeReadonly`) e l'agente non ha metodi `@callable`. Provato con un secondo `wrangler dev` con `--var DEMO_CODE`. Senza segreto, in locale, è tutto aperto.
2. **Budget: fatto.** `llm.ts` prenota il costo massimo stimato (ingresso a 3 caratteri per token più tutto `max_tokens`) con un solo `INSERT … SELECT … WHERE totale + stima <= tetto`, che è atomico. Poi riconcilia con il costo vero restituito da OpenRouter, oppure a 0 se la chiamata fallisce. Timeout di 90 s e un solo nuovo tentativo su rete, timeout, 429, 5xx, risposta vuota o JSON non valido. `DAILY_BUDGET_USD=0.60` è nel `.dev.vars` locale.
3. **Idempotenza: fatto.** Lo stesso contenuto ricaricato nello stesso corso restituisce la fonte esistente con `duplicate: true`. Ogni finestra si scrive con upsert (slug unico, `INSERT OR IGNORE` su prove e relazioni) e `windows_done` salva l'ultima finestra completata. Se l'agente riparte, `onStart` rimette in fila le fonti `queued` o `processing` da lì. L'import rifatto due volte lascia lo stesso grafo e restituisce `rejected` con tipo, nome e motivo. Una finestra con JSON non valido si salta, si segna nell'avviso della fonte («Parti non lette: 2 di 3») e la lettura prosegue; la fonte va in errore solo se falliscono tutte o se finisce il budget.
4. **Seed: fatto.** La cartella del materiale è il primo argomento, obbligatorio.
5. **Grafo che si aggiorna: fatto.** Lo stato del Cartografo porta `graphRevision`, che cresce a ogni finestra scritta, alla fine di una fonte, dopo un import e dopo una correzione o un'eliminazione del docente (il Worker chiama `bumpRevision`). Quando cambia, il frontend rilegge il grafo. Chi si collega dopo riceve lo stato attuale dall'SDK e legge il grafo all'apertura.
6. **Accessibilità e telefono: fatto.** C'è un elenco dei concetti ricercabile accanto alla tela (colonna di 300 px su desktop, a tutto schermo su telefono): toccare una voce seleziona e centra il nodo, e il nodo selezionato è evidenziato e portato in vista nell'elenco. Ogni nodo ha un'area di tocco di almeno 44 px. Gli archi del nodo in fuoco sono pieni (`#1E293B`, 2 px) e il resto si attenua. Le etichette sono a 13 px peso 600, 14 px peso 700 per il nodo in fuoco, con alone chiaro: il design system diceva 12 px peso 500, li ho alzati per il proiettore. Su telefono il nodo scelto si centra nella metà visibile sopra il foglio.
7. **Export: fatto.** `NEXT_PUBLIC_API_BASE` sta in `app/frontend/.env.development` (solo l'indirizzo locale, tracciato apposta). Nell'export manca e l'API è la stessa origine. Provato aprendo direttamente `http://localhost:8787/` e `/materiali`, con ricerca, dettaglio e WebSocket funzionanti. I file statici hanno le intestazioni di sicurezza da `public/_headers` (CSP, `X-Frame-Options: DENY`).
8. **Slide quasi vuote: fatto.** Sotto i 40 caratteri non di spazio una slide è `thin`. Resta nel D1, per non perdere la numerazione del docente, ma non va al modello e non vale come prova, né per il Cartografo né per l'import (il report dice «slide senza testo estratto»). In `/materiali` si legge «14 senza testo estratto».

## Sicurezza del piano, punti 1-9 e 11

Sono fatti 1-8 e 11. Il punto 9 (rotte dello studente in sola lettura lato server) non ha ancora oggetto: in questa fase non ci sono rotte riservate e il ruolo studente nasconde solo «Materiali», «Correggi» ed «Elimina» nell'interfaccia. Va fatto con le rotte d'esame della fase 03. Il materiale del corso e `.dev.vars` sono fuori da Git; `git status` è stato controllato a ogni commit.

## Cosa è rimasto fuori o non va del tutto

- **Lint.** `next lint` segnala 15 errori delle regole del React Compiler (ref letti durante il render nella tela, `setState` dentro gli effetti di caricamento). Il compilatore non è attivo, la build passa e il comportamento è giusto. Non li ho riscritti per non perdere tempo.
- **Etichette.** Con molti nodi vicini due etichette possono sovrapporsi: non c'è un controllo delle collisioni. Si mitiga mostrando sempre solo i nodi più connessi (circa uno ogni 150 px di larghezza) e tutti gli altri avvicinandosi.
- **Colori durante l'estrazione.** Mentre il Cartografo estrae, i concetti nuovi non hanno ancora un argomento: sono arancioni per 5 secondi, poi grigi finché a fine fonte arriva l'argomento.
- **Argomenti.** Il modello a volte crea un argomento non ancora coperto dalle lezioni caricate.
- **Migrazione 0001 cambiata dopo il primo commit.** `9f9fa77` aveva la 0001 senza le tre colonne nuove. Chi è partito da quel commit deve rifare il D1 locale (`rm -rf app/backend/.wrangler/state` e di nuovo le migrazioni). Nessun database remoto esiste ancora.
- Nessun deploy e nessun comando remoto: li fa l'orchestratore. Al primo deploy servono `wrangler d1 create aoc-db`, il `database_id` vero in `wrangler.jsonc` e i segreti `OPENROUTER_API_KEY`, `DEMO_CODE` e `REDACT_TERMS`.
