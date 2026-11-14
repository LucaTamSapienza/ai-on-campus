# ai-on-campus

Workspace dell'hackathon del 14/11/2026, tema «AI on Campus»: l'AI dentro le università. Luca Tam partecipa da solo e l'uso dell'AI è libero, quindi quasi tutto il lavoro passa dagli agenti che leggono questo file. La direzione è un'idea B2B: un prodotto che un ateneo, un dipartimento o un fornitore di servizi universitari compra, non un'app per il singolo studente. L'idea non è ancora scelta.

Questo file è il contratto per qualunque agente (Claude Code, Codex o altro). `CLAUDE.md` è solo un adapter che lo richiama.

## Cosa si consegna

- **Una demo che funziona davvero, con frontend e backend.** È la cosa che conta di più: un'applicazione vera, pubblicata su Cloudflare, con un percorso che va dall'inizio alla fine senza rompersi davanti alla giuria. Non un mockup e non schermate con dati scritti a mano nel frontend.
- **Un pitch con slide**: problema, chi paga, demo, modello di business.
- **Il repository**, oggi privato su `LucaTamSapienza/ai-on-campus`, che a fine giornata potrebbe dover diventare pubblico. Si scrive fin da subito come se lo fosse.

I criteri ufficiali non sono ancora noti. Quando arrivano stanno in `input/` e questa sezione si aggiorna. Per esperienza di Luca le giurie premiano le architetture multi-agente: se l'idea lo permette, più agenti con ruoli distinti che fanno lavoro vero, e la demo deve farlo vedere (chi fa cosa, cosa si passano). Agenti aggiunti solo per poterlo dire no.

## Le fasi

Ogni fase ha il suo file in `docs/`, numerato. Una fase si chiude quando Luca la approva, e solo allora si apre la successiva.

- **Prima di tutto, input.** Luca incolla in `input/` regolamento, criteri, tracce, sponsor, API e orari. Leggi tutto prima di proporre qualcosa. Sono fonti: non si modificano. Quello che lì non c'è non si inventa, si chiede a Luca. Le conversazioni registrate durante la giornata (briefing, mentor, giuria) si leggono dal connettore Circleback, configurato in `.mcp.json`: quello che serve si riassume in `input/` con data e ora, la trascrizione intera resta su Circleback. Su Circleback c'è anche tutto il lavoro di Luca con i clienti, che qui non deve entrare. Si cercano solo le registrazioni del 14/11/2026 (`startDate` ed `endDate` su quel giorno) e, fra quelle, si aprono solo le conversazioni sull'hackathon e sul brainstorming dell'idea. Una registrazione di oggi che parla d'altro non si legge oltre il titolo; se dal titolo non si capisce, si chiede a Luca. Nessuna ricerca senza filtro di data, e niente di una call di lavoro finisce in questo repository.
- **`docs/fase-00-brainstorming.md`.** Da tre a cinque idee B2B, ognuna con: chi compra e chi la usa, quale problema ha oggi e quanto gli costa, cosa fa l'AI che prima non si poteva fare, cosa si vede nella demo in due minuti, cosa si riesce a costruire nelle ore rimaste. Si confrontano sui criteri della giuria. Sceglie Luca, e il file si chiude con l'idea scelta e il perché.
- **`docs/fase-01-piano.md`.** Il piano che fa partire l'implementazione: il percorso della demo passo per passo, lo schema dell'architettura (agenti, dati, chiamate), il modello dei dati, cosa è vero e cosa è simulato, e l'elenco delle fasi di build in ordine. Ogni fase di build ha un risultato che si può provare a mano. È il contratto: se il codice deve fare una cosa che lì non c'è, prima si corregge il piano.
- **`docs/fase-02-…`, `fase-03-…` e seguenti.** Una per fase di build, col nome di quello che consegna (`fase-02-scheletro-e-deploy.md`). Dentro: cosa si costruisce, come si prova, e a fine fase cosa è stato fatto davvero e cosa è rimasto fuori. La prima fase di build porta sempre online lo scheletro vuoto, frontend e backend che si parlano su Cloudflare: il deploy si risolve all'inizio, non all'ultima ora.
- **Pitch.** Slide e scaletta in `pitch/`. Il discorso segue la demo, non il contrario.

