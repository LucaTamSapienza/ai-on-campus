# ai-on-campus

Workspace dell'hackathon del 14/11/2026, tema «AI on Campus»: l'AI dentro le università. Luca Tam è in squadra con altri compagni, ma ognuno lavora per conto suo: si ragiona insieme sull'idea, poi repository, codice e agenti di questo workspace sono solo di Luca. L'uso dell'AI è libero, quindi quasi tutto il lavoro passa dagli agenti che leggono questo file. La direzione è un'idea B2B: un prodotto che un ateneo, un dipartimento o un fornitore di servizi universitari compra, non un'app per il singolo studente. L'idea non è ancora scelta.

Questo file è il contratto per qualunque agente (Claude Code, Codex o altro). `CLAUDE.md` è solo un adapter che lo richiama.

## Cosa si consegna

- **Una demo che funziona davvero, con frontend e backend.** È la cosa che conta di più: un'applicazione vera, pubblicata su Cloudflare, con un percorso che va dall'inizio alla fine senza rompersi davanti alla giuria. Non un mockup e non schermate con dati scritti a mano nel frontend.
- **Un pitch con slide**: problema, chi paga, demo, modello di business.
- **Il repository**, oggi privato su `LucaTamSapienza/ai-on-campus`, che a fine giornata potrebbe dover diventare pubblico. Si scrive fin da subito come se lo fosse.

I criteri ufficiali non sono ancora noti. Quando arrivano stanno in `input/` e questa sezione si aggiorna. Per esperienza di Luca le giurie premiano le architetture multi-agente. Si parla del **prodotto** che si porta in demo, non di come si lavora in questo workspace: se l'idea lo permette, più agenti con ruoli distinti che fanno lavoro vero, e la demo deve farlo vedere (chi fa cosa, cosa si passano). Agenti aggiunti solo per poterlo dire no.

## Le fasi

Ogni fase ha il suo file in `docs/`, numerato. Luca approva due cose sole, in chat: l'idea scelta (fase 00) e la proposta visiva. Da lì in poi piano e build vanno avanti da soli, senza aspettare nessuno, fino a tutto il lavoro su `main`.

