# Fase 01, piano

Contratto per gli agenti che implementano Controesame. Idea e funzionalità stanno in `docs/fase-00-brainstorming.md` e in `docs/proposta.html` (versione 2). Se il codice deve fare una cosa che qui non c'è, prima si corregge questo file.

Scritto alle 13:05 del 14/11/2026. Alle 15:00 passano gli esperti. Stop alle funzioni nuove alle 16:15.

## Priorità decisa da Luca alle 12:55

**Prima il grafo.** Il primo filo verticale non è più l'attacco alla domanda: è l'ontologia del corso e la sua interfaccia. Un agente estrae i concetti da documenti e trascrizioni e li collega fra loro; l'interfaccia li mostra in stile Obsidian. I nodi sono **concetti, non file**: un file produce molti concetti e un concetto nasce da molti file.

Tre vincoli di Luca valgono per tutto il progetto:

1. **Desktop e telefono sono entrambi prima scelta.** Nessuno dei due è l'adattamento dell'altro. Ogni schermata si prova a 390 × 844 e a 1440 × 900 prima di dirla fatta.
2. **Sicurezza.** Vedi la sezione sotto: non è facoltativa nemmeno in un hackathon, perché l'URL sarà pubblico e dietro c'è una chiave con 5 $.
3. **Il corso della demo è vero.** Reinforcement Learning, magistrale alla Sapienza: il testo delle 13 lezioni (L00-L12, 867 slide, circa 38.000 parole, in inglese) sta in `materiale-locale/reinforcement-learning/`, una cartella esclusa da Git perché le slide sono del docente. Nel repository e nell'interfaccia non compare il nome del docente. Il materiale entra nell'app dalla stessa rotta di caricamento che usa il docente, non da un percorso a parte.

## Il percorso della demo

1. **Il corso.** Il docente apre Controesame, vede il grafo di Reinforcement Learning. Carica una lezione in più: il Cartografo lavora, a schermo compaiono concetti nuovi che si agganciano a quelli già presenti.
2. **Il grafo.** Tocca «Q-learning»: definizione, argomento, relazioni per tipo (richiede «Bellman equations», contrasta «SARSA»), e i passaggi da cui viene («L08 · slide 31»).
3. **Prepara l'esame.** Scrive una domanda e la griglia.
4. **Il triplo attacco.** Esterno, Letterale e Cavillatore in parallelo, Correttore sui voti.
5. **La scheda.** Prove, riscrittura proposta, decisione del docente, riattacco.
6. **La classe** (blocco 2). Otto studenti sintetici sostengono l'esame.
7. **Lato studente** (blocco 2). Lo stesso grafo in sola lettura.

## Architettura

Un solo Worker Cloudflare: API Hono, agenti su Durable Objects (Cloudflare Agents SDK), file statici del frontend Next.js. D1 per i dati. Modelli via OpenRouter dietro `app/backend/src/llm.ts`, unica porta di uscita.

```
browser ── /api/* ──▶ Hono ──▶ D1
   │                    │
   └── WebSocket ──▶ Agente (Durable Object) ──▶ llm.ts ──▶ OpenRouter
```

| Agente | Fase | Cosa ha in mano | Cosa fa |
|---|---|---|---|
| Cartografo | 02 | i passaggi di una fonte e i nomi dei concetti già nel grafo | estrae concetti, relazioni e argomenti; scrive in D1; trasmette l'avanzamento |
| Esterno | 03 | solo la domanda | risponde senza il corso |
| Letterale | 03 | solo grafo e passaggi | risponde citando, o dice che nel corso non c'è |
| Cavillatore | 03 | domanda e passaggi | cerca due letture difendibili |
| Correttore | 03 | risposta e griglia | voto per criterio |
| Revisore | 03 | i tre esiti | compone la scheda, propone la riscrittura |
| Studente (N) | 04 | i passaggi dei concetti che il profilo ha seguito | risponde alla domanda |
| Pianificatore | 05 | il percorso ordinato dal backend | spiega i collegamenti |

Modello predefinito `openai/gpt-6-luna`, scelto per agente da una mappa in `llm.ts` così si cambia in un punto solo. Ogni chiamata ha `max_tokens`.

## L'ontologia

### Modello dei dati (migrazione `0001_ontologia.sql`)

