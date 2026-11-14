# Fase 05, piano di studio (blocco 3)

Branch `feat/blocco-3-piano-di-studio`, nato dal branch del blocco 2 e poi fuso con `main` dopo il merge dei blocchi 1 e 2 (PR #18 e #17). PR #19 verso `main`. Contratto: `docs/fase-01-piano.md`, tabella degli agenti (Pianificatore, «il percorso ordinato dal backend, spiega i collegamenti») e Sicurezza; le correzioni dell'analisi contrastante valgono anche qui.

## Cosa si costruisce

Lo studente apre `/studio` (voce «Studio», solo per lo studente), indica quanti giorni mancano all'appello e cosa conosce già (lezioni intere o singoli concetti). Il backend calcola nel codice, dal grafo, un ordine di studio che rispetta i collegamenti e lo divide in sessioni. Poi il Pianificatore scrive per ogni sessione perché quell'ordine e cosa guardare, citando solo le slide di prova già nel grafo.

```
POST /api/courses/:id/study-plans {days, knownLessons, knownConcepts}   (solo numeri e identificatori)
   plan.ts, senza modello:
     perimetro   concetti con prove nelle lezioni svolte (lessons_done del blocco 2); se nessuna è segnata, tutto il corso
     già noti    concetti segnati + concetti che compaiono per la prima volta in una lezione segnata
     ordine      A prima di B se A prerequisito di B, A parte_di B, B usa A; fra i pronti quello che il corso introduce prima;
                 un ciclo si spezza sul concetto introdotto prima, e si conta
     sessioni    min(giorni, 12) blocchi consecutivi di pari misura, distribuiti sui giorni
   ─▶ D1 (study_plans + study_sessions) ─▶ Pianificatore (Durable Object, nome = planId), tre sessioni alla volta
        per sessione: concetti in ordine con «viene dopo», una prova per concetto poi una seconda finché c'è posto (max 24)
        ─▶ llm.ts (openai/gpt-6-luna, 900 token, JSON con schema) ─▶ {why, look: [{passage: "P3", note}]}
        validazione: citazioni solo fra le etichette ricevute, lunghezze, taglio su frase intera
browser ◀─ WebSocket /agents/pianificatore/:planId (sola lettura, "why" che arriva a blocchi di 400 ms)
        ◀─ GET /api/study-plans/:id (riletto quando lo stato cresce)
```

## Il confine, nel codice

- **Il Pianificatore non legge esame né classe.** Ogni query del modulo passa da `studioQuery` (`src/studio/plan.ts`), che rifiuta qualunque tabella fuori da un elenco: corsi, fonti, passaggi, argomenti, concetti, prove, relazioni, lezioni svolte e le due tabelle del piano. Provato: `question_versions` e `class_answers` vengono rifiutate con «la tabella … è fuori dal suo confine».
- **Nessun testo libero dello studente arriva al modello.** La richiesta contiene solo giorni (1-60) e identificatori, filtrati su quelli del corso.
- **Non scrive risposte d'esame.** Lo dice il prompt; e il Pianificatore non riceve nessuna domanda da risolvere: solo nomi, definizioni e slide.
- **Cita solo slide già nel grafo**, e con il perimetro «svolte» solo slide delle lezioni svolte. Un'etichetta che non corrisponde a un passaggio ricevuto si scarta.
- **Concetti senza prove** li segna il codice (bordo tratteggiato, «senza prove», riga sotto la sessione), non il modello, che ha l'istruzione di non descriverli. Nel corso della demo oggi non ce n'è nessuno: tutti i 184 concetti hanno almeno una slide con testo.
- **Dati non fidati.** Passaggi fra `<passaggi>`, nessuno strumento, uscita con schema JSON, SQL con parametri legati, tutto mostrato come testo.
- **Ruolo studente.** Resta in sola lettura lato server, con due sole eccezioni: `POST /api/courses/:id/study-plans` e il WebSocket del Pianificatore. Esame, griglie, attacchi e classe rispondono ancora 403.
- **Spesa.** Al massimo 12 sessioni (12 chiamate) per piano, al massimo 3 piani in preparazione per corso (429 oltre), più il tetto giornaliero di `llm.ts`.

## File

| Dove | Cosa |
|---|---|
| `app/backend/migrations/0005_studio.sql` | `study_plans`, `study_sessions` |
| `app/backend/src/studio/plan.ts` | confine delle tabelle, lettura del grafo, ordine e sessioni |
| `app/backend/src/studio/pianificatore.ts` | Durable Object `Pianificatore`, contesto di sessione, chiamata e validazione |
| `app/backend/src/studio/routes.ts` | rotte del piano |
| `app/frontend/app/studio/page.tsx`, `components/studio/` | pagina Studio: scelte, piano dal vivo |
| `e2e/blocco3.spec.ts` | percorso Playwright alle due misure |

Agganci nei file comuni, tutti delimitati da `blocco 3`:

- `wrangler.jsonc`: binding `Pianificatore` e tag di migrazione `v4-pianificatore`. In `worker-configuration.d.ts` le due righe corrispondenti.
- `src/index.ts`: import ed export di `Pianificatore`, montaggio di `studio`, ramo `/agents/pianificatore/:planId` che controlla che il piano esista.
- `src/classe/role.ts` (il guard dello studente): `STUDENT_WRITES` con la sola rotta del piano, una riga in `studentForbidden`, `pianificatore` accanto a `cartografo` in `studentAgentForbidden`.
- `lib/api.ts`: tipi e `studioApi` in fondo.
- `components/app-shell.tsx`: voce «Studio» solo per lo studente. Al docente la barra del telefono avrebbe avuto sei voci, oltre le cinque del design system; un docente che apre `/studio` torna al grafo, come per le altre pagine fuori dal suo ruolo.

## Rotte

| Rotta | Cosa fa | Studente |
|---|---|---|
| `GET /api/courses/:id/studio` | perimetro, lezioni con i concetti che vi compaiono, concetti che si possono segnare | sì |
| `POST /api/courses/:id/study-plans` | `{days, knownLessons, knownConcepts}` → 202 `{planId}`; 422 se non resta niente; 429 oltre 3 in corso | sì |
| `GET /api/study-plans/:id` | piano, sessioni con concetti in ordine e «dopo», spiegazione, slide risolte | sì |
| WebSocket `/agents/pianificatore/:planId` | stato in sola lettura | sì |

## Come si prova

```
cd app/backend && npm install && npx wrangler d1 migrations apply aoc-db --local
npx wrangler dev --port 8790 --inspector-port 9332
node scripts/seed.mjs <cartella del materiale> --api http://localhost:8790 --ontologia
node scripts/seed-esame.mjs --api http://localhost:8790 && node scripts/seed-classe.mjs --api http://localhost:8790
cd ../frontend && npm install && NEXT_PUBLIC_API_BASE=http://localhost:8790 npx next dev --port 3003
```

`http://localhost:3003`, selettore «Studente», voce «Studio»: scegli i giorni, tocca le lezioni che conosci, cerca un concetto, «Prepara il piano». Per il perimetro «lezioni svolte» il docente le segna prima dalla pagina Lezioni; senza, il piano copre tutto il corso. Il percorso in Playwright, dalla radice, con i progetti di `playwright.config.ts`:

```
cd app/frontend && npx next build                      # l'export che serve il Worker
DEMO_URL=http://localhost:8790 npm run e2e -- e2e/blocco3.spec.ts --project=desktop
```

## Cosa è stato fatto davvero

Prove del 14/11/2026 sul corso intero (14 fonti, 184 concetti, 362 relazioni), con L00-L08 segnate come svolte dalla pagina Lezioni: perimetro di 120 concetti.

- Piano a 5 giorni conoscendo L00 e L01: 91 concetti in 5 sessioni da 18, 123 collegamenti rispettati, 1 ciclo spezzato. Piano a 4 giorni conoscendo L00 e «Policy» (quello del percorso Playwright): 103 concetti in 4 sessioni, 135 collegamenti, 1 ciclo.
- Ogni sessione con spiegazione e 4 slide da guardare, tutte fra le prove dei suoi concetti e delle lezioni svolte.
- Costo misurato da `model_calls`: 22 chiamate del Pianificatore in 5 piani, 0,0106 $ in tutto; un piano da 0,0009 a 0,0031 $, da 8 a 25 secondi. Spesa totale del blocco in sviluppo: 0,018 $ (compresa la semina).
- Playwright, `e2e/blocco3.spec.ts`: passa a 1440 × 900 e a 390 × 844, senza scorrimento orizzontale e senza errori in console.
- **Fusione con `main`** (14:30): conflitti solo sugli agganci dei file comuni, perché le versioni di `main` coincidevano con la base del blocco 3 tranne una riga del guscio, ripresa. `next build` passa. Percorso intero (demo, blocco 2, blocco 3) contro il Worker su `:8790` con l'export statico, un progetto alla volta con il D1 riseminato pulito prima di ciascuno: desktop 5 su 5 (0,0128 $), telefono 5 su 5 (0,0115 $), audit della demo senza segnalazioni. In `demo.spec.ts` cambia solo il passo dello studente, che ora vede anche «Studio».

Due difetti visti e corretti nel build: con più di 14 concetti per sessione alcuni restavano senza passaggio e il modello li diceva «senza prove» (ora una prova per concetto prima delle seconde, e il prompt dice che solo i segnati non hanno prove); la spiegazione elencava tutti i concetti e veniva tagliata a metà parola (ora al massimo cinque concetti chiave e taglio su frase intera).

## Cosa resta fuori o aperto

- **L'ordine è quello del grafo, non quello del docente.** Le relazioni `usa` sono la maggioranza (238 su 362) e a volte spostano un concetto lontano dalla sua lezione: «ε-greedy» (L02) finisce nella sessione 4 perché nel grafo usa «Coverage assumption» (L07). La vista «L'ordine nel grafo» mostra il perché di ogni posto.
- **Sessioni grandi con pochi giorni**: 4 giorni per 103 concetti fanno sessioni da 26. Il piano non toglie concetti per stare nei tempi.
- Nessuna simulazione nuova; il ruolo resta il selettore simulato del guscio. Il piano non è legato a uno studente: chi ha l'indirizzo `?p=` lo rilegge.
- Nessun deploy e nessun comando remoto.