- **Prima di tutto, input.** Luca incolla in `input/` regolamento, criteri, tracce, sponsor, API e orari. Leggi tutto prima di proporre qualcosa. Sono fonti: non si modificano. Quello che lì non c'è non si inventa, si chiede a Luca. Le conversazioni registrate durante la giornata (briefing, mentor, giuria) si leggono dal connettore Circleback, configurato in `.mcp.json`: quello che serve si riassume in `input/` con data e ora, la trascrizione intera resta su Circleback. Su Circleback c'è anche tutto il lavoro di Luca con i clienti, che qui non deve entrare. Si cercano solo le registrazioni del 14/11/2026 (`startDate` ed `endDate` su quel giorno) e, fra quelle, si aprono solo le conversazioni sull'hackathon e sul brainstorming dell'idea. Una registrazione di oggi che parla d'altro non si legge oltre il titolo; se dal titolo non si capisce, si chiede a Luca. Nessuna ricerca senza filtro di data, e niente di una call di lavoro finisce in questo repository.
- **`docs/fase-00-brainstorming.md`.** Da tre a cinque idee B2B, ognuna con: chi compra e chi la usa, quale problema ha oggi e quanto gli costa, cosa fa l'AI che prima non si poteva fare, cosa si vede nella demo in due minuti, cosa si riesce a costruire nelle ore rimaste. Si confrontano sui criteri della giuria. Sceglie Luca, e il file si chiude con l'idea scelta e il perché.
- **`docs/proposta.html`, la proposta visiva.** Prima del piano, una pagina sola che fa vedere a Luca come si vuole costruire l'idea, da approvare a colpo d'occhio invece di leggere un documento. Stile da appunti scritti a mano, come uno schizzo su carta: il percorso della demo schermata per schermata (bozze dell'interfaccia, non grafica finita), lo schema di agenti, dati e chiamate, un grafico o due dove aiutano, l'elenco corto di cosa è simulato e perché (tutto il resto è vero), e i moduli in cui si dividerà il lavoro. Dentro ci sono sia il piano sia l'interfaccia: Luca deve poter decidere guardando solo questa pagina. HTML autonomo con CSS incorporato, niente dipendenze dal contenitore; in Claude Code si pubblica come Artifact e si dà il link a Luca. **Venti minuti al massimo**: è uno schizzo per decidere, non un deliverable, e non si rifinisce. Luca la approva o la corregge in chat; le correzioni si applicano alla pagina, poi si parte.
- **`docs/fase-01-piano.md`.** Scritto subito dopo l'approvazione della proposta, è per gli agenti che implementano e non aspetta un'altra approvazione. Il piano che fa partire l'implementazione: il percorso della demo passo per passo, lo schema dell'architettura (agenti, dati, chiamate), il modello dei dati, cosa è vero e cosa è simulato, il primo filo verticale, i moduli da parallelizzare con i loro confini, e per il pezzo più rischioso un ripiego più semplice con l'ora entro cui decidere. Ogni fase di build ha un risultato che si può provare a mano. È il contratto: se il codice deve fare una cosa che lì non c'è, prima si corregge il piano.
- **`docs/fase-02-…`, `fase-03-…` e seguenti.** Una per fase di build, col nome di quello che consegna (`fase-02-scheletro-e-deploy.md`). Dentro: cosa si costruisce, come si prova, e a fine fase cosa è stato fatto davvero e cosa è rimasto fuori. La prima fase di build porta sempre online lo scheletro vuoto, frontend e backend che si parlano su Cloudflare: il deploy si risolve all'inizio, non all'ultima ora.
- **Pitch.** Slide e scaletta in `pitch/`. Il discorso segue la demo, non il contrario.

Lo stato corrente (fase, ora della consegna, cosa manca) sta in cima a `README.md` e si aggiorna a ogni passaggio di fase.

## L'orario

L'hackathon dura circa 7 ore. Appena Luca dice l'ora di inizio e quella di consegna, si scrivono in cima a `README.md` con gli orari veri di questa tabella.

| Dall'inizio | Cosa | Si chiude quando |
|---|---|---|
| 0:00 – 0:40 | Input e brainstorming | Luca ha scelto l'idea |
| 0:40 – 1:00 | Proposta visiva | Luca l'ha approvata |
| 1:00 – 1:20 | Piano dettagliato e design system | il piano è su `main`, nessuna approvazione |
| 1:20 – 1:50 | Scheletro e filo verticale online | frontend e backend si parlano su Cloudflare |
| 1:50 – 5:00 | Build dei moduli in parallelo | tutto su `main`, il percorso della demo gira per intero |
| 5:00 | Stop alle funzioni nuove | da qui solo correzioni |
| 5:00 – 6:00 | Rifinitura e registrazione di riserva | |
| 6:00 – 7:00 | Pitch, con il video in background se Luca lo vuole | |

L'orario è un promemoria, non un cancello. **L'agente non si ferma mai ad aspettare l'orologio e non blocca Luca.** Quando una fase supera il suo tempo lo dice in una riga («il brainstorming doveva chiudersi alle 10:40, sono le 10:55: passiamo al piano?») e intanto continua a lavorare. Lo ripete a ogni risposta finché la fase non si chiude, senza insistere oltre quella riga.

Durante il brainstorming Luca discute con i compagni e la conversazione è registrata su Circleback. L'agente la rilegge quando Luca glielo chiede o quando serve un aggiornamento, porta in `docs/fase-00-brainstorming.md` le idee e le obiezioni emerse, e continua a prepararle (chi compra, cosa si vede in demo, cosa si riesce a costruire) mentre loro parlano. Non aspetta che la call finisca.

## Come si lavora in questo workspace

Luca dialoga con un solo orchestratore. L'orchestratore tiene il piano, decide l'ordine, lancia gli agenti e porta il lavoro su `main`; il codice lo scrivono gli agenti che lancia: Opus su Claude Code, il modello di lavoro equivalente sugli altri runtime. Dopo l'approvazione della proposta l'orchestratore non torna da Luca a chiedere conferme: va fino in fondo.

- **Prima in verticale.** Un solo filo che attraversa tutto: una schermata, una rotta, una tabella, un agente del prodotto che risponde, online. Finché questo filo non gira non si parallelizza niente. Il filo verticale costruisce anche il guscio comune del frontend: layout, navigazione, tema con i token di `docs/design-system.md`, i componenti condivisi e `lib/api.ts`. I moduli ci entrano dentro, non se ne fanno uno ciascuno.
- **Poi in parallelo, per moduli.** Il piano divide il resto in moduli con confini chiari (file e rotte di ciascuno). Ogni modulo va a un agente, nella sua worktree e sul suo branch. I contratti fra moduli (forma delle rotte, tabelle) si fissano nel piano prima di lanciarli, così non si pestano i piedi. Il compito che l'orchestratore dà a ogni agente dice il modulo, i suoi file, i contratti e le skill da usare: chi tocca il frontend riceve sempre `docs/design-system.md`, le skill `design-system` e `ui-styling`, l'indicazione di riusare il guscio e i componenti esistenti e la regola «minima e fluida» della sezione «Interfaccia». Un agente non deve indovinare quali skill servono.
- **L'orchestratore integra.** Mergia le PR una alla volta, nell'ordine che evita conflitti, e controlla che su `main` l'app parta ancora.
- **Un avviso a metà, senza fermarsi.** Quando il filo verticale è online l'orchestratore lo dice a Luca in una riga con l'URL, e prosegue con i moduli. Luca ci dà un'occhiata quando vuole: un problema visto lì costa minuti, visto alla fine costa ore.
- **Alla fine tutto è su `main`, e funziona davvero.** Tutti gli agenti del prodotto rispondono e tutto il backend esegue: un modulo che non funziona si dice, non si copre con dati finti. Nessun branch o worktree aperto. L'orchestratore dice a Luca cosa c'è, cosa è rimasto fuori e cosa è simulato, e gli lascia i comandi per provare su `localhost` e l'URL online.

## Come si costruisce

- Il tempo è il vincolo. Prima il percorso della demo intero, anche brutto, poi si rifinisce. Niente che la giuria non vedrà: autenticazione, impostazioni, casi limite, configurabilità.
- **Si simula il meno possibile: se è tutto vero è molto meglio.** Gli agenti del prodotto chiamano davvero i modelli e fanno davvero il loro lavoro, il backend esegue davvero, i dati si leggono e si scrivono davvero in D1, e quello che si vede a schermo arriva dall'API. Niente risposte dei modelli scritte a mano, niente rotte che restituiscono dati fissi, niente attese finte per far sembrare che qualcosa lavori, niente pulsanti che non fanno niente. Davanti a una cosa difficile si riduce il perimetro (meno funzioni, ma vere) invece di fingerla.
- **Una simulazione è un'eccezione che approva Luca.** Si ammette solo per ciò che oggi non si può avere: un sistema esterno dell'ateneo a cui non c'è accesso, un invio vero di mail o messaggi, un login istituzionale. Ogni simulazione sta nell'elenco «cosa è simulato» della proposta visiva, con il motivo, e Luca la approva lì. Se durante il build ne serve una nuova, l'agente la dice a Luca in una riga prima di farla e la aggiunge al piano. Mai presentare come funzionante una cosa finta, nemmeno nel pitch.
- I dati sintetici non sono una simulazione: nessun dato reale di studenti, docenti o atenei, ma dati inventati e verosimili che stanno nel database, caricati da uno script di semina, e che il sistema lavora per davvero. Mai scritti nel frontend.
- **Modelli via OpenRouter.** Luca ha una chiave con 5 $ di credito: è tutto il budget della giornata. Si usano sempre modelli economici della classe Luna: il predefinito è `openai/gpt-6-luna` (0,10 $ per milione di token in ingresso e 0,50 $ in uscita, catalogo OpenRouter letto il 14/11/2026). Un modello più caro solo se Luca lo dice per quel punto preciso. Ogni chiamata ha un tetto di token in uscita, e le prove ripetute in sviluppo usano risposte brevi. Per cambiare modello o aggiungerne uno di altro tipo (embedding, voce) si rilegge il catalogo del giorno su `https://openrouter.ai/api/v1/models`, non ci si basa su quello che si ricorda. La chiave si chiama `OPENROUTER_API_KEY`, sta nel `.env` alla radice, arriva al Worker da `app/backend/.dev.vars` in locale e da `wrangler secret put` online. Non arriva mai al frontend: il browser chiama solo la nostra API.
- **Niente deve rallentare il lavoro, nemmeno le verifiche.** Nessun livello di test: niente test unitari, di integrazione, di rotta o di schema, niente mock, niente copertura. Non si perde tempo a provare il codice con altro codice. Per ogni passo basta la prova più rapida che dica che funziona: l'app parte senza errori e la cosa appena fatta risponde (una chiamata alla rotta, un'occhiata alla pagina).
- **Playwright parte solo quando lo dice Luca, mai in automatico.** Non è una condizione per PR, merge o deploy, e l'agente non lo lancia di sua iniziativa: al più propone in una riga di lanciarlo, e continua. È già installato alla radice con Chromium (`playwright.config.ts`, cartella `e2e/`): `npm run e2e` apre l'applicazione in un browser vero e percorre la demo come farà Luca davanti alla giuria, in locale oppure contro l'URL online con `DEMO_URL=<url> npm run e2e`. Il percorso sta in un solo file, `e2e/demo.spec.ts`, che l'agente scrive quando Luca chiede la prima corsa e poi tiene allineato alla demo. Controlla che ogni passo arrivi a schermo, non il testo che scrivono i modelli, che cambia a ogni corsa. Se fallisce si guarda lo screenshot e si corregge l'app. Le chiamate ai modelli sono vere: una corsa completa deve costare centesimi.
- Piano di riserva se la rete del posto cade: una registrazione dello schermo del percorso completo, fatta appena funziona.
- Nessun segreto nel repository: chiavi solo in `.env` o `.dev.vars`, gitignorati, con i nomi in `.env.example`. Prima di rendere pubblico il repository si ricontrollano `input/` e la storia Git.

