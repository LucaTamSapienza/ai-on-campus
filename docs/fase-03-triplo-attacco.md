# Fase 03, il triplo attacco

Branch `feat/triplo-attacco`. Contratto: `docs/fase-01-piano.md`, sezione «Fase 03», con le correzioni dell'analisi contrastante (elencate sotto, dove cambiano il piano).

## Cosa si costruisce

Il docente scrive una domanda con la griglia. Tre agenti la attaccano in parallelo, un Correttore dà i voti senza sapere chi ha scritto, un Revisore compone la scheda e propone una riscrittura. Il docente approva, modifica o tiene; la nuova versione si riattacca e le versioni si confrontano.

```
POST /api/questions/:id/attack ─▶ D1 (attack_runs + 3 attacks) ─▶ Attacco (Durable Object, nome = runId)
                                                                   │ coda durevole dell'agente
   recupero: Luna estrae 3-8 termini in inglese ─▶ FTS5 + concetti del grafo + vicini ─▶ 12 passaggi
   ├─ Esterno      solo la domanda
   ├─ Letterale    domanda + passaggi, citazioni {passageId, quote} verificate nel codice
   └─ Cavillatore  domanda + passaggi, due letture esatte o nessuna
        └─ Correttore per ogni risposta: domanda + griglia + risposta fra delimitatori
   Revisore: domanda, griglia, esiti, voti, passaggi verificati ─▶ solo nuovo testo e motivazione
   verdetti: calcolati dal backend sui voti
browser ◀─ WebSocket /agents/attacco/:runId (stato in sola lettura, testo a blocchi di 400 ms)
        ◀─ GET /api/runs/:id (riletto quando lo stato cresce; ogni 2 s senza WebSocket, ogni 5 s con)
POST /api/questions/:id/decision ─▶ un batch D1: nuova versione + decisione + puntatore
```

## File

| Dove | Cosa |
|---|---|
| `app/backend/migrations/0002_esame.sql` | esami, domande, versioni, esecuzioni, passaggi recuperati, attacchi, voti, schede, decisioni, concetti toccati; FTS5 sui passaggi con backfill e trigger |
| `app/backend/src/esame/agents.ts` | i cinque agenti e l'estrazione dei termini: ogni funzione riceve solo ciò che spetta al suo agente |
| `app/backend/src/esame/retrieval.ts` | recupero senza embedding, con il perché di ogni passaggio |
| `app/backend/src/esame/attacco.ts` | coordinatore per esecuzione: passi idempotenti, termine dell'esecuzione, stato dal vivo |
| `app/backend/src/esame/data.ts` | letture da D1 e verdetti |
| `app/backend/src/esame/routes.ts` | rotte dell'esame |
| `app/backend/scripts/seed-esame.mjs` | le tre domande della demo, via API |
| `app/frontend/app/esame/page.tsx`, `components/esame/` | elenco, nuova domanda, domanda con attacco, scheda, prima e dopo |

Agganci nei file comuni, delimitati da `fase 03`: binding `Attacco` e tag `v2-attacco` in `wrangler.jsonc` (più le due righe in `worker-configuration.d.ts`), import e montaggio delle rotte e ramo `/agents/attacco/:runId` nell'ingresso del Worker (dopo il controllo d'origine e del codice demo), funzioni `esameApi` in fondo a `lib/api.ts`, voce «Esame» nella navigazione. In `llm.ts` un'opzione facoltativa `onText` per lo streaming SSE, senza cambiare la firma: timeout, prenotazione del costo e nuovo tentativo restano quelli di `llm.ts`; uno stream interrotto vale come errore transitorio.

## Rotte

| Rotta | Cosa fa |
|---|---|
| `GET/POST /api/courses/:id/exams` | elenco e creazione `{title}` |
| `GET /api/exams/:id` | domande con versione corrente e verdetti dell'ultima esecuzione |
| `POST /api/exams/:id/questions` | `{text, rubric: [{criterion, points, expected?}]}`; senza griglia 422 «Serve la griglia di correzione.» |
| `GET /api/questions/:id` | domanda, versione corrente, ultima esecuzione, ultima decisione |
| `POST /api/questions/:id/attack` | 202 `{runId}`; 409 `run_active` se ce n'è già una |
| `GET /api/runs/:id` | recupero (termini, concetti, passaggi con il perché), attacchi, voti, scheda |
| `POST /api/questions/:id/decision` | `{reviewId, expectedVersionId, action, text?}`; 409 `version_changed` se la versione non è quella attesa; risponde `{versionId}` |
| `GET /api/questions/:id/versions` | versioni con l'esito dell'ultima esecuzione chiusa |
| WebSocket `/agents/attacco/:runId` | stato del coordinatore, sola lettura |

Con il segreto `DEMO_CODE` tutte, letture comprese, chiedono `x-demo-code` (il WebSocket `?code=`): provato con un'istanza a parte, 401 senza codice e 200/101 con il codice.

