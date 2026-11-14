# Design system di Controesame

Generato con `ui-ux-pro-max --design-system` il 14/11/2026 e ridotto dall'orchestratore alla proposta più sobria. Dalla skill restano palette e font. Scartati: lo stile «glassmorphism» (sfocature e trasparenze si leggono male su un proiettore) e lo schema da landing page, che qui non serve. Questo file è la regola: si cambia solo se lo chiede Luca.

## Principi

- **Minima e fluida.** Poche cose per schermata, una sola azione principale, molto spazio. Niente decorazioni, niente ombre spesse, niente gradienti.
- **Desktop e telefono alla pari.** Ogni componente nasce con le due forme. Niente dipende dal passaggio del mouse.
- **Il grafo è il protagonista.** Il resto dell'interfaccia è neutro, il colore sta nei nodi.
- **Tema chiaro soltanto.** Un proiettore regge meglio il chiaro. Niente tema scuro durante il build.

## Colori

Token CSS in `app/frontend/app/globals.css`, esposti a Tailwind. Nessun colore scritto a mano nelle pagine.

| Token | Valore | Uso |
|---|---|---|
| `--background` | `#F8FAFC` | fondo dell'app e della tela |
| `--card` | `#FFFFFF` | pannelli, fogli, schede |
| `--foreground` | `#1E293B` | testo |
| `--muted` | `#E9EFF8` | fondi secondari, chip spenti |
| `--muted-foreground` | `#475569` | testo secondario |
| `--border` | `#E2E8F0` | bordi, archi del grafo a riposo |
| `--primary` | `#2563EB` | azione principale, nodo selezionato, fuoco |
| `--primary-foreground` | `#FFFFFF` | testo su primario |
| `--accent` | `#EA580C` | un solo richiamo per schermata: l'agente che lavora, il nodo appena aggiunto |
| `--destructive` | `#DC2626` | elimina, esito negativo di un attacco |
| `--success` | `#15803D` | esito positivo |
| `--ring` | `#2563EB` | contorno del fuoco da tastiera |

Colori degli argomenti nel grafo, in ordine, tutti leggibili su fondo chiaro: `#2563EB`, `#0D9488`, `#9333EA`, `#DB2777`, `#CA8A04`, `#0891B2`, `#65A30D`, `#DC2626`, `#4F46E5`, `#B45309`, `#059669`, `#7C3AED`. Un nodo attenuato usa lo stesso colore al 20% di opacità. Il colore non è mai l'unico segnale: l'argomento è scritto anche nel dettaglio.

## Tipografia

- **Plus Jakarta Sans** per tutto, pesi 400, 500, 600, 700, caricata con `next/font` (nessuna richiesta a terzi a runtime). Riserva: `system-ui, sans-serif`.
- Monospazio di sistema (`ui-monospace, SFMono-Regular, Menlo, monospace`) per posizioni e citazioni: «L08 · slide 31».
- Scala: 12, 14, 16, 18, 24, 32 px. Testo corrente 16 px su telefono e desktop, mai sotto 14. Titolo di pagina 24 su telefono e 32 su desktop.
- Interlinea 1,5 per il testo, 1,2 per i titoli. Etichette del grafo 12 px, peso 500.

## Spazi, raggi, ombre

- Spazi in multipli di 4: 4, 8, 12, 16, 24, 32, 48.
- Raggio 8 px per controlli e schede, 16 px per il foglio dal basso, pieno per i chip.
- Un'ombra sola, leggera, per ciò che galleggia sulla tela (pannello, foglio, barra di ricerca): `0 1px 2px rgb(15 23 42 / 0.06), 0 8px 24px rgb(15 23 42 / 0.08)`. Tutto il resto è delimitato da un bordo.

## Movimento

- Durate 150 ms per i controlli, 250 ms per pannelli e fogli, curva `ease-out`.
- I contenuti compaiono senza spostare ciò che c'è già: segnaposto con le dimensioni finali, mai salti di layout.
- Nel grafo i nodi nuovi entrano crescendo da zero in 300 ms e restano arancioni per qualche secondo.
- Con `prefers-reduced-motion` le transizioni si spengono e il grafo si presenta già assestato.
- Niente animazioni decorative.

## Disposizione

| | Telefono (sotto 768 px) | Desktop (da 1024 px) |
|---|---|---|
| Navigazione | barra in basso, da 2 a 5 voci con icona ed etichetta | barra a sinistra, 232 px, icona ed etichetta |
| Intestazione | 56 px: nome del corso, selettore di ruolo | nella barra laterale |
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

Interfaccia in italiano. Verbi all'attivo sui pulsanti («Carica una lezione», «Elimina il concetto»). I nomi dei concetti restano nella lingua del materiale. Gli errori dicono cosa è successo e cosa fare.