## Branch, PR e merge

Luca lavora da solo, ma non si scrive su `main`: ogni pezzo passa da un branch e da una PR. Serve a una cosa sola, poter tornare indietro. `main` contiene sempre l'ultima versione della demo che funziona, e ogni PR è un passo che si può annullare da solo.

Il giro, per ogni pezzo di lavoro:

1. **Branch da `main` aggiornato**: `git pull`, poi `git switch -c <prefisso>/<cosa>`. Prefissi `feat/`, `fix/`, `docs/`, `chore/`. Un branch per un passo compiuto (una fase di build, una schermata, un agente), non per una giornata di lavoro.
2. **Commit piccoli e push frequenti del branch.** Il push è anche il backup: niente lavoro di ore solo sul Mac. Sul branch si può pushare anche un lavoro a metà.
3. **PR verso `main` con `gh pr create`** quando il passo funziona, con una riga su cosa cambia per la demo, come è stato provato e cosa resta simulato. L'agente apre la PR da sé, senza chiedere.
4. **Il merge lo fa l'agente, subito e senza aspettare Luca**: `gh pr merge --squash --delete-branch`. Su `main` ogni PR diventa un solo commit, che è quello che permette di tornare indietro. È una regola di questo repository per oggi: negli altri progetti di Luca il merge lo decide lui. Se l'app non parte non si mergia, e lo si dice.
5. **Deploy solo da `main`**, dopo il merge: `git switch main`, `git pull`, `wrangler deploy`. Online gira sempre un commit di `main`.

