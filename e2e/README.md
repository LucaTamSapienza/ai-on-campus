# e2e

Il percorso della demo in un browser vero, con Playwright, a due misure (desktop 1440 × 900 e telefono 390 × 844). Le chiamate ai modelli sono vere: serve l'app avviata in locale con il corso seminato, e una corsa completa costa meno di un centesimo.

- `demo.spec.ts`: blocco 1. Grafo, caricamento dal vivo, triplo attacco, decisione e riattacco, rifiuto senza griglia, accesso come studente.
- `blocco2.spec.ts`: classe simulata, lezioni registrate (con il microfono finto di Chromium), ruolo studente.
- `blocco3.spec.ts`: piano di studio, pagina intera e download del PDF.
- `auth.ts`: accesso con gli account di demo.
- `fixtures/lezione-breve.wav`: l'audio usato al posto del microfono.

Si lancia dalla radice con `npm run e2e`, oppure `DEMO_URL=<url> npm run e2e` contro un altro indirizzo. Non parte in automatico. Fra due corse il database va riseminato (`seed.mjs --ontologia` e `seed-esame.mjs`).
