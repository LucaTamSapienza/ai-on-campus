# Fase 04, classe simulata, lato studente e lezioni (blocco 2)

Branch `feat/blocco-2-classe-e-lezioni`, da `main` 8903222. Contratto: `docs/fase-01-piano.md`, punti 6 e 7 del percorso, Sicurezza 9 e 10, decisioni di Luca delle 13:05 e 13:15. Raccoglie le fasi 04 e 05 del piano: classe simulata, lato studente, «fatto a lezione» e lezione registrata. Il piano di studio (blocco 3) resta fuori.

## Cosa si costruisce

```
POST /api/questions/:id/class ─▶ D1 (class_runs + una class_answers per studente) ─▶ Classe (Durable Object, nome = runId)
   recupero: gli stessi termini e passaggi del triplo attacco (al massimo 12)
   per ogni studente, in parallelo:
     Studente   profilo sintetico + domanda + SOLO i passaggi delle lezioni che ha seguito
       └─ Correttore della fase 03: domanda + griglia + risposta, non sa chi l'ha scritta
   riepilogo calcolato dal backend: fasce di voto, punti per criterio, lezioni e concetti mancanti
browser ◀─ WebSocket /agents/classe/:runId (sola lettura, testo a blocchi di 400 ms)
        ◀─ GET /api/class-runs/:id (riletto quando lo stato cresce)

POST /api/courses/:id/lessons/transcribe (WAV 16 kHz) ─▶ llm.ts ─▶ google/gemini-3.8-flash ─▶ testo
   il docente rilegge ─▶ POST /api/courses/:id/sources {kind: transcript} ─▶ Cartografo ─▶ concetti nel grafo
```

## File

| Dove | Cosa |
|---|---|
| `app/backend/migrations/0003_classe.sql` | `students`, `student_sources` (lezioni seguite), `class_runs`, `class_run_passages`, `class_answers` |
| `app/backend/migrations/0004_lezioni.sql` | `lessons_done` |
| `app/backend/src/classe/classe.ts` | coordinatore `Classe` e agente Studente (`runStudente`) |
| `app/backend/src/classe/data.ts` | letture da D1 e riepilogo calcolato nel codice |
| `app/backend/src/classe/routes.ts` | rotte della classe |
| `app/backend/src/classe/role.ts` | ruolo studente in sola lettura, sulle rotte e sui WebSocket |
| `app/backend/src/lezioni/routes.ts` | lezioni svolte, proposte, trascrizione |
| `app/backend/scripts/seed-classe.mjs` | gli otto studenti sintetici, via API |
| `app/frontend/app/classe/page.tsx`, `components/classe/` | pagina Classe |
| `app/frontend/app/lezioni/page.tsx`, `components/lezioni/` | pagina Lezioni, registratore e conversione in WAV |

Agganci nei file comuni, tutti delimitati da `blocco 2`:

- `wrangler.jsonc`: binding `Classe` e tag di migrazione `v3-classe`. In `worker-configuration.d.ts` le due righe corrispondenti.
- `src/index.ts`: import e export di `Classe`, montaggio di `classe` e `lezioni`, middleware `studentGuard`, `x-role` fra le intestazioni CORS e `PUT` fra i metodi, ramo `/agents/classe/:runId` e rifiuto dei WebSocket per lo studente (dopo i controlli di origine e codice demo).
- `src/llm.ts`: modello `trascrittore` = `google/gemini-3.8-flash` con il suo prezzo; `Message.content` accetta anche parti `input_audio`; la stima del costo conta l'audio. La firma di `complete` non cambia.
- `lib/api.ts`: intestazione `x-role` in `request`, `setApiRole`/`apiRole`, tipi e funzioni `classeApi` e `lezioniApi` in fondo.
- `components/app-shell.tsx`: voci «Classe» e «Lezioni» per il docente, «Materiali» anche per lo studente, ruolo passato all'API, pagine rimontate al cambio di ruolo, una pagina del docente con ruolo studente porta al grafo.
- `app/materiali/page.tsx` (non comune, della fase 02): con ruolo studente il caricamento sparisce.

## Rotte