Tornare indietro:

- Una PR mergiata che rompe la demo si annulla con `git revert <commit>` su un branch `fix/`, con la sua PR. Poi si rifà il deploy da `main`.
- Se serve subito la versione di prima online, `wrangler rollback` riporta il Worker al deploy precedente mentre si sistema il codice.
- Mai `--force` su `main` e mai riscrivere la storia già pushata.

Il resto:

- Anche i documenti passano da PR, e si mergiano come le altre. Le due approvazioni di Luca (idea e proposta) arrivano in chat, non sulla PR.
- Prima di ogni commit `git status`: niente `.env`, `.dev.vars`, chiavi o file che non c'entrano. Il repository potrebbe diventare pubblico con tutta la sua storia.
- Messaggi e titoli delle PR in italiano, una riga che dice cosa cambia per la demo.
- Nello stesso checkout scrive un solo agente alla volta. In parallelo ognuno ha la sua worktree, il suo branch e la sua PR; l'ordine dei merge lo tiene l'orchestratore.
- La visibilità del repository la cambia solo Luca.

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

Qui il deploy da locale è permesso, a differenza dei progetti dei clienti: non c'è staging né pipeline. Si fa solo da `main`, dopo il merge della PR.

**Account Cloudflare.** `wrangler` su questo Mac è collegato a più account, alcuni di lavoro e di clienti con sistemi in produzione. Questo progetto va solo sull'account personale di Luca: l'`account_id` si fissa in `wrangler.jsonc` alla prima fase di build e Luca lo conferma. Prima di ogni comando remoto che crea, scrive o cancella, controlla account e nome della risorsa. Non si tocca nessuna risorsa senza il prefisso `aoc-` o il nome `ai-on-campus`.

