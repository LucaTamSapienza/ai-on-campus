# Design system di Prisma

Generato con `ui-ux-pro-max --design-system` il 14/11/2026 e ridotto dall'orchestratore alla proposta più sobria. Dalla skill restano palette e font. Scartati: lo stile «glassmorphism» (sfocature e trasparenze si leggono male su un proiettore) e lo schema da landing page, che qui non serve. Questo file è la regola: si cambia solo se lo chiede Luca.

## Principi

- **Minima e fluida.** Poche cose per schermata, una sola azione principale, molto spazio. Niente decorazioni, niente ombre spesse, niente gradienti.
- **Desktop e telefono alla pari.** Ogni componente nasce con le due forme. Niente dipende dal passaggio del mouse.
- **Il grafo è il protagonista.** Il resto dell'interfaccia è neutro, il colore sta nei nodi.
- **Tema chiaro soltanto.** Un proiettore regge meglio il chiaro. Niente tema scuro durante il build.

## Colori

Ridisegnata il 14/11/2026 con le skill `interfaces` (better-colors, better-ui, better-typography, better-layout, better-accessibility, better-writing, better-interface). Token CSS in `app/frontend/app/globals.css`, su tre livelli: **primitivi** (valori, nominati per tono: `--blue-600`), **semantici** (ruoli: `--primary`, `--muted-foreground`), **di componente** (`--graph-edge`, `--control-press-scale`). Componenti e pagine usano solo semantici e di componente, attraverso le classi Tailwind (`bg-primary-soft`, `text-accent-strong`). Nessun colore, ombra o durata scritti a mano nei componenti: se manca un ruolo si aggiunge il token.

### Rampe primitive

Rampe OKLCH a tono costante (la scala di Tailwind 4) convertite in hex sRGB. I gradini 600 del blu, del verde acqua, dell'arancione e del magenta e lo slate 800 sono quelli del logo (`public/brand/prisma-mark.svg`). Si tengono solo i gradini che un ruolo usa.

| Rampa | Gradini usati |
|---|---|
| slate (tono 257) | 50 `#F8FAFC`, 100 `#F1F5F9`, 200 `#E2E8F0`, 300 `#CAD5E2`, 450 `#8495AE`, 500 `#62748E`, 600 `#45556C`, 700 `#314158`, 800 `#1E293B` |
| blue (tono 263) | 50 `#EFF6FF`, 100 `#DBEAFE`, 600 `#2563EB`, 700 `#1447E6` |
| orange (tono 41) | 50 `#FFF7ED`, 600 `#EA580C`, 700 `#C43E00` |
| red (tono 22) | 50 `#FEF2F1`, 100 `#FFE2E0`, 600 `#E20033`, 700 `#BD0029` |
| green (tono 150) | 50 `#F0FDF4`, 700 `#00813A` |

Il rosso sta a tono 22 e non 27 come in Tailwind: così è a 19 gradi dall'arancione e a 21 dal magenta, e il «distruttivo» non si confonde con «agente al lavoro». Lo slate 450 (L 0,665) è un gradino aggiunto apposta: il più chiaro che fa 3:1 sul bianco, per il bordo dei campi.

### Ruoli semantici e contrasti misurati

| Token | Valore | Uso | Contrasto misurato |
|---|---|---|---|
| `--background` | slate 50 | fondo dell'app e della tela | |
| `--card` | bianco | pannelli, fogli, schede | |
| `--foreground` | slate 800 | testo | 14,6:1 su card, 14,0:1 sul fondo |
| `--muted` | slate 100 | fondi secondari, chip spenti, hover | |
| `--muted-hover` | slate 200 | hover su un fondo già muted | |
| `--muted-foreground` | slate 600 | testo secondario | 7,6:1 su card, 6,9:1 su muted |
| `--border` | slate 200 | bordi di struttura, divisori | (decorativo) |
| `--input` | slate 450 | bordo dei campi | 3,05:1 su card (WCAG 1.4.11) |
| `--primary` | blue 600 | l'unica azione piena della vista, nodo selezionato | bianco sopra 5,2:1 |
| `--primary-hover` | blue 700 | hover del pulsante primario | bianco sopra 6,8:1 |
| `--primary-soft` / `--primary-strong` | blue 50 / blue 700 | stato selezionato: voce di menu attiva, chip acceso | 6,3:1 |
| `--accent` | orange 600 | un solo significato: un agente lavora o qualcosa è appena arrivato. Riempimenti e icone | 3,6:1 (grafica) |
| `--accent-strong` | orange 700 | lo stesso significato quando è testo | 5,2:1 su card |
| `--destructive` | red 600 | elimina, esito negativo | 4,9:1 su card |
| `--destructive-soft` / `--destructive-strong` | red 50 / red 700 | pulsante distruttivo tenue | 6,0:1 |
| `--success` / `--success-soft` | green 700 / green 50 | esito positivo | 5,0:1 su card, 4,8:1 sul tenue |
| `--ring` | blue 600 | anello del fuoco, pieno, 3 px | 5,0:1 sul fondo |