| Tabella | Colonne |
|---|---|
| `courses` | `id`, `name`, `description`, `created_at` |
| `sources` | `id`, `course_id`, `kind` (`document` o `transcript`), `title`, `lesson_date`, `status` (`queued`, `processing`, `done`, `error`), `error`, `created_at` |
| `passages` | `id`, `source_id`, `course_id`, `ordinal`, `locator` (per esempio `slide 31`), `text` |
| `topics` | `id`, `course_id`, `name`, `summary`, `ordinal` |
| `concepts` | `id`, `course_id`, `topic_id`, `name`, `slug`, `definition`, `kind` (`concetto`, `metodo`, `risultato`, `esempio`), `created_at`; unico (`course_id`, `slug`) |
| `concept_passages` | `concept_id`, `passage_id`, `role` (`definizione`, `uso`, `esempio`) |
| `relations` | `id`, `course_id`, `from_concept_id`, `to_concept_id`, `type`, `note`, `passage_id`; unico (`from`, `to`, `type`) |
| `model_calls` | `id`, `agent`, `model`, `prompt_tokens`, `completion_tokens`, `cost_usd`, `ref`, `created_at` |

Tipi di relazione, pochi e con un verso chiaro, da A verso B:

- `prerequisito`: A serve per capire B.
- `parte_di`: A è un componente di B.
- `generalizza`: A è il caso generale di B.
- `usa`: A si basa su B come strumento.
- `contrasta`: A e B sono alternative o si distinguono l'uno dall'altro.

La gerarchia è corso → argomento (`topics`) → concetto. Gli identificatori li genera sempre il backend.

### Il Cartografo, passo per passo

1. **Segmenta** (codice, nessun modello). Il testo diventa passaggi numerati. Se ci sono intestazioni `## Slide N` un passaggio è una slide; altrimenti intestazioni Markdown, poi blocchi di paragrafi fino a circa 1.200 caratteri.
2. **Estrae a finestre.** Finestre di passaggi consecutivi fino a circa 6.000 token. Per ogni finestra una chiamata che restituisce JSON: concetti (nome, definizione di una o due frasi fondata sul testo, tipo, passaggi di prova) e relazioni (da, a, tipo, nota, passaggio di prova). Nel prompt ci sono i nomi dei concetti già presenti nel corso, con l'istruzione di riusare il nome esatto quando è lo stesso concetto: è così che i concetti di file diversi si collegano. Al massimo 12 concetti per finestra, quelli che un docente metterebbe in un indice analitico, non ogni termine.
3. **Valida** (codice). L'uscita passa da uno schema. Si scartano concetti senza passaggio di prova, passaggi che non appartengono alla finestra, relazioni con un estremo che non si risolve, autoanelli. Il nome si normalizza in `slug`; se lo `slug` esiste si aggiungono le prove al concetto esistente.
4. **Scrive e trasmette.** Dopo ogni finestra scrive in D1 e aggiorna lo stato dell'agente (fonte, finestra corrente, conteggi, ultimi concetti aggiunti): il grafo cresce a schermo mentre lavora.
5. **Assegna gli argomenti.** A fonte finita, una chiamata assegna i concetti nuovi a un argomento esistente o ne crea uno. Pochi argomenti: fra 6 e 12 per corso.
6. **Chiude.** `sources.status = done`, oppure `error` con il motivo, visibile nell'interfaccia.

Una fonte alla volta per corso. Le trascrizioni delle lezioni (blocco 2) entrano dallo stesso percorso con `kind = transcript`.

### Rotte

| Rotta | Cosa fa |
|---|---|
| `GET /api/health` | stato e versione |
| `GET /api/courses` | elenco dei corsi |
| `POST /api/courses` | crea un corso `{name, description}` |
| `GET /api/courses/:id/sources` | fonti con stato e conteggi |
| `POST /api/courses/:id/sources` | `{title, kind, text, lessonDate?}`: crea fonte e passaggi, avvia il Cartografo, risponde `{sourceId}` |
| `GET /api/courses/:id/graph` | `{topics, concepts, relations}`; ogni concetto con `degree` e `passageCount` |
| `GET /api/concepts/:id` | concetto, argomento, relazioni con i vicini, passaggi con `locator` e titolo della fonte |
| `PATCH /api/concepts/:id` | il docente corregge nome o definizione |
| `DELETE /api/concepts/:id` | il docente toglie un concetto sbagliato, con le sue relazioni |
| `GET /api/usage` | chiamate e costo di oggi |
| WebSocket `/agents/cartografo/:courseId` | stato del Cartografo in tempo reale |

