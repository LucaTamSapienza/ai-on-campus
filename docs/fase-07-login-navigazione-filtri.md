# Fase 07: accesso di demo, navigazione a gruppi, legenda degli argomenti

Tre richieste di Luca delle 15:50 del 14/11/2026, su `feat/login-navbar-filtri`.

## Cosa si costruisce

- **Accesso di demo (`/login`).** Pagina fuori dal guscio con logo, email, password e il blocco «Demo accounts» (`teacher@prisma.edu`, `student@prisma.edu`, password uguale all'email; un tocco riempie i campi). È vero e semplice lato server: `POST /api/login` (`app/backend/src/auth.ts`) confronta le credenziali a tempo costante con due costanti e restituisce un token firmato HMAC-SHA256 con `SESSION_SECRET`, che porta ruolo, email e scadenza (12 ore). Senza token valido tutte le rotte `/api` tranne `/api/health` e `/api/login` rispondono 401, e così i WebSocket `/agents/*`. `studentGuard` e `studentAgentForbidden` ricavano il ruolo dal token verificato; `x-role` non vale più. Il frontend tiene il token in `sessionStorage` e lo manda da `lib/api.ts` come `Authorization: Bearer` e come `?token=` sui WebSocket (`agentQuery()`). Un 401 `unauthorized` cancella la sessione e riporta all'accesso.
- **Navigazione.** Barra laterale con logo e scritta Prisma in alto (il nome del corso resta solo nell'intestazione del telefono), voci in gruppi («Course», «Assessment», per lo studente «My study») e in fondo l'utente entrato con ruolo, email e «Sign out». Sul telefono intestazione con avatar che apre un foglio con utente e «Sign out», e barra in basso con al massimo cinque voci. Il selettore Teacher/Student è sparito: il ruolo arriva dall'account.
- **Filtro per argomento.** Al posto della fila di chip che scorreva e tagliava l'ultimo: pulsante «Topics» accanto alla ricerca, che riassume gli argomenti attivi e apre la legenda con tutti e 12 gli argomenti a capo (pallino, nome intero, numero di concetti, casella, «Clear»). Pannello sotto la barra su desktop, foglio dal basso sul telefono, stesso contenuto.
- **Script e spec.** `seed.mjs`, `seed-esame.mjs`, `seed-classe.mjs` entrano come docente via API all'inizio. Gli spec Playwright entrano da `/login` (`e2e/auth.ts`), cambiano ruolo con «Sign out» e nuovo accesso, e mandano il token nelle chiamate dirette.

Niente migrazioni e niente modifiche a `wrangler.jsonc`: `SESSION_SECRET` è un segreto (in locale `app/backend/.dev.vars`, online `wrangler secret put SESSION_SECRET`; se manca in locale vale il segreto di sviluppo dichiarato in `src/auth.ts`). Verdetti e prompt degli agenti non sono stati toccati.

## Come si prova

```bash
# D1 pulito e semina (gli script entrano da soli come docente)
cd app/backend && rm -rf .wrangler/state && npx wrangler d1 migrations apply aoc-db --local
node scripts/seed.mjs <materiale>/reinforcement-learning --api http://localhost:8791 --ontologia
node scripts/seed-esame.mjs --api http://localhost:8791 && node scripts/seed-classe.mjs --api http://localhost:8791

# spec, un progetto per volta con D1 riseminato prima di ciascuno
DEMO_URL=http://localhost:3004 API_URL=http://localhost:8791 LIVE_FILE=<materiale>/dal-vivo/Lab06-session-slides.md \
  npx playwright test e2e/demo.spec.ts e2e/blocco2.spec.ts e2e/blocco3.spec.ts --project=desktop
```

## Cosa è stato fatto davvero

- `npx next build` passa, con `/login` fra le pagine statiche.
- Spec su D1 riseminato pulito: desktop 5 su 5; telefono 5 su 5 (lo spec della demo rilanciato su D1 riseminato dopo aver corretto un'asserzione: col foglio modale aperto il pulsante «Topics» è nascosto ai lettori di schermo, ora si controlla «1 of 12 selected» nella legenda). Spesa delle corse: circa 0,01 $ per progetto.
- `blocco2.spec.ts`, lezioni: su D1 appena seminato nessuna lezione è segnata svolta e la prova delle proposte falliva a prescindere dall'accesso; ora tiene L01 svolta durante il controllo e poi la riporta com'era.
- Prove con curl: `/api/health` 200 senza token; `/api/courses` 401 senza token, con `x-role: docente` e con token manomesso; credenziali sbagliate 401 con un messaggio unico; email oltre 200 caratteri 400; WebSocket del Cartografo 401 senza token e 101 col token dello studente; WebSocket dell'attacco 403 allo studente; esami, studenti e spesa 200 al docente e 403 allo studente; creazione di un corso 403 allo studente; grafo 200 allo studente.
- `demo.spec.ts` usava `DEMO_URL` prima di `API_URL` per le chiamate dirette: con `next dev` su un'altra porta andava al frontend. Ora vale `API_URL` se c'è, come negli altri spec.

## Cosa resta fuori

- Due account fissi e nessun archivio di utenti, nessun recupero password: è un accesso di demo dichiarato, al posto del login d'ateneo.
- Il token sta in `sessionStorage`: si perde chiudendo la scheda, ed è voluto.
- Online va impostato `SESSION_SECRET` con `wrangler secret put` prima del deploy, altrimenti vale il segreto di sviluppo dichiarato nel codice.