Regole: il pieno di colore va a una sola azione per vista; gli stati selezionati sono tenui (`primary-soft` più bordo o anello `primary`), mai pieni. L'arancione come testo è sempre `accent-strong`. Il testo non si scrive mai su un colore con trasparenza.

### Colori degli argomenti nel grafo

Dodici toni a 30 gradi l'uno dall'altro partendo dal blu del logo, luminosità OKLCH fra 0,44 e 0,66 (più scura o più chiara dove due toni sono vicini: ciano chiaro, verde acqua medio, blu petrolio scuro; ocra chiaro, oliva scuro), croma al 90% del massimo del tono: stesso peso visivo, tutti almeno 3:1 sul fondo (WCAG 1.4.11). L'ordine alterna toni lontani, così due argomenti vicini nell'elenco non si confondono.

| # | Tono | Valore | Contrasto sul fondo |
|---|---|---|---|
| 1 | blu 262 | `#1B63F1` | 4,9 |
| 2 | verde acqua 184 | `#24897D` | 4,1 |
| 3 | magenta 354 | `#CD2780` | 4,8 |
| 4 | arancione 41 | `#D85923` | 3,7 |
| 5 | viola 292 | `#7629EE` | 6,0 |
| 6 | verde 142 | `#23811C` | 4,8 |
| 7 | porpora 322 | `#A423B7` | 5,7 |
| 8 | ciano 206 | `#2B9DA9` | 3,1 |
| 9 | rosso 22 | `#DB293C` | 4,6 |
| 10 | oliva 108 | `#696718` | 5,7 |
| 11 | blu petrolio 236 | `#15597B` | 7,3 |
| 12 | ocra 74 | `#C08528` | 3,0 |

La tela li legge dai token con `readGraphTheme()` in `lib/graph-style.ts`: si cambiano solo in `globals.css`. Un nodo attenuato usa lo stesso colore al 20% di opacità. Il colore non è mai l'unico segnale: l'argomento è scritto nel dettaglio e nei chip, il nodo nuovo cresce ed è arancione, il selezionato ha l'anello.

## Tipografia

