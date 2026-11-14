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

## Il pezzo più rischioso e il ripiego

L'estrazione con un modello economico può dare concetti doppi, relazioni vaghe o JSON non valido.

- Prima misura: dopo la prima lezione si guardano a occhio i concetti di L08 contro quelli che un corso di RL deve avere (Q-learning, SARSA, TD error, on-policy e off-policy).
- Ripiego 1: una seconda passata a fine fonte che fonde i sinonimi.
- Ripiego 2: solo argomenti e concetti con le prove, relazioni limitate a `prerequisito`.
- Ripiego 3, da chiedere a Luca: un modello più capace solo per il Cartografo (`openai/gpt-6-sol` costa venti volte Luna: l'intero corso passerebbe da pochi centesimi a qualche decina).
- Si decide entro le 14:15.

## Punti aperti

- **Trascrizione della lezione.** Nel catalogo OpenRouter di oggi non risultano modelli che accettano audio. Luca ha indicato un modello al posto di Workers AI ma il nome non è chiaro: da confermare prima della fase 05.
- **Ora e formato della consegna finale.**
