# Fase 00, brainstorming

Stato: **idea non scelta**. Quattro idee confrontate, una raccomandazione provvisoria, adversarial di Codex in corso. Sceglie Luca.

Fonti: `input/case-study-reply.md` (testo integrale del case study Reply) e `input/briefing-circleback.md` (briefing in aula delle 11:04).

## I vincoli che contano

- **Tema:** teaching, learning o assessment. Amministrazione e logistica sono fuori tema: iscrizioni, tasse, orari, aule, servizi. Un'idea B2B va bene solo se il prodotto tocca come si insegna, come si impara o come si valuta. Compra l'ateneo o il dipartimento, lo usano docenti e studenti.
- **Pesi:** creatività e innovazione 40%, impatto 20%, tecnica 20%, presentazione 20%.
- **Le tre domande dei giudici, a ogni livello:** è davvero nuovo o solo più veloce? Aiuta a pensare o pensa al posto di qualcuno? Chi ci guadagna e chi resta fuori?
- **Level 2, il prototipo:** lavora su materiale vero del corso (slide, dispense, syllabus, esami passati), compie almeno un'azione oltre a rispondere, e conosce il suo limite. Fra gli esempi di interazione ne serve uno in cui l'agente tiene il confine.
- **Level 3, facoltativo ma valutato:** sistema multi-agente, knowledge graph, campagna di lancio. Il knowledge graph deve mostrare il percorso del ragionamento, citare la fonte e dire quando l'informazione non c'è.
- **Presentazione:** 60 secondi senza slide (problema, idea, impatto), alle 15:00 quando passano gli esperti. I primi tre presentano poi con slide, 5 minuti al massimo.
- **Il rischio di oggi:** gli esempi della pagina sono tutor, quiz adattivi, simulatore di orale, feedback sui saggi. Molte squadre faranno quelli. Con il 40% sulla creatività, un altro tutor parte indietro.

## Le idee

### 1. La classe di prova: l'esame lo sostengono prima gli studenti sintetici (assessment)

- **Chi compra e chi usa.** Compra il dipartimento o il presidio di qualità dell'ateneo. Lo usa il docente quando prepara un appello.
- **Il problema oggi.** Un docente scopre se una domanda d'esame funziona solo dopo averla data a 200 studenti. Oggi poi buona parte delle domande scritte la risolve un modello generico senza aver seguito il corso: l'esame misura cosa si riesce a generare, non cosa si è capito. Il costo è un appello che non distingue chi ha capito da chi ha memorizzato o copiato, e ore di correzione su domande ambigue.
- **Cosa fa l'AI che prima non si poteva.** Il docente carica la bozza dell'esame e il materiale del corso. Una classe di agenti studenti la sostiene davvero: quello che ha capito (ha il grafo dei concetti del corso), quello che ha memorizzato le slide (può solo citarle), quello con un'idea sbagliata precisa su un prerequisito, quello che non ha seguito e usa solo un modello generico. Un agente valutatore corregge con la griglia del docente. Un agente revisore legge i risultati: se tutti prendono lo stesso voto la domanda non misura niente, se passa chi non ha seguito la domanda è generabile, se sbaglia chi ha capito è ambigua. Per ogni domanda debole propone una riscrittura e la fa risostenere alla classe. Provare un esame prima di darlo era impossibile senza studenti veri.
- **La demo in due minuti.** Il docente carica syllabus, slide e cinque domande. Si vedono i quattro studenti rispondere in streaming, il valutatore dare i voti, una mappa domande per studenti che si colora. Due domande risultano rosse («la passa chi non ha seguito»). Il docente accetta una riscrittura, la classe la risostiene, diventa verde. Sul grafo del corso si vede quali concetti l'esame copre e quali no.
- **Cosa si costruisce oggi.** Caricamento del materiale, estrazione del grafo dei concetti in D1, quattro agenti studenti, valutatore, revisore, schermata della mappa, riscrittura e seconda corsa. Level 3: multi-agente pieno (ruoli distinti, proposte indipendenti, confronto, punto di decisione umano) e knowledge graph (ogni giudizio cita concetto e fonte).
- **Le tre domande.** Nuovo: sì, non accelera niente che oggi esista. Pensa al posto di qualcuno: no, il docente decide ogni riscrittura; il limite da tenere è che il sistema non scrive l'esame da zero. Chi resta fuori: gli studenti non lo usano, ne beneficiano in modo indiretto con esami più giusti.
- **Punti deboli.** Chi dice che uno studente sintetico somiglia a uno vero? Oggi non si può calibrare su risposte reali di esami passati, e va detto. Gli studenti non compaiono: l'impatto è indiretto. Un modello economico potrebbe non tenere bene i profili (quello «che ha memorizzato» che ragiona troppo bene).

### 2. Il polso dell'aula: le domande mai fatte arrivano al docente come mappa (teaching)