- **Plus Jakarta Sans** per tutto, pesi 400, 500, 600, 700, caricata con `next/font` (nessuna richiesta a terzi a runtime). Riserva: `system-ui, sans-serif`.
- Monospazio di sistema (`ui-monospace, SFMono-Regular, Menlo, monospace`) per posizioni e citazioni: «L08 · slide 31».
- Scala: 12, 14, 16, 18, 24, 32 px. Testo corrente 16 px su telefono e desktop, mai sotto 14. Titolo di pagina 24 su telefono e 32 su desktop.
- Interlinea 1,5 per il testo, 1,25 per i titoli; un testo che va su tre righe o più non scende sotto 1,4 (il testo della domanda d'esame usa 1,5 anche a 24 px).
- Titoli con `text-wrap: balance`, paragrafi con `text-wrap: pretty` e `overflow-wrap: break-word`. Titolo di pagina con spaziatura -0,02em.
- Righe lunghe al massimo `--measure` (65 caratteri): descrizioni di pagina e testo della domanda.
- Ogni `h2` di sezione è 18 px semibold, in tutte le pagine. Niente 20 px: non è nella scala.
- Numeri che cambiano (contatori, punteggi, timer) con `tabular-nums`. Caratteri tipografici veri: `…`, `·`, virgolette curve.
- Levigatura dei caratteri una volta sola sulla radice (`antialiased`). Campi a 16 px anche su telefono (niente zoom di iOS).
- Etichette del grafo 12 px, peso 500.

## Spazi, raggi, ombre

- Spazi in multipli di 4, come token: `--space-1` 4, `--space-2` 8, `--space-3` 12, `--space-4` 16, `--space-6` 24, `--space-8` 32, `--space-12` 48. Fra gruppi almeno il doppio dello spazio dentro il gruppo.
- Raggi: `--radius-6` per gli elementi dentro un contenitore, `--control-radius` 8 px per controlli e schede, `--radius-12`, `--radius-16` per il foglio dal basso, pieno per chip e pillole. Contenitori annidati: raggio esterno uguale a interno più spaziatura (selettore di ruolo: 6 + 2 = 8).
- Un'ombra sola, `--elevation-float` (classe `shadow-float`), per ciò che galleggia sulla tela: pannello, foglio, barra di ricerca, chip. Ha un anello di 1 px a 6% al posto del bordo, così regge anche senza bordo. Tutto il resto è delimitato da un bordo.

## Stati e controlli

- **Una sola azione piena per vista** (`bg-primary`). Le altre sono `outline`, `secondary` o `ghost`.
- **Selezionato** = fondo `primary-soft` più bordo o anello `primary` (chip degli argomenti, chip del piano di studio, voce di menu attiva). Mai solo il colore del testo: la voce attiva della barra in basso ha anche una pillola dietro l'icona.
- **Fuoco** = anello pieno `--ring` da 3 px su `:focus-visible`, mai trasparente. Primo elemento focalizzabile: «Skip to content», che porta al `main`.
- **Premuto** = scala `--control-press-scale` 0,96 in 150 ms, solo sui pulsanti abilitati e solo con movimento ammesso.
- **Hover** solo come rinforzo (Tailwind 4 lo mette già sotto `@media (hover: hover)`): niente informazione che appaia solo al passaggio del mouse.
- **Errori**: dicono cosa è successo e cosa fare («Could not save. Try again.», «Unable to reach the server. Check the connection and try again.»).
- Aree che scorrono dentro un pannello o un foglio con `overscroll-behavior: contain`.

## Movimento

- Token: `--duration-fast` 150 ms per i controlli, `--duration-panel` 250 ms per pannelli e fogli, `--duration-enter` 300 ms per le entrate; curva `--curve-out` `cubic-bezier(0.2, 0, 0, 1)` (classe `ease-out`).
- Si animano solo le proprietà che cambiano (`transition-[color,background-color,border-color,scale]`), mai `transition-all`.
- I contenuti compaiono senza spostare ciò che c'è già: segnaposto con le dimensioni finali, mai salti di layout.
- Nel grafo i nodi nuovi entrano crescendo da zero in 300 ms e restano arancioni per qualche secondo.
- Con `prefers-reduced-motion` le animazioni durano un istante e girano una volta sola (gli spinner restano fermi accanto alla loro etichetta), e il grafo si presenta già assestato.
- Niente animazioni decorative. Ogni stato animato ha anche un segnale fermo: un'etichetta, un'icona o un colore.

## Disposizione

| | Telefono (sotto 768 px) | Desktop (da 1024 px) |
|---|---|---|
| Navigazione | barra in basso, da 2 a 5 voci con icona ed etichetta | barra a sinistra, 232 px, icona ed etichetta |
| Intestazione | 56 px: marchio, nome del corso, selettore di ruolo | nella barra laterale: solo logo e scritta Prisma in alto, selettore di ruolo in fondo allineato alle voci di menu. Il selettore non ha etichetta visibile: il gruppo si chiama «Simulated role» per i lettori di schermo e il README dice che il ruolo è simulato |
| Tela del grafo | tutto lo schermo fra intestazione e barra | tutto lo spazio a destra della barra |
| Dettaglio | foglio dal basso, a metà e a tutta altezza, si trascina | pannello a destra, 400 px, la tela si restringe |
| Ricerca e filtri | campo in alto sulla tela; filtri in un foglio | campo e chip in alto sulla tela |
| Pagine a elenco | una colonna, margine 16 px | colonna centrale fino a 880 px |

Fra 768 e 1024 px vale la disposizione del telefono con la tela più larga. Altezze con `100dvh`. Margini di sicurezza con `env(safe-area-inset-*)` su intestazione e barra in basso. Bersagli da almeno 44 × 44 px con 8 px fra l'uno e l'altro. Nessuno scorrimento orizzontale della pagina.

## Componenti

Da shadcn/ui, installati solo quando servono: `button`, `input`, `textarea`, `badge`, `sheet` o `drawer` per il foglio dal basso, `tabs`, `skeleton`, `sonner` per gli avvisi, `dialog` per le conferme. Icone Lucide, mai emoji.

Componenti condivisi del guscio, in `app/frontend/components/`:

| Componente | Cosa fa |
|---|---|
| `AppShell` | navigazione nelle due forme, intestazione, selettore di ruolo |
| `GraphCanvas` | la tela a forze, con fuoco, etichette, gesti |
| `DetailPanel` | pannello a destra su desktop e foglio dal basso su telefono, stesso contenuto |
| `AgentStrip` | la striscia che dice quale agente lavora e a che punto è |
| `SourceRef` | la citazione di un passaggio: fonte, posizione, testo espandibile |
| `EmptyState` | stato vuoto con una sola azione |

Ogni stato ha la sua forma: vuoto, in caricamento (segnaposto), in lavorazione (striscia dell'agente), errore con cosa fare. Il fuoco da tastiera si vede sempre. Contrasto del testo almeno 4,5 a 1.

## Testi

Interfaccia in inglese (la lingua della giuria). Verbi all'attivo sui pulsanti («Attack the question», «Build the plan»). I nomi dei concetti restano nella lingua del materiale. Gli errori dicono cosa è successo e cosa fare.
