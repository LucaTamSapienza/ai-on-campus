# ai-on-campus

Workspace dell'hackathon del 14/11/2026, tema «AI on Campus»: l'AI dentro le università. Luca Tam partecipa da solo e l'uso dell'AI è libero, quindi quasi tutto il lavoro passa dagli agenti che leggono questo file. La direzione è un'idea B2B: un prodotto che un ateneo, un dipartimento o un fornitore di servizi universitari compra, non un'app per il singolo studente. L'idea non è ancora scelta.

Questo file è il contratto per qualunque agente (Claude Code, Codex o altro). `CLAUDE.md` è solo un adapter che lo richiama.

## Cosa si consegna

- **Una demo che funziona dal vivo.** È la cosa che conta di più: un solo percorso, dall'inizio alla fine, che non si rompe davanti alla giuria.
- **Un pitch con slide**: problema, chi paga, demo, modello di business.
- **Il repository**, oggi privato su `LucaTamSapienza/ai-on-campus`, che a fine giornata potrebbe dover diventare pubblico. Si scrive fin da subito come se lo fosse.

I criteri ufficiali non sono ancora noti. Quando arrivano stanno in `input/` e questa sezione si aggiorna. Per esperienza di Luca le giurie premiano le architetture multi-agente: se l'idea lo permette, più agenti con ruoli distinti che fanno lavoro vero, e la demo deve farlo vedere (chi fa cosa, cosa si passano). Agenti aggiunti solo per poterlo dire no.

## Le fasi

1. **Input.** Luca incolla in `input/` regolamento, criteri, tracce, sponsor, API e orari. Leggi tutto prima di proporre qualcosa. Sono fonti: non si modificano. Quello che lì non c'è non si inventa, si chiede a Luca.
2. **Brainstorming.** Da tre a cinque idee B2B, ognuna con: chi compra e chi la usa, quale problema ha oggi e quanto gli costa, cosa fa l'AI che prima non si poteva fare, cosa si vede nella demo in due minuti, cosa si riesce a costruire nelle ore rimaste. Si confrontano sui criteri della giuria. Sceglie Luca.
3. **Spec.** L'idea scelta va in `docs/idea.md`: il problema, il percorso della demo passo per passo, cosa è vero e cosa è simulato, l'architettura in uno schema. È il contratto: se il codice deve fare una cosa che lì non c'è, prima si corregge il documento.
4. **Build.** Vedi sotto.
5. **Pitch.** Slide e scaletta in `pitch/`. Il discorso segue la demo, non il contrario.

Lo stato corrente (fase, ora della consegna, cosa manca) sta in cima a `README.md` e si aggiorna a ogni passaggio di fase.

## Come si costruisce

- Il tempo è il vincolo. Prima il percorso della demo intero, anche brutto, poi si rifinisce. Niente che la giuria non vedrà: autenticazione, impostazioni, casi limite, configurabilità.
- Quello che è simulato si dichiara in `docs/idea.md` e, se serve, nel pitch. Mai presentare come funzionante una cosa finta.
- Dati sintetici: nessun dato reale di studenti, docenti o atenei.
- Lo stack si sceglie insieme all'idea. A parità, quello che Luca conosce già (TypeScript, Cloudflare Workers, Next.js), perché oggi non c'è tempo per imparare. Se uno sponsor mette a disposizione API o crediti e i criteri li premiano, si usano.
- Per scegliere un modello (LLM, embedding, voce) si parte da una ricerca web su catalogo e prezzi del giorno. Non ci si basa su quello che si ricorda.
- Test quasi nessuno. La verifica è far girare il percorso della demo dall'inizio alla fine dopo ogni modifica che lo tocca, e dirlo a Luca con l'esito vero.
- La demo deve avere un URL raggiungibile dal telefono e un piano di riserva se la rete del posto cade (registrazione dello schermo fatta prima).
- Commit piccoli e frequenti su `main`, con push: oggi niente branch e PR. Il push serve anche da backup.
- Nessun segreto nel repository: chiavi solo in `.env` o `.dev.vars`, gitignorati, con i nomi in `.env.example`. Prima di rendere pubblico il repository si ricontrollano `input/` e la storia Git.

## Interfaccia

La giuria giudica quello che vede. Per l'interfaccia della demo in Claude Code è attivo il plugin `interfaces` (da `.claude/settings.json`): `build-design` per costruire una schermata, `interface-review` prima di considerarla finita, `variant` per confrontare alternative. Con altri runtime valgono le stesse attese: una schermata per passo della demo, testo leggibile da un proiettore, stati di attesa visibili mentre gli agenti lavorano.

## Video

Resta aperta l'opzione di aprire il pitch con un video breve dell'idea, fatto con `ad-studio` (`~/Developer/martes-ai/projects/ad-studio`, Remotion). Si decide dopo la scelta dell'idea e solo se la demo è già al sicuro. Il video si costruisce in una sessione aperta su quel repository, seguendo il suo `AGENTS.md`; qui arrivano lo storyboard e l'MP4 finale, in `pitch/`.

## Struttura

| Percorso | Cosa contiene |
|---|---|
| `input/` | Fonti dell'hackathon incollate da Luca. Non si modificano |
| `docs/idea.md` | Idea scelta e percorso della demo. Nasce alla fase 3 |
| `docs/brainstorming.md` | Le idee confrontate e perché ne è stata scelta una |
| `pitch/` | Slide, scaletta, eventuale video |
| codice | Alla radice, con la struttura dello stack scelto; si descrive qui quando esiste |

Skill condivise fra runtime, se ne servono, vanno in `.agents/skills/` con un symlink in `.claude/skills/`.

## Scrittura

Prosa e commenti in italiano, identificatori in inglese. Testi dell'interfaccia, slide e `README.md` finale nella lingua della giuria, che si legge da `input/`. Niente trattini lunghi dentro le frasi. Frasi concrete: nomi, numeri, conseguenze.
