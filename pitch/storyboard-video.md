# Prisma — il video del pitch (16:9, 1920×1080, 30 fps, 30 s)

**L'idea in una riga:** il docente scrive l'esame al buio; Prisma attacca ogni domanda in tre modi prima dell'appello, porta la prova al docente e lascia a lui la decisione.

**Formato.** Si proietta durante il pitch dell'hackathon, con chi presenta che ci parla sopra. **Il video è in inglese e racconta per immagini:** una sola scritta per scena, al massimo cinque parole, grande; il resto sono etichette di una o due parole. Quello che le immagini non dicono lo dice chi presenta. Ogni parola a schermo sta in `copy.ts`. Tema chiaro, come il prodotto (Plus Jakarta Sans, fondo `#F8FAFC`, primario `#2563EB`, arancione `#EA580C` per l'agente che lavora, rosso e verde per gli esiti). Il buio entra solo dove racconta qualcosa: l'esame scritto al buio, il prisma che si accende, la chiusura che passa dal buio alla luce.

**Revisioni.** 14 novembre 2026: effetti e ritmo (da 43 s a 36 s), poi tutto in inglese. Stesso giorno: molto meno testo e più immagini, sei scene invece di otto, 30 s. Tolte le quattro schede dello studente e «And around it» (le funzioni in arrivo le racconta chi presenta).

**Effetti** (in `fx.tsx`, per tutte le scene): camera viva con spinte lente e tremolio sui colpi; molle al posto delle dissolvenze; scritta che arriva parola per parola; sfondo di punti in parallasse con tre pozze di colore; raggi con alone, nucleo caldo e particelle.

**Le schermate.** Disegnate in Remotion con i token del design system, schematiche. L'esempio (la domanda su Q-learning e SARSA, gli esiti, la riscrittura) è illustrativo e lo dice a schermo (*Illustrative example*).

**Onestà.** Nessun numero inventato. Nessuna promessa di esami «a prova di AI», «equi» o «che non si copiano». Le funzionalità non ancora costruite (lato studente, piano di studio) hanno l'etichetta *coming soon*, comandata da `inArrivo` in `copy.ts`. Nessun ateneo, nessun docente o studente reale.

**Il nome.** In `src/brands/prisma/brand.ts`: **Prisma** · «Every exam question, seen from three sides before students see it.» La promessa («It brings the proof. The lecturer decides.») resta nel brand kit; nel video la dice la scena 4.

I tre agenti, come badge con un'icona: **Outsider** (un bot: solo la domanda, il modello che lo studente ha in tasca), **Literalist** (un libro: solo il corso), **Nitpicker** (una lente: cerca due letture).

## Le scene

| # | Scena | Durata | Cosa si vede | Unica scritta | Suono |
|---|---|---|---|---|---|
| 1 | Il problema | 6,0 s | Buio, un grande foglio d'esame si scrive da solo sotto la luce di uno schermo. Un neon sfarfalla e si accende: la domanda trema in rosso e blu e si spacca in due rami, **A** e **B**. Un bot la risolve da solo (le righe di risposta si riempiono), cade il timbro *solved by AI* con tremolio e schizzi. Due barre: *Exam 1* altissima, *Exam 2* piatta | *Exams are written in the **dark**.* | Letto grave; clic sullo sfarfallio, colpo sordo e secco sul timbro |
| 2 | Il corso diventa grafo | 5,0 s | Punti grigi sparsi. Arrivano *Slides* e *Notes* come grandi icone e si sciolgono in flussi di luce; ogni punto raggiunto prende il colore del suo argomento, i punti si radunano, i collegamenti si disegnano con scintille. Q-learning si accende con un'onda e la citazione `L08 · slide 31`; la camera si tuffa nel nodo | *Your course, as a **graph**.* | Fruscio d'entrata, blip sui nodi, fruscio sul tuffo; il letto si apre in maggiore |
| 3 | Il triplo attacco | 7,0 s | Le luci si abbassano. La domanda (*v1*) manda un raggio bianco in un prisma di vetro: lampo, onda, tremolio, tre raggi colorati. Su ognuno scende una sfera di luce che atterra e diventa un agente. Le luci tornano; l'anello arancione di ogni agente gira mentre lavora, poi l'esito: ✗ *No course needed*, ✓ `L08 · slide 31`, ✗ *Two readings* | *Three agents **attack** every question.* | Salita nel buio, fruscio sul raggio, colpo sul lampo, impulsi, tick e colpi sordi sugli esiti |
| 4 | Decide il docente | 5,0 s | Stessa inquadratura, taglio netto. Il docente cancella la domanda e la riscrive; compare *Approve*, il puntatore lo preme (increspatura, scintille). La luce riparte dalla domanda (*v2*) attraverso il prisma fino agli agenti, che girano e si voltano uno dopo l'altro: ✓ *Needs the course*, ✓ `L08 · slide 31`, ✓ *No second reading* | *The lecturer **decides**.* | Tasti, clic, fruscio e colpo sul riattacco, tre ping che salgono |
| 5 | Lo studente | 3,5 s | Frustata. Il grafo in sola lettura: pieni i concetti fatti a lezione, vuoti quelli solo nelle note. *4 weeks*, e una cometa disegna il percorso che rispetta i prerequisiti; ogni concetto raggiunto pulsa e prende la sua settimana. Poi si spegne la luce e la luce dell'ultimo concetto scivola al centro | *Students see the **path**.* · *coming soon* | Fruscio d'entrata, quattro note che salgono, salita nel buio |
| 6 | Chiusura | 4,5 s | Taglio netto: dal punto di luce cresce un grande prisma; un raggio bianco ci cade dentro, tre raggi esplodono e si gonfiano finché la luce invade lo schermo. Dal bianco: il segno, «Prisma» lettera per lettera con un riflesso nei tre colori, la frase di lancio, sul grafo in filigrana | **Prisma** · «Every exam question, seen from three sides before students see it.» | Fruscio, boom quando la luce esplode, la campana del logo; il letto sfuma |

Passaggi (10 fotogrammi): 1→2 frustata · 2→3 tuffo dentro Q-learning · 3→4 taglio sulla stessa inquadratura · 4→5 frustata · 5→6 taglio sul punto di luce.

## Le rime

I punti grigi diventano il grafo (scena 2), che torna in sola lettura per lo studente (scena 5) e in filigrana sotto il nome (scena 6). Il prisma che si accende nel buio dell'attacco (scena 3) è lo stesso che si accende nel buio della chiusura (scena 6), e il buio dell'apertura si scioglie nella luce del finale. La domanda che nella scena 1 si spacca in A e B è quella che il Nitpicker prende in fallo nella scena 3. Attacco e decisione sono una sola inquadratura: la stessa domanda, riscritta, riattaccata.