## Decisioni prese nel build

- **Un solo Durable Object coordina, gli agenti sono funzioni con contesti separati.** Le correzioni lo permettono e così lo stato dell'esecuzione sta in un posto solo. L'isolamento è nel codice: `runEsterno` riceve solo `{question}`, `runCorrettore` non riceve il nome dell'agente.
- **Recupero.** I termini del modello più i token tecnici della domanda (Q-learning, GLIE, L08); MATCH con frasi fra virgolette e le singole parole dei termini, unite con OR, ranking BM25; concetti nominati e vicini di primo grado; slide senza testo (`thin = 1`) escluse. Se la domanda nomina una lezione («L08»), il recupero resta dentro quella lezione. Al massimo 12 passaggi e 14.000 caratteri.
- **Verdetti** con le parole delle correzioni. «Ambiguità candidata» compare se il Cavillatore ha due letture, qualunque siano i voti. «Nessun controesempio trovato» solo con i tre attacchi completi e valutati.
- **Stato dal vivo.** «Finito» lo dice solo D1: il dal vivo indica chi lavora e il testo che arriva. Prima un agente finito a schermo prima di D1 faceva cadere la pagina.
- **Nessun nome dell'app** nei testi dell'esame.

## Come si prova

```
cd app/backend && npm install && rm -rf .wrangler/state && npx wrangler d1 migrations apply aoc-db --local
npx wrangler dev --port 8788
node scripts/seed.mjs <cartella del materiale> --api http://localhost:8788 --ontologia
node scripts/seed-esame.mjs --api http://localhost:8788
cd ../frontend && npm install && NEXT_PUBLIC_API_BASE=http://localhost:8788 npx next dev --port 3001
```

Poi `http://localhost:3001/esame`: apri la domanda, «Attacca la domanda», guarda i tre agenti, la scheda, «Approva e riattacca», «Prima e dopo». Export statico: `npx next build` nel frontend, poi `http://localhost:8788/esame` dal Worker.

## Cosa è stato fatto davvero

Prove del 14/11/2026 sul corso intero (13 lezioni, 867 passaggi, ontologia di 177 concetti), modello `openai/gpt-6-luna` per tutti gli agenti.

| Domanda | Versione | Esterno | Letterale | Cavillatore | Verdetti |
|---|---|---|---|---|---|
| A, calcolo Q-learning | 1, docente | 10/10 | 5/10 | due letture (segno dell'errore TD): 10 e 9,5 | supera la soglia; ambiguità candidata |
| A | 2, proposta approvata | 10/10 | 10/10, 4 citazioni | nessuna lettura | supera la soglia |
| B, fine episodio | 1, docente | 10/10 | 10/10 | due letture (terminale o troncamento): 8,5 e 10 | supera la soglia; ambiguità candidata |
| B | 2, proposta modificata | 10/10 | 10/10 | nessuna lettura | supera la soglia |
| B | 2, riattaccata dopo «Tieni com'è» | 10/10 | 10/10 | due letture (timeout): 10 e 0 | supera la soglia; ambiguità candidata |
| C, dimostrazione di L08 | 1, docente, prima del recupero per lezione | 4/10 | 7,5/10, slide 62 non recuperata | nessuna lettura | nessun controesempio |
| C | 1, con il recupero dentro L08 | 5,5/10 | 10/10, cita «Prove it at home» | nessuna lettura | nessun controesempio, nessuna riscrittura |

- **A** fa quello che deve: un modello generico la risolve senza il corso. Le riscritture del Revisore tolgono l'ambiguità ma non l'abbassano sotto soglia: è un calcolo standard, e il verdetto lo dice.
- **B**: il Cavillatore trova l'ambiguità attesa (stato terminale o interruzione). Sulla versione corretta a volte la trova, a volte segnala una lettura debole (il testo dice già che s′ non è terminale; il Correttore dà 0 a quella lettura). Per questo la scheda la chiama «candidata» e la lascia al docente.
- **C**: senza i materiali l'Esterno resta sotto soglia (4 e 5,5); con i passaggi il Letterale trova la consegna e prende 10.

Costo misurato da `model_calls`: 7-9 chiamate per esecuzione, in media 0,0020 $ (massimo 0,0023 $). Tempi da 13 a 34 secondi.

## Cosa resta fuori o aperto

- Nessuna simulazione nuova. Il ruolo resta il selettore simulato del guscio.
- Lo stato dal vivo dei singoli agenti su telefono si vede aprendo l'agente; le tre righe di riepilogo dicono sempre chi lavora.
- Il Revisore, a volte, propone una riscrittura anche quando non è emerso nessun problema (una volta su C prima del recupero per lezione).
- `AgentStrip` della fase 02 è legato allo stato del Cartografo: l'avanzamento dell'attacco usa una sua striscia (`RunProgress`) con gli stessi token.