- **Chi compra e chi usa.** Compra il dipartimento per i corsi numerosi del primo anno. Lo usano il docente e gli studenti del corso.
- **Il problema oggi.** In un'aula da 200 le domande non si fanno. Il docente scopre cosa non è passato all'esame, tre mesi dopo, quando non può più farci niente. Il costo sono bocciature e abbandoni nei corsi di base.
- **Cosa fa l'AI che prima non si poteva.** Dopo la lezione gli studenti fanno domande a un tutor ancorato al materiale del corso, che guida senza dare la soluzione degli esercizi. Un agente diagnostico riconduce ogni domanda a un concetto del grafo del corso e al tipo di errore (manca un prerequisito, confusione fra due concetti). Prima della lezione successiva il docente vede la mappa: «il 40% non ha capito X perché manca Y». Un agente didattico propone un recupero di cinque minuti e un esercizio; il docente approva e gli studenti lo ricevono. Il segnale dall'aula al docente, in tempo utile, prima non esisteva.
- **La demo in due minuti.** Due studenti fanno una domanda ciascuno; sul grafo si accendono i nodi; la vista del docente mostra il buco principale con le domande anonime che lo provano; il docente approva il recupero proposto; lo studente lo riceve.
- **Cosa si costruisce oggi.** Tutor con materiale vero, diagnostico, grafo in D1, vista docente in tempo reale, agente didattico, approvazione. Per riempire la mappa servono domande di una classe: si seminano domande sintetiche in D1 e gli agenti le lavorano davvero. Level 3: multi-agente e knowledge graph.
- **Le tre domande.** Nuovo: il segnale è nuovo, ma la faccia rivolta allo studente è un tutor come quello di molte squadre. Pensa al posto di qualcuno: il tutor guida, il docente decide il recupero. Chi resta fuori: chi non fa domande nemmeno a un'AI.
- **Punti deboli.** In 60 secondi rischia di suonare «un chatbot più una dashboard». Il valore dipende da quanti studenti lo usano. È il primo esempio della pagina (Q&A dopo la lezione), allargato.

### 3. Spiegalo a Leo: lo studente insegna a un compagno sintetico che non capisce (learning)

- **Chi compra e chi usa.** Compra il dipartimento come esercitazione valutabile al posto dei compiti a casa, che oggi si fanno con un modello generico. Lo usano gli studenti; il docente lo assegna e legge il risultato.
- **Il problema oggi.** I compiti a casa non dicono più niente: li scrive l'AI. E lo studente non sa cosa sa davvero finché non deve spiegarlo, cioè all'orale.
- **Cosa fa l'AI che prima non si poteva.** Si rovescia il tutor. Lo studente deve spiegare un concetto a Leo, un compagno sintetico con un'idea sbagliata precisa presa dal grafo del corso. Leo fa domande ingenue, ripete quello che ha capito, sbaglia dove la spiegazione è debole. Un agente osservatore segue la conversazione e segna sul grafo cosa lo studente ha saputo spiegare e cosa no. Il docente riceve la mappa della classe. Un compagno paziente che non capisce, per ogni studente, non c'era.
- **La demo in due minuti.** Luca spiega un concetto a Leo, Leo fraintende in un punto preciso, Luca corregge, la mappa di quello che sa si aggiorna. Si mostra il confine: se lo studente chiede a Leo la risposta, Leo non la sa.
- **Cosa si costruisce oggi.** Agente compagno con profili di errore, osservatore, grafo, vista docente. Più piccolo delle altre due.
- **Le tre domande.** Nuovo: abbastanza, imparare insegnando a un'AI è un'idea nota in ricerca ma rara nei prodotti. Pensa al posto di qualcuno: è l'idea più forte su questo, l'AI non può pensare al posto dello studente perché fa quella che non sa. Chi resta fuori: chi fatica a scrivere o a parlare.
- **Punti deboli.** Suona più come app per lo studente che come prodotto B2B. Lo studente può comunque farsi scrivere la spiegazione da un altro modello. La demo dipende da una conversazione dal vivo, che può andare storta.

### 4. Il simulatore d'orale con la griglia del docente (assessment e learning)

- **Chi compra e chi usa.** Compra il dipartimento, lo usano gli studenti prima dell'appello; il docente carica programma e griglia.
- **Il problema oggi.** L'orale si prova una volta sola, il giorno dell'esame.
- **Cosa fa l'AI.** Un esaminatore che incalza quando il ragionamento è fragile, un valutatore che applica la griglia, una mappa delle lacune che ancora contano.
- **Perché sta in fondo.** È un esempio scritto nella pagina di Reply: lo faranno in molti. Fatto bene vale sulla tecnica, poco sul 40% di creatività.

## Confronto sui criteri

| | Creatività 40% | Impatto 20% | Tecnica 20% | Presentazione 20% | Level 3 |
|---|---|---|---|---|---|
| 1. Classe di prova | alta: nessun esempio della pagina le somiglia | media: indiretto sugli studenti, diretto sul docente | alta: più agenti con ruoli veri, grafo, seconda corsa | alta: una frase sola la spiega | multi-agente e grafo naturali |
| 2. Polso dell'aula | media: segnale nuovo, tutor già visto | alta: corsi numerosi, docente e studenti | alta: tempo reale, grafo, tre agenti | media: due facce da spiegare in 60 secondi | multi-agente e grafo naturali |
| 3. Spiegalo a Leo | medio alta | media | media: meno pezzi | alta: si capisce guardando | grafo sì, multi-agente piccolo |
| 4. Simulatore d'orale | bassa | media | media | media | grafo sì |

## Raccomandazione provvisoria

**La 1, la classe di prova.** Prende il criterio che pesa di più, ha un pitch da una frase («oggi il tuo esame lo passa un modello che non ha mai seguito il corso: prima di darlo agli studenti, fallo sostenere a una classe sintetica») e il multi-agente non è decorazione: senza più studenti diversi il prodotto non esiste. È anche la direzione che chi presentava ha chiamato «più difficile», quindi meno affollata.

La 2 è la seconda scelta, più sicura sull'impatto e più vicina al «teaching» di cui si parlava in squadra. Una variante che tiene insieme le due: il grafo del corso è lo stesso, e i profili di errore degli studenti sintetici della 1 possono nascere dalle domande vere raccolte dalla 2. Non per oggi: oggi se ne fa una.

## Adversarial di Codex

In corso. Qui vanno le obiezioni che reggono e cosa cambiano.

## Idea scelta

Da scrivere quando Luca sceglie, con il perché.