Errori sempre come `{error: {code, message}}` con lo stato HTTP giusto.

## Interfaccia del grafo

Stile Obsidian nella meccanica, sobria nell'aspetto. Token e componenti in `docs/design-system.md`.

- **Tela.** Grafo a forze su canvas. Un nodo è un concetto: colore per argomento, raggio per numero di relazioni. Archi sottili; `prerequisito` ha la freccia, `contrasta` è tratteggiato.
- **Fuoco.** Passando sopra un nodo (desktop) o toccandolo (telefono) restano accesi il nodo e i suoi vicini, il resto si attenua. Le etichette compaiono per i nodi più connessi e, avvicinandosi, per tutti.
- **Cerca.** Un campo che trova un concetto per nome e ci porta la tela.
- **Filtri.** Gli argomenti come chip: uno o più accesi.
- **Dettaglio.** Definizione, argomento, tipo, relazioni raggruppate per tipo e cliccabili, passaggi di prova con fonte e posizione («L08 · slide 31»). Per il docente: correggi, elimina.
- **Dal vivo.** Mentre il Cartografo lavora, una striscia dice cosa sta leggendo e quanti concetti ha aggiunto; i nodi nuovi entrano senza rifare il layout da capo.
- **Stati.** Vuoto (nessuna fonte: invito a caricare), in lavorazione, errore della fonte.

Desktop: barra di navigazione a sinistra, tela al centro, dettaglio in un pannello a destra che non copre la tela. Telefono: barra in basso, tela a tutto schermo, dettaglio in un foglio dal basso che si trascina a metà o a tutta altezza, ricerca in alto, gesti di trascinamento e pizzico sulla tela. Niente dipende dal passaggio del mouse. Bersagli da almeno 44 px, `100dvh`, margini di sicurezza dei telefoni.

Pagine del guscio: `/` grafo del corso, `/materiali` fonti e caricamento, poi `/esame`, `/classe`, `/studente` nelle fasi successive (nel guscio compaiono solo quando esistono). In alto il nome del corso e il selettore di ruolo, dichiarato simulato.

## Sicurezza

1. **La chiave non esce dal Worker.** `OPENROUTER_API_KEY` solo in `.dev.vars` e in `wrangler secret`. Il frontend chiama solo `/api`.
2. **Documenti e trascrizioni sono dati non fidati.** Possono contenere frasi scritte per pilotare un modello. Nel prompt stanno dentro delimitatori, con l'istruzione che sono materiale da analizzare e non comandi. Il Cartografo non ha strumenti: produce solo JSON, che passa dallo schema e dalla validazione prima di toccare D1. Un passaggio non può far scrivere fuori dal proprio corso.
3. **Limiti in ingresso.** Solo testo e Markdown. Al massimo 300.000 caratteri per fonte e 40 fonti per corso. Titoli e nomi con lunghezza massima. Corpo delle richieste validato con uno schema.
4. **Niente HTML dai dati.** Tutto ciò che viene da documenti e modelli si mostra come testo: mai `dangerouslySetInnerHTML`, mai Markdown reso come HTML.
5. **SQL solo con parametri legati.**
6. **Tetto di spesa.** Ogni chiamata passa da `llm.ts`, che la registra in `model_calls` e rifiuta con un errore chiaro quando il totale del giorno supera `DAILY_BUDGET_USD` (1,50 di default). Protegge la chiave con l'URL pubblico.
7. **Codice demo sulle scritture.** Se il segreto `DEMO_CODE` è impostato, le rotte che scrivono o chiamano modelli chiedono l'intestazione `x-demo-code`; le letture restano aperte. L'interfaccia lo chiede una volta. In locale è spento. Non è un login: è dichiarato fra le simulazioni come sostituto del login d'ateneo.
8. **Stessa origine.** Nessun CORS aperto online; in sviluppo è ammesso solo `localhost`. Intestazioni di sicurezza di Hono.
9. **Il ruolo studente è in sola lettura lato server**, non solo nell'interfaccia: le rotte dello studente non espongono domande, attacchi, griglie o profili.
10. **Microfono** (blocco 2): chiesto solo al clic; l'audio non si conserva, resta la trascrizione.
11. **Nessun segreto e nessun materiale del corso nel repository.**