## Interfaccia

La giuria giudica quello che vede. Una schermata per passo della demo, testo leggibile da un proiettore, stati di attesa visibili mentre gli agenti lavorano.

**Minima e fluida.** Durante l'implementazione l'interfaccia resta essenziale: poche cose per schermata, molto spazio, una sola azione principale, niente decorazioni, niente pannelli o opzioni che la demo non usa. Fluida vuol dire che niente scatta: transizioni brevi fra gli stati, contenuti che compaiono senza far saltare il layout, risposte degli agenti che arrivano in streaming, caricamenti che si vedono. Animazioni poche e veloci, mai spettacolo. La rifinitura la fa Luca dopo: gli agenti non lucidano, consegnano una base pulita e coerente su cui è facile lavorare (token del design system, componenti condivisi, nessuno stile scritto a mano dentro le pagine). Vale per ogni agente che tocca il frontend e va ripetuto nel suo compito.

La struttura del frontend non la deve dettare Luca. La propone l'agente nella proposta visiva, con le bozze delle schermate e come si passa dall'una all'altra, e Luca la corregge lì. Il piano la traduce in pagine, rotte e componenti condivisi, e il filo verticale la costruisce.

Il design si decide una volta e poi si rispetta. Nella fase del piano si genera il design system dell'idea scelta con `ui-ux-pro-max` (`--design-system`) e lo si salva in `docs/design-system.md`: stile, palette, font, componenti. Da lì in poi quel file è la regola, e si cambia solo se Luca lo chiede. Le proposte delle skill sono un punto di partenza: sceglie Luca, e quello che su un proiettore si legge male si scarta.

## Skill: quando usarle

Le skill nel repository stanno in `.agents/skills/` e valgono per ogni runtime (in Claude Code arrivano dai symlink in `.claude/skills/`; altrove si legge il loro `SKILL.md` e si lanciano gli script con `python3`). Le altre sono plugin o skill della macchina di Luca: se nel tuo runtime non ci sono, fai lo stesso lavoro a mano e dillo.

| Momento | Skill | Dove sta | Quando si usa e quando no |
|---|---|---|---|
| Fase 00, brainstorming | nessuna | | Si ragiona sulle fonti di `input/`. Niente skill di design o di codice prima che Luca abbia scelto l'idea |
| Proposta visiva | Artifact | Claude Code | Per pubblicare `docs/proposta.html` e dare a Luca un link. Negli altri runtime si apre il file nel browser. Lo stile a mano è della proposta, non del prodotto: il design system si decide dopo, nel piano |
| Fase 01, piano | `ui-ux-pro-max` | repository | Una volta, per generare `docs/design-system.md`. Poi solo per domande puntuali di UX (`--domain ux`) o sui grafici, non per rigenerare lo stile |
| Fase 01, piano | `brand`, `design` | repository | Solo se all'idea servono un nome, un tono e un logo. Le immagini non le generano gli script della skill: le genera Codex, vedi «Immagini» sotto |
| Fase 01, piano | `agents-sdk`, `durable-objects` | plugin Cloudflare | Per disegnare gli agenti e il loro stato prima di scriverli, e di nuovo quando si implementano |
| Fase 01, piano | `generate-diagrams` | macchina di Luca | Lo schema dell'architettura, che serve nel piano e poi nelle slide |
| Build, scheletro e deploy | `wrangler`, `workers-best-practices` | plugin Cloudflare | Configurazione di `wrangler.jsonc`, D1, binding, deploy. Sempre prima di un comando remoto |
| Build, frontend | `design-system`, `ui-styling` | repository | Alla prima schermata, per portare i token di `docs/design-system.md` in Tailwind e scegliere i componenti shadcn/ui. Sulle schermate successive si riusa quello che c'è |
| Quando lo chiede Luca | Playwright (`npm run e2e`) | repository | Solo su richiesta di Luca, mai in automatico. Non è una skill: è il percorso della demo in `e2e/` |
| Build | `run` | Claude Code | Quando serve guardare l'app con gli occhi, per uno screenshot o un difetto che il test non descrive |
| Rifinitura | `interfaces` | plugin, lo installa Luca | Solo su schermate che funzionano già: `interface-review` prima di considerarne finita una, `better-ui` e `variant` per migliorarla. Non decide il design system, lo rispetta. Mai mentre il percorso della demo è ancora rotto |
| Pitch | `slides`, `banner-design` | repository | Slide in HTML con lo stesso design system della demo; `banner-design` per la copertina. Solo quando tutto funziona: il pitch non si comincia prima |
| Pitch, video | skill Remotion | `ad-studio` | Solo se Luca decide di fare il video, in una sessione aperta su quel repository |
| Sempre | `karpathy-guidelines` | plugin | Codice minimo e modifiche chirurgiche: è lo spirito di tutto «Come si costruisce» |