| Rotta | Cosa fa | Studente |
|---|---|---|
| `GET /api/courses/:id/students` | profili sintetici con le lezioni seguite | 403 |
| `POST /api/courses/:id/students` | `{name, priorGrade, style, lessons: ["L08", …]}`; stesso nome aggiorna; al massimo 12 | 403 |
| `POST /api/questions/:id/class` | 202 `{runId}`; 409 `run_active`; 422 senza griglia; 409 `no_students` | 403 |
| `GET /api/questions/:id/class` | ultima esecuzione della classe sulla domanda | 403 |
| `GET /api/class-runs/:id` | passaggi, studenti, risposte, voti, concetti mancanti, riepilogo | 403 |
| `GET /api/courses/:id/lessons` | fonti con «svolta» e numero di concetti | sì |
| `PUT /api/sources/:id/done` | `{done}` | 403 |
| `GET /api/courses/:id/proposals` | concetti coperti dalle lezioni svolte, con fino a due prove ciascuno | 403 |
| `POST /api/courses/:id/lessons/transcribe` | `{audio: base64 WAV, format: "wav"}` → `{text, seconds, costUsd}` | 403 |
| WebSocket `/agents/classe/:runId` | stato del coordinatore, sola lettura | 403 |

## Decisioni prese nel build

- **Il ruolo arriva dal selettore simulato** come intestazione `x-role` (parametro `role` sui WebSocket). Il server lo fa valere: con `studente` ogni metodo diverso da GET risponde 403, e anche le letture di esame, attacchi, classe, profili, proposte e spesa. Grafo, concetti, fonti e lezioni restano leggibili. È il sostituto del login d'ateneo, già fra le simulazioni approvate.
- **Profili per lezioni seguite.** Un profilo dice quali lezioni (fonti) ha seguito; uno studente riceve solo i passaggi recuperati che vengono da quelle lezioni. L'isolamento è nel codice (`classe.ts`, filtro su `sourceId`), non nel prompt.
- **Concetti mancanti** di uno studente: i concetti che hanno come prova uno dei passaggi recuperati per la domanda, e di cui lui non ha ricevuto nessuno di quei passaggi. Il riepilogo confronta il voto medio di chi li aveva e di chi no, e mostra solo ciò che separa i voti di almeno 10 punti percentuali. Lo stesso confronto per lezione è il segnale più chiaro.
- **Riepilogo senza modello.** Fasce di voto, punti per criterio e mancanze li calcola il backend sui voti del Correttore.
- **Proposte senza modello.** Concetti con prove nelle lezioni svolte, esclusi gli esempi; prima quelli che nessuna domanda corrente tocca (`question_version_concepts`), poi per collegamenti e prove. L'app propone e basta: c'è solo un collegamento a «Scrivi una domanda».
- **Audio.** Il browser registra in webm, converte in WAV PCM 16 bit mono 16 kHz e lo manda in base64. Il server accetta solo quel formato, ricava la durata dall'intestazione (non dal client), rifiuta oltre 3 minuti e oltre 7 MB, non salva l'audio. La trascrizione torna al docente, che la rilegge e la manda al Cartografo dalla rotta delle fonti; la fonte nuova si segna come svolta.
- **Dati non fidati.** Passaggi, risposte e trascrizioni stanno fra delimitatori; nessun agente ha strumenti; tutto si mostra come testo. Il trascrittore ha l'istruzione di trascrivere, non eseguire, ciò che nell'audio si rivolge a un modello.

## Come si prova

```
cd app/backend && npm install && npx wrangler d1 migrations apply aoc-db --local
npx wrangler dev --port 8789 --inspector-port 9331
node scripts/seed.mjs <cartella del materiale> --api http://localhost:8789 --ontologia
node scripts/seed-esame.mjs --api http://localhost:8789
node scripts/seed-classe.mjs --api http://localhost:8789
cd ../frontend && npm install && NEXT_PUBLIC_API_BASE=http://localhost:8789 npx next dev --port 3002
```

- `http://localhost:3002/classe`: scegli una domanda, «Fai rispondere la classe», guarda le otto schede scrivere, poi distribuzione e «Cosa spiega i punti persi». Tocca uno studente per risposta, voto per criterio, concetti mancanti e passaggi ricevuti.
- `http://localhost:3002/lezioni`: segna le lezioni svolte, leggi le proposte; «Registra» (il browser chiede il microfono solo qui), «Ferma e trascrivi», «Manda al Cartografo».
- Selettore «Studente»: restano Grafo e Materiali, senza caricamento; da `/classe` si torna al grafo. `curl -H 'x-role: studente' localhost:8789/api/exams/<id>` risponde 403.