## Cosa è vero e cosa è simulato

Vero: estrazione dell'ontologia dal materiale, tutte le chiamate ai modelli, dati in D1, tempo reale. Simulato, come nella proposta: login e ruoli (selettore e codice demo), profili degli studenti della classe (sintetici).

## Fasi di build

| Fase | Consegna | Si prova così |
|---|---|---|
| 02 · Scheletro, ontologia e grafo | Worker, D1, guscio del frontend, Cartografo, rotte dell'ontologia, pagina del grafo e pagina dei materiali, script di semina | carico L08 da `/materiali`, vedo i concetti comparire, apro «Q-learning» e leggo le slide di prova, su desktop e su telefono |
| 03 · Triplo attacco | Domande, griglia, Esterno, Letterale, Cavillatore, Correttore, Revisore, scheda, riattacco | una domanda, tre esiti con prova; riscrivo, l'esito cambia |
| 04 · Classe simulata | Profili sintetici, un agente per studente, griglia studenti per domande | la griglia si riempie, clic su una cella mostra la risposta |
| 05 · Lezione, argomenti, lato studente | Registrazione e trascrizione, «fatto a lezione», vista studente in lettura, piano di studio se avanza | registro un minuto, un nodo si segna come spiegato |
| 06 · Consegna | README, architettura, tre esempi di interazione, registrazione di riserva, pitch | |

La fase 02 la fa un agente solo. Dalla 03 in poi i moduli indipendenti vanno in parallelo, ognuno nella sua worktree.

**File comuni, dell'orchestratore:** `wrangler.jsonc`, guscio del frontend (`app/frontend/app/layout.tsx`, navigazione), `app/frontend/lib/api.ts`, numerazione delle migrazioni. Migrazioni assegnate: `0001` ontologia, `0002` esame e attacchi, `0003` classe, `0004` lezioni.

**Semina.** `app/backend/scripts/seed.mjs` crea il corso e carica le fonti di `materiale-locale/reinforcement-learning/` chiamando l'API, una alla volta, con un parametro per limitarsi alle prime N. In sviluppo si provano una o due lezioni; il corso intero si carica una volta sola.

## Decisioni di Luca delle 13:05

- **Modello.** `openai/gpt-6-luna` per tutti gli agenti del prodotto.
- **Ontologia iniziale preparata con un modello più capace.** L'ontologia di partenza del corso la estrae un agente Claude dal materiale vero, la scrive in `materiale-locale/reinforcement-learning/ontologia.json` (fuori da Git) e si carica con `seed.mjs --ontologia` attraverso la rotta `POST /api/courses/:id/ontology`, che applica la stessa validazione del Cartografo. I caricamenti fatti dall'app, in demo e in «produzione», li lavora il Cartografo con Luna. Nella demo e nel pitch si dice così: il grafo di partenza è stato preparato prima, quello che si carica dal vivo lo estrae l'agente del prodotto. Non si presenta il grafo iniziale come uscito da Luna.
- **Ordine dei lavori.** Piano scritto, poi analisi contrastante di Astra sul piano, poi implementazione con più agenti. Tutto il blocco 1 (ontologia e grafo, triplo attacco, scheda e riattacco), poi una validazione con un agente che usa Playwright, poi Luca lo prova su `localhost`. Il resto prosegue in background.

## Fase 03, il triplo attacco: contratto

Parte dal commit dello scheletro della fase 02, in una worktree sua, branch `feat/triplo-attacco`. Porte: backend 8788, frontend 3001.

### Dati (migrazione `0002_esame.sql`)

| Tabella | Colonne |
|---|---|
| `exams` | `id`, `course_id`, `title`, `created_at` |
| `questions` | `id`, `exam_id`, `course_id`, `ordinal`, `current_version_id`, `created_at` |
| `question_versions` | `id`, `question_id`, `version`, `text`, `rubric` (JSON, elenco di `{criterion, points}`), `max_points`, `origin` (`docente`, `proposta_approvata`, `proposta_modificata`), `created_at` |
| `attack_runs` | `id`, `question_version_id`, `status` (`running`, `done`, `error`), `created_at`, `finished_at` |
| `attacks` | `id`, `run_id`, `agent` (`esterno`, `letterale`, `cavillatore`), `status`, `answer`, `finding` (JSON), `created_at` |
| `grades` | `id`, `attack_id`, `reading_index`, `total`, `max`, `per_criterion` (JSON, `{criterion, awarded, max, why}`), `created_at` |
| `reviews` | `id`, `run_id`, `verdicts` (JSON), `proposed_text`, `proposed_rubric`, `rationale`, `created_at` |
| `decisions` | `id`, `question_id`, `from_version_id`, `to_version_id`, `action` (`approvata`, `modificata`, `tenuta`), `created_at` |