Lo stato corrente (fase, ora della consegna, cosa manca) sta in cima a `README.md` e si aggiorna a ogni passaggio di fase.

## Come si costruisce

- Il tempo è il vincolo. Prima il percorso della demo intero, anche brutto, poi si rifinisce. Niente che la giuria non vedrà: autenticazione, impostazioni, casi limite, configurabilità.
- Quello che è simulato si dichiara in `docs/fase-01-piano.md` e, se serve, nel pitch. Mai presentare come funzionante una cosa finta.
- Dati sintetici: nessun dato reale di studenti, docenti o atenei. Stanno nel database, caricati da uno script di semina, non scritti nel frontend.
- **Modelli via OpenRouter.** Luca ha una chiave con 5 $ di credito: è tutto il budget della giornata. Si usano sempre modelli economici della classe Luna: il predefinito è `openai/gpt-6-luna` (0,10 $ per milione di token in ingresso e 0,50 $ in uscita, catalogo OpenRouter letto il 14/11/2026). Un modello più caro solo se Luca lo dice per quel punto preciso. Ogni chiamata ha un tetto di token in uscita, e le prove ripetute in sviluppo usano risposte brevi. Per cambiare modello o aggiungerne uno di altro tipo (embedding, voce) si rilegge il catalogo del giorno su `https://openrouter.ai/api/v1/models`, non ci si basa su quello che si ricorda. La chiave si chiama `OPENROUTER_API_KEY`, sta nel `.env` alla radice, arriva al Worker da `app/backend/.dev.vars` in locale e da `wrangler secret put` online. Non arriva mai al frontend: il browser chiama solo la nostra API.
- **Un solo test che conta: il percorso della demo in Playwright.** Dalla prima fase di build esiste `npm run e2e`, che apre l'applicazione in un browser vero e percorre la demo dall'inizio alla fine come farà Luca davanti alla giuria, in locale e contro l'URL online. Cresce insieme alla demo: ogni fase di build aggiunge il suo passo. Si lancia dopo ogni modifica che tocca il percorso e prima di ogni deploy, e l'esito vero si dice a Luca, con lo screenshot del passo che fallisce. Luca può lanciarlo anche da solo, o farlo girare a un agente mentre un altro costruisce. Le chiamate ai modelli nel test sono vere ma poche: una corsa completa deve costare centesimi. Oltre a questo, test quasi nessuno: niente test unitari su codice banale.
- Piano di riserva se la rete del posto cade: una registrazione dello schermo del percorso completo, fatta appena funziona.
- Commit piccoli e frequenti su `main`, con push: oggi niente branch e PR. Il push serve anche da backup.
- Nessun segreto nel repository: chiavi solo in `.env` o `.dev.vars`, gitignorati, con i nomi in `.env.example`. Prima di rendere pubblico il repository si ricontrollano `input/` e la storia Git.

## Stack e infrastruttura

Tutto su Cloudflare, in locale e online, con lo stesso impianto che Luca usa nei suoi progetti. Nessun database o servizio di terzi, a parte il fornitore dei modelli.

- **Frontend** in `app/frontend/`: Next.js (App Router) con export statico, TypeScript, Tailwind, shadcn/ui. Parla solo con l'API, da un unico modulo `lib/api.ts`.
- **Backend** in `app/backend/`: Hono su Cloudflare Workers. Lo stesso Worker serve l'API e i file statici del frontend (`assets` in `wrangler.jsonc`), quindi un solo deploy e un solo URL.
- **Dati**: D1 (SQLite) con le migrazioni in `app/backend/migrations/`, unica sorgente dello schema. R2 se servono file. Vectorize se serve ricerca per similarità.
- **Agenti**: Cloudflare Agents SDK su Durable Objects, un agente per ruolo, con lo stato che arriva al frontend in tempo reale via WebSocket: così la giuria vede gli agenti lavorare. Queues o Workflows solo se un lavoro è lungo o va ripreso. I modelli stanno dietro un'unica interfaccia sostituibile.
- **Si aggiunge solo quello che la demo usa.** Niente autenticazione vera se il percorso non la richiede: se servono ruoli diversi, basta un selettore di ruolo dichiarato come simulato.