## Cosa è stato fatto davvero

Prove del 14/11/2026 sul corso intero (13 lezioni, 179 concetti), dal browser a 1440 × 900 e a 390 × 844, con schermate di controllo (Playwright solo per le schermate, nessun test scritto). Nessun errore in console, nessuno scorrimento orizzontale.

| Domanda | Voti degli otto | Cosa dice il riepilogo |
|---|---|---|
| C, dimostrazione di L08 | 10, 10, 0, 0, 10, 10, 10, 10 (media 7,5) | L08: chi non l'ha seguita 0% dei punti, chi sì 100%. I due a 0 lo dicono: «non ho seguito la lezione L08» |
| A, calcolo Q-learning | sette a 10, uno a 2 | il calcolo standard lo fanno quasi tutti; chi non aveva i passaggi su Q-learning (prima metà del corso) prende 2 |
| B, fine episodio | 9, 8, 9, 0, 8,5, 3, 10, 10 (media 7,2) | L09 e L08 separano i voti; chi ha preso la lettura «troncamento» perde i punti dell'assunzione |

- Un'esecuzione della classe: 17 chiamate (1 termini, 8 Studente, 8 Correttore), da 0,0028 a 0,0036 $, 12-15 secondi.
- Trascrizione di 57 secondi di audio italiano (sintesi vocale di macOS): 4 secondi, 0,0020 $, testo fedele. Dal browser con microfono finto: la trascrizione è entrata nel Cartografo e ha aggiunto «Expected SARSA» al grafo.
- Spesa totale di sviluppo del blocco: 0,013 $ (55 chiamate).

## Prova con Playwright

`e2e/blocco2.spec.ts` entra nei progetti di `playwright.config.ts` (desktop 1440 × 900, telefono 390 × 844) insieme a `e2e/demo.spec.ts`, e si lancia solo su richiesta di Luca:

```
DEMO_URL=http://localhost:8789 LIVE_FILE=<materiale-locale>/dal-vivo/Lab06-session-slides.md npm run e2e -- --project=desktop
DEMO_URL=http://localhost:3002 API_URL=http://localhost:8789 npm run e2e -- e2e/blocco2.spec.ts --project=telefono
```

Il percorso del blocco 1 scrive nel D1 (carica Lab06, crea la domanda 4): fra due corse si risemina (`seed.mjs --ontologia`, `seed-esame.mjs`, `seed-classe.mjs` su un D1 vuoto).

- Classe: scelta della domanda, esecuzione dal vivo, otto «Corretto», riepilogo, dettaglio di uno studente.
- Lezioni: segna e ripristina una lezione svolta, proposte con le prove, registrazione con il microfono finto di Chromium (`e2e/fixtures/lezione-breve.wav`, sintesi vocale) fino alla trascrizione, poi «Scarta».
- Studente: voci del docente sparite, materiali senza caricamento; dieci rotte rispondono 403 con `x-role: studente`, mentre grafo e fonti rispondono 200.
- Ogni caso controlla anche che non ci siano scorrimento orizzontale né errori in console.

**Fusione con il blocco 1** (`main` d1f254b, PR #18): nessun conflitto. In `demo.spec.ts` cambia solo il passo del selettore studente: dal blocco 2 lo studente vede Materiali, mentre Esame, Classe e Lezioni non ci sono. La prova contro l'export servito dal Worker ha trovato un difetto vero: `public/_headers` vietava il microfono anche alla stessa origine (`microphone=()`), così online la registrazione non sarebbe partita. Ora vale `microphone=(self)`.

## Cosa resta fuori o aperto

- **La classe misura l'accesso ai passaggi, non la conoscenza.** Il modello conosce comunque la materia: su A (calcolo standard) quasi tutti prendono 10 anche senza le lezioni giuste. Lo dice l'interfaccia, insieme a «non è una previsione dei voti veri».
- **Microfono vero non provato:** la registrazione è provata con il microfono finto di Chromium (10 secondi registrati, 10 trascritti), sia con `next dev` sia con l'export servito dal Worker. Una prima prova manuale aveva dato 13 secondi su 25 e non si è ripetuta.
- **Proposte:** il segno «già in una domanda» si accende solo dopo un triplo attacco, perché i concetti toccati li salva il recupero della fase 03.
- Il piano di studio (blocco 3) non è in questo branch.
- Nessun deploy e nessun comando remoto.