### Immagini

Logo, illustrazioni, mockup e copertine li genera **Codex**, che ha la generazione di immagini integrata. Gli script di `design` e `banner-design` che chiamano servizi esterni vogliono chiavi che qui non ci sono (`.agents/skills/ORIGINE.md`) e non si lanciano. Delle skill si usa la parte che conta: il prompt.

1. Il prompt si costruisce con la skill, a partire da `docs/design-system.md`: stili e regole in `design/SKILL.md` e `banner-design/SKILL.md`, ricerca degli stili con `design/scripts/logo/search.py`, prompt già pronto con `design/scripts/cip/generate.py --prompt-only`.
2. Se sei Codex, generi tu. Se sei un altro runtime, lanci un agente Codex e gli passi quel prompt, con formato, dimensioni e cartella di destinazione. In herdr si lancia come agente visibile, secondo le regole globali di Luca.
3. L'agente scrive solo file immagine, solo in `app/frontend/public/` (demo) o in `pitch/assets/` (slide): nello stesso checkout nessun altro file.
4. Le immagini sono proposte: due o tre varianti, sceglie Luca, le scartate si cancellano. Niente loghi o marchi di atenei veri.

Si generano solo le immagini che la demo o il pitch mostrano davvero, e mai prima che il percorso della demo funzioni.

Una skill non scavalca questo file: se suggerisce test, astrazioni o passaggi che qui sono esclusi, vale `AGENTS.md`.

## Video

Resta aperta l'opzione di aprire il pitch con un video breve dell'idea, fatto con `ad-studio` (`~/Developer/martes-ai/projects/ad-studio`, Remotion). Si fa solo quando tutto funziona, e non toglie tempo a Luca: lo porta avanti un agente in background mentre Luca prepara il pitch. Il video si costruisce in una sessione aperta su quel repository, seguendo il suo `AGENTS.md`; qui arrivano lo storyboard e l'MP4 finale, in `pitch/`.

## Struttura

| Percorso | Cosa contiene |
|---|---|
| `input/` | Fonti dell'hackathon incollate da Luca. Non si modificano |
| `docs/fase-00-brainstorming.md` | Le idee confrontate, quella scelta e perché |
| `docs/proposta.html` | La proposta visiva che Luca approva prima del piano |
| `docs/fase-01-piano.md` | Percorso della demo, architettura, fasi di build |
| `docs/design-system.md` | Stile, palette, font e componenti dell'interfaccia |
| `docs/fase-NN-….md` | Una per fase di build |
| `app/frontend/` | Next.js, export statico |
| `app/backend/` | Worker Hono, migrazioni D1, agenti, script di semina |
| `e2e/`, `playwright.config.ts` | Il percorso della demo in Playwright |
| `.agents/skills/` | Skill condivise fra runtime |
| `pitch/` | Slide, scaletta, eventuale video |

Le skill condivise fra runtime stanno in `.agents/skills/`, copiate senza la loro `.git` e con l'origine annotata in `ORIGINE.md`; `.claude/skills/` contiene solo symlink.

## Scrittura

Prosa e commenti in italiano, identificatori in inglese. Testi dell'interfaccia, slide e `README.md` finale nella lingua della giuria, che si legge da `input/`. Niente trattini lunghi dentro le frasi. Frasi concrete: nomi, numeri, conseguenze.