### Gli agenti e cosa possono vedere

L'isolamento è nel codice, non nel prompt: la funzione che costruisce il contesto di ogni agente riceve solo ciò che gli spetta.

| Agente | Riceve | Non riceve | Produce (`finding`) |
|---|---|---|---|
| Esterno | il testo della domanda | corso, griglia | `{answer}` |
| Letterale | domanda e passaggi recuperati dal corso | griglia | `{answer, citations: [passageId], missing: bool, verbatim: bool}`; ogni citazione deve essere uno dei passaggi ricevuti, altrimenti si scarta; senza citazioni valide `missing = true` |
| Cavillatore | domanda e passaggi recuperati | griglia | `{found: bool, readings: [{assumption, answer, passageId?}]}`; al massimo due letture; `found = false` è un esito valido |
| Correttore | una risposta, la griglia, i passaggi recuperati come riferimento | chi ha scritto la risposta | voto per criterio con il perché |
| Revisore | domanda, griglia, i tre esiti con i voti | | `verdicts`, proposta di riscrittura, motivazione |

- **Recupero dei passaggi.** Senza embedding: ricerca a testo pieno (FTS5 di D1) sui passaggi del corso con i termini della domanda, più i passaggi di prova dei concetti il cui nome compare nella domanda e dei loro vicini di primo grado nel grafo. Al massimo 12 passaggi. I concetti toccati si salvano con la domanda: servono alla copertura.
- **Verdetti del Revisore**, uno o più: `copiabile` (l'Esterno prende almeno il 70% dei punti), `non_nel_corso` (`missing`), `ricavabile_copiando` (`verbatim`), `ambigua` (`found` e le due letture prendono voti diversi, oppure sono entrambe da punti pieni con risposte incompatibili), `nessun_controesempio`. Le soglie le applica il backend sui voti; il modello scrive solo la motivazione e la proposta.
- **Un agente per ruolo** su Durable Objects, istanza per esecuzione. I tre attaccanti partono in parallelo; ogni risposta va al Correttore; con i tre voti parte il Revisore. Il testo arriva al frontend mentre viene scritto.

### Rotte

| Rotta | Cosa fa |
|---|---|
| `GET /api/courses/:id/exams`, `POST /api/courses/:id/exams` | elenco e creazione `{title}` |
| `GET /api/exams/:id` | domande con versione corrente e ultimo esito |
| `POST /api/exams/:id/questions` | `{text, rubric}`: crea la domanda e la versione 1. Senza griglia risponde 422 «serve la griglia di correzione» |
| `POST /api/questions/:id/attack` | avvia un'esecuzione sulla versione corrente, risponde `{runId}` |
| `GET /api/runs/:id` | attacchi, voti, scheda |
| `POST /api/questions/:id/decision` | `{action, text?, rubric?}`: `approvata` adotta la proposta, `modificata` adotta il testo del docente, `tenuta` non cambia niente. Solo questa rotta crea una nuova versione |
| `GET /api/questions/:id/versions` | storia delle versioni con gli esiti, per il confronto prima e dopo |
| WebSocket `/agents/<ruolo>/:runId` | stato e testo in tempo reale |

### Il confine, nel codice

- Nessun agente può scrivere in `question_versions`: lo fa solo la rotta della decisione, chiamata dal docente.
- Senza griglia non si corregge e non si attacca.
- L'interfaccia e il Revisore non usano mai «esame valido», «equo» o «a prova di AI». L'esito migliore possibile è «nessun controesempio trovato».
- Niente sugli studenti veri.

### Interfaccia

Pagina `/esame`, voce «Esame» nel guscio.

- **Elenco delle domande** con l'ultimo esito come etichette. Azione principale: «Nuova domanda».
- **Nuova domanda**: testo e griglia a righe (criterio, punti).
- **Domanda**: «Attacca la domanda». I tre agenti in tre colonne su desktop e in tre schede affiancate da scorrere su telefono, ognuno con cosa ha in mano scritto in chiaro, il testo che arriva, poi il voto per criterio.
- **Scheda**: verdetti con la prova accanto (`SourceRef` per i passaggi), proposta di riscrittura modificabile, tre azioni: «Approva e riattacca», «Modifica e riattacca», «Tieni com'è».
- **Prima e dopo**: le versioni in fila con i voti dei tre agenti su ciascuna.

Riusa il guscio, `DetailPanel`, `SourceRef`, `AgentStrip`. Minima e fluida, desktop e telefono alla pari, come in `docs/design-system.md`.

### Punti di aggancio ai file comuni

Il modulo aggiunge, in blocchi delimitati da un commento `fase 03`: i binding e il tag di migrazione dei suoi Durable Object in `wrangler.jsonc`, le sue funzioni in fondo a `lib/api.ts`, la voce «Esame» nella navigazione, il montaggio delle sue rotte nell'ingresso del Worker. Nient'altro nei file comuni: i conflitti li risolve l'orchestratore al merge.

### Domande per la demo

Tre domande di Reinforcement Learning scritte dall'orchestratore con Luca, salvate dallo script di semina: una che un modello generico risolve senza il corso, una ambigua, una che dipende da ciò che è specifico del corso. Il comportamento degli agenti su queste domande è quello vero: se non trovano il difetto atteso si cambia la domanda, non l'esito.

## Dopo l'analisi contrastante di Astra (13:15)

Fatta da un agente Codex `gpt-6-astra` sul piano, in sola lettura: 30 punti, 8 bloccanti. Qui quello che cambia; dove questa sezione e il resto del piano differiscono, vale questa. Gli agenti in corso hanno già ricevuto queste correzioni nel loro compito.

**Contratti e dati**

- Il modulo 03 lavora nei suoi file (`app/backend/src/esame/`, `0002_esame.sql`, `app/frontend/app/esame/`, `components/esame/`) e tocca i file comuni solo nei quattro agganci delimitati. Non cambia la firma di `llm.ts`.
- **Importazione dell'ontologia**: `POST /api/courses/:id/ontology` con concetti e relazioni che citano le prove come titolo della fonte più numero di slide; il server le risolve nei suoi identificatori. Le fonti si caricano prima con `extract = false`. Rifare l'importazione lascia lo stesso grafo e restituisce l'elenco dei riferimenti respinti.
- **Ricerca a testo pieno**: la possiede la fase 03, nella migrazione `0002`, con chiave intera, riempimento dei passaggi esistenti e trigger. I termini si mettono fra virgolette e si uniscono con OR.
- **Coordinamento**: un Durable Object coordina ogni esecuzione; lo stato è in D1 prima della risposta 202; passi idempotenti; un timeout e un solo nuovo tentativo per chiamata; un timeout terminale per esecuzione; una sola esecuzione attiva per domanda.
- **Voti**: una riga per (`attack_id`, `reading_index`). Il Cavillatore produce esattamente due letture oppure nessuna. Il Revisore parte quando i tre attaccanti sono terminati e ogni risposta ha un voto o un errore.
- **Decisione**: `{reviewId, expectedVersionId, action, text?}`, 409 se la versione è superata, scrittura in un solo batch. Il Revisore propone solo il testo: la griglia resta quella del docente, così prima e dopo si confrontano.
- **Griglia**: `{id, criterion, points, expected?}`. Il Correttore riceve anche la domanda; il backend controlla i voti per criterio e ricalcola il totale.
- **Idempotenza del Cartografo**: hash del contenuto della fonte, scrittura per finestra con upsert, ripresa dall'ultima finestra completata.

**Cosa si può affermare, e con quali parole**

- Il contesto di un agente si chiama «accesso limitato ai passaggi del corso», non «sa solo questo»: il modello conosce comunque la materia. Vale anche per la classe simulata.
- Le citazioni del Letterale sono estratti verificati dal backend come sottostringhe dei passaggi ricevuti.
- Verdetti, calcolati dal backend: «Questo modello supera la soglia senza i materiali» (con modello, voto e soglia), «Prove insufficienti nei passaggi recuperati» (non «non è nel corso»), «Ambiguità candidata» (la giudica il docente), «Nessun controesempio trovato» (solo se i tre attacchi sono completi), «Analisi incompleta».
- Fuori da demo e pitch: «a prova di AI», «equo», «non si copia». Il sottotitolo della proposta visiva («domande che non si copiano») è superato da questa regola.
- Il recupero salva termini, concetti e passaggi usati: l'interfaccia li mostra come percorso. È questo che rende il grafo parte del ragionamento e non una decorazione.

**Sicurezza**

- Con `DEMO_CODE` impostato lo richiedono tutte le rotte `/api` tranne `/api/health`, letture comprese, e le connessioni agli agenti: il grafo espone estratti delle slide. Controllo dell'origine sui WebSocket. I client non modificano lo stato degli agenti.
- Il costo massimo di una chiamata si prenota prima di farla e si riconcilia dopo. Sottobudget per ambiente: 0,60 $ al giorno per ogni worktree in sviluppo.

**Materiale e demo**

- Le slide con solo titolo o figure danno passaggi quasi vuoti: si segnano come «testo non estratto» e non valgono come prova di assenza.
- Il caricamento dal vivo usa una fonte che non è nell'ontologia iniziale, altrimenti non aggiunge niente a schermo.
- Le tre domande della demo: A (aggiornamento Q-learning, risolvibile senza il corso), B (episodio che «si conclude»: stato terminale o interruzione esterna, due letture), C (la dimostrazione assegnata nella L08, che dipende dal corso). Il comportamento degli agenti su queste domande è quello vero.
- Per la consegna servono tre esempi reali di interazione con percorso e fonti, uno con contesto insufficiente dichiarato, e uno in cui una richiesta di applicare da sola la riscrittura viene respinta.

**Non raccolto, per tempo**: ticket a scadenza per i WebSocket (basta codice e origine), protocollo di eventi con numeri di sequenza (bastano snapshot e rilettura), seconda passata di fusione dei sinonimi, provenienza delle correzioni del docente.

**Ordine dei tagli se si sfora**: piano di studio e coerenza fra appelli, poi audio, poi classe, poi vista dello studente, poi animazioni del grafo.

## Decisioni di Luca delle 13:15

- **Trascrizione**: `google/gemini-3.8-flash` via OpenRouter (accetta audio; 0,825 $ per milione di token in ingresso e 4,125 in uscita, catalogo del 14/11/2026). È l'unica eccezione a Luna, solo per trascrivere la lezione registrata. Si prova con un minuto di audio in italiano e si misura il costo.
- **Blocchi in sequenza, ognuno nella sua worktree.** Blocco 1 (fasi 02 e 03), poi blocco 2 (classe, lezione registrata, argomenti, lato studente), poi blocco 3 (piano di studio). Ogni worktree finita si prova con Playwright. Prima di integrare un blocco si prova la fusione con il precedente: il branch del blocco 2 riceve il blocco 1 e si riprova, e così il 3 con il 2. I branch dei blocchi restano separati finché la fusione non è provata.
- **Luca valida il blocco 1 su `localhost`** dopo la corsa di Playwright; intanto il blocco 2 parte in background.
- **Video dell'idea** già in lavorazione in una worktree di `ad-studio`: punti dolenti di docente e studenti, tutte le funzionalità, nome dell'app. Le funzionalità non ancora costruite compaiono come «in arrivo». Storyboard e MP4 arrivano in `pitch/`.

## Il pezzo più rischioso e il ripiego

L'estrazione con un modello economico può dare concetti doppi, relazioni vaghe o JSON non valido.

- Prima misura: dopo la prima lezione si guardano a occhio i concetti di L08 contro quelli che un corso di RL deve avere (Q-learning, SARSA, TD error, on-policy e off-policy).
- Ripiego 1: una seconda passata a fine fonte che fonde i sinonimi.
- Ripiego 2: solo argomenti e concetti con le prove, relazioni limitate a `prerequisito`.
- Ripiego 3, da chiedere a Luca: un modello più capace solo per il Cartografo (`openai/gpt-6-sol` costa venti volte Luna: l'intero corso passerebbe da pochi centesimi a qualche decina).
- Si decide entro le 14:15.

## Punti aperti

- **Ora e formato della consegna finale.**