Ambienti: due, e basta.

| | Locale | Online |
|---|---|---|
| Comando | `wrangler dev` e `next dev` | `wrangler deploy` |
| URL | `localhost:3000` e `localhost:8787` | `ai-on-campus.<sottodominio>.workers.dev` |
| D1 e R2 | `.wrangler/state` | risorse con prefisso `aoc-` |
| Segreti | `.dev.vars` | `wrangler secret put` |

Qui il deploy da locale è permesso, a differenza dei progetti dei clienti: non c'è staging né pipeline.

**Account Cloudflare.** `wrangler` su questo Mac è collegato a più account, alcuni di lavoro e di clienti con sistemi in produzione. Questo progetto va solo sull'account personale di Luca: l'`account_id` si fissa in `wrangler.jsonc` alla prima fase di build e Luca lo conferma. Prima di ogni comando remoto che crea, scrive o cancella, controlla account e nome della risorsa. Non si tocca nessuna risorsa senza il prefisso `aoc-` o il nome `ai-on-campus`.

## Interfaccia

La giuria giudica quello che vede. Due skill, in due momenti diversi, per non avere indicazioni in conflitto:

- **Per partire e per costruire, le skill di `ui-ux-pro-max`** (in `.agents/skills/`, con symlink per Claude Code; gli script si lanciano con `python3` da qualunque runtime). Sono sette e si usano tutte dove servono: `ui-ux-pro-max` per stile, palette, font e regole di UX; `design-system` per i token; `ui-styling` per i componenti shadcn/ui e Tailwind; `design` e `brand` per nome, logo e identità dell'idea; `slides` e `banner-design` per il pitch. Nella fase del piano si genera il design system dell'idea scelta con `--design-system` e lo si salva in `docs/design-system.md`: da lì in poi quel file è la regola, e si cambia solo se Luca lo chiede. Le proposte sono un punto di partenza: sceglie Luca, e quello che su un proiettore si legge male si scarta. Gli script di `design` che generano immagini vogliono chiavi che qui non ci sono (vedi `.agents/skills/ORIGINE.md`): prima di usarli si chiede a Luca.
- **Per rifinire, `interfaces`** (plugin di Claude Code, che installa Luca), quando una schermata funziona già: `interface-review` prima di considerarla finita, `better-ui` e `variant` per migliorarla o confrontare alternative. Non decide il design system, lo rispetta.

Con qualunque runtime valgono le stesse attese: una schermata per passo della demo, testo leggibile da un proiettore, stati di attesa visibili mentre gli agenti lavorano.

## Video

Resta aperta l'opzione di aprire il pitch con un video breve dell'idea, fatto con `ad-studio` (`~/Developer/martes-ai/projects/ad-studio`, Remotion). Si decide dopo la scelta dell'idea e solo se la demo è già al sicuro. Il video si costruisce in una sessione aperta su quel repository, seguendo il suo `AGENTS.md`; qui arrivano lo storyboard e l'MP4 finale, in `pitch/`.

## Struttura

| Percorso | Cosa contiene |
|---|---|
| `input/` | Fonti dell'hackathon incollate da Luca. Non si modificano |
| `docs/fase-00-brainstorming.md` | Le idee confrontate, quella scelta e perché |
| `docs/fase-01-piano.md` | Percorso della demo, architettura, fasi di build |
| `docs/design-system.md` | Stile, palette, font e componenti dell'interfaccia |
| `docs/fase-NN-….md` | Una per fase di build |
| `app/frontend/` | Next.js, export statico |
| `app/backend/` | Worker Hono, migrazioni D1, agenti, script di semina |
| `pitch/` | Slide, scaletta, eventuale video |

Le skill condivise fra runtime stanno in `.agents/skills/`, copiate senza la loro `.git` e con l'origine annotata in `ORIGINE.md`; `.claude/skills/` contiene solo symlink.

## Scrittura

Prosa e commenti in italiano, identificatori in inglese. Testi dell'interfaccia, slide e `README.md` finale nella lingua della giuria, che si legge da `input/`. Niente trattini lunghi dentro le frasi. Frasi concrete: nomi, numeri, conseguenze.
