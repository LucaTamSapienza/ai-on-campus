# Prisma — il video del pitch (16:9, 1920×1080, 30 fps, circa 43 s)

**L'idea in una riga:** il docente scrive l'esame al buio e lo studente ne paga gli errori; Prisma attacca ogni domanda in tre modi prima dell'appello, porta la prova al docente e lascia a lui la decisione.

**Formato.** Si proietta in aula durante il pitch dell'hackathon, con chi presenta che ci parla sopra: regge senza audio, testo grande e poco per scena, italiano. Tema chiaro, come il prodotto: palette e font del design system del prodotto, nato col nome di lavoro Controesame (Plus Jakarta Sans, fondo `#F8FAFC`, primario `#2563EB`, un solo richiamo arancione `#EA580C` per l'agente che lavora, rosso e verde per gli esiti). Il suono è discreto e sintetizzato dagli script del repository.

**Le schermate.** Disegnate in Remotion con i token del design system, schematiche: niente finestre del browser, niente barre di sistema, niente che sembri una cattura. Quando arrivano le catture vere si sostituiscono scena per scena. L'esempio (la domanda su Q-learning e SARSA, le risposte, la riscrittura) è illustrativo e lo dice a schermo.

**Onestà.** Nessun numero inventato. Nessuna promessa di esami «a prova di AI», «equi» o «che non si copiano»: il prodotto porta un controesempio verificabile, oppure dice che non ne trova. Non rileva chi copia. Le funzionalità non ancora costruite hanno l'etichetta *in arrivo*, comandata da un indicatore per funzionalità in `copy.ts`. Nessun ateneo, nessun docente o studente reale.

**Il nome.** Nome, frase di lancio e promessa stanno solo in `src/brands/prisma/brand.ts`.

| Proposta | Frase di lancio |
|---|---|
| **Prisma** (scelto da Luca) | Ogni domanda d'esame, guardata da tre lati prima dell'appello. |
| Controesame (nome di lavoro) | La domanda d'esame, messa alla prova prima dell'appello. |
| Crashtest | La domanda va a sbattere qui, non in aula. |

Prisma: si dice uguale in italiano e in inglese, si ricorda al primo ascolto, e porta con sé l'immagine del prodotto: una domanda entra, tre letture escono. Quell'immagine guida il triplo attacco e la chiusura. Seconda riga di chiusura: «Porta la prova. Decide il docente.»

## Le scene

| # | Scena | Durata | Cosa si vede | Testo a schermo | Suono |
|---|---|---|---|---|---|
| 1 | Il docente | 7,0 s | Si apre al buio: fondo scuro, a destra il foglio d'esame che si scrive da solo, poco leggibile. Sulla seconda riga si accende la luce, troppo tardi: la domanda sul foglio si sdoppia in due frecce rosse (*lettura A*, *lettura B*); poi una bolla «modello generico» risponde da sola e sul foglio cade il timbro rosso *risolta senza il corso*; infine due barre di difficoltà, un appello altissimo e quello dopo bassissimo, senza numeri | IL DOCENTE · «Scrive l'esame al buio.» · «Scopre solo dopo l'appello che una domanda era ambigua,» · «o che la risolveva un modello generico.» · «Un appello impossibile, quello dopo facilissimo.» | Letto grave e sommesso; un tick a ogni riga, un colpo sordo sul timbro |
| 2 | Lo studente | 6,2 s | Quattro schede in griglia 2×2, una alla volta, ognuna con la sua icona. Dietro, punti grigi sparsi e scollegati: gli argomenti che nessuno collega | LO STUDENTE · «Perde punti su una domanda che si leggeva in due modi.» · «L'esame premia chi genera, non chi ha capito.» · «Fuori corso, non sa cosa si è fatto a lezione.» · «Nessuno gli mostra come si collegano gli argomenti.» | Un tick per scheda; il letto si apre in maggiore sull'ultima |
| 3 | Il grafo | 5,5 s | I punti grigi della scena prima si colorano per argomento e si collegano: il grafo del corso (Reinforcement Learning) cresce dalle fonti caricate, *Slide* e *Dispense*. Si accende «Q-learning»: richiede *Equazioni di Bellman*, si distingue da *SARSA*, e cita il passaggio **L08 · slide 31** | PRISMA · «Il docente carica il corso. Ne nasce il grafo dei concetti.» | Un blip morbido per ogni nodo, un tick sulla citazione |
| 4 | Il triplo attacco | 8,0 s | In alto la domanda del docente, *v1*. Un raggio bianco parte dalla domanda, entra in un prisma e ne escono tre raggi colorati, uno per colonna: tre colonne che partono insieme, ognuna con in mano una cosa diversa: **Esterno** (solo la domanda: il modello generico che lo studente ha in tasca), **Letterale** (solo il corso), **Cavillatore** (cerca due letture). Una striscia arancione segna chi lavora; le risposte scorrono, poi ognuno posa la sua prova | «Tre agenti attaccano la domanda, in parallelo. Ognuno sa cose diverse.» · domanda: «Q-learning e SARSA: quale dei due converge alla policy ottima?» · esiti: *Risolta senza il corso* · *Si ricava dal corso, L08 · slide 31* · *Due letture difendibili: ottima con o senza esplorazione* · *Esempio illustrativo* | Tre impulsi sfasati alla partenza, un tick per ogni prova, un colpo leggero sugli esiti rossi |
| 5 | Decide il docente | 6,5 s | A sinistra la scheda con le tre prove. A destra la riscrittura proposta; il cursore del docente la modifica (aggiunge *sull'esempio della lezione 8*) e preme **Approva e riattacca**. *v1 → v2*: i tre ripartono e posano esiti nuovi, anche «nessuna seconda lettura trovata» | «Porta la prova. Decide il docente.» · «Poi si riattacca.» · esiti v2: *Senza il corso non prende i punti* · *Si ricava dal corso* · *Nessuna seconda lettura trovata* · *Esempio illustrativo* | Tasti morbidi, il clic sul pulsante, un fruscio sul riattacco, tre tick |
| 6 | Lo studente legge il grafo | 4,5 s | Lo stesso grafo in sola lettura: pieni i concetti fatti a lezione, vuoti quelli solo nelle dispense. Lo studente scrive «Ho 4 settimane» e sul grafo si accende un percorso numerato che rispetta i prerequisiti | LO STUDENTE · «Vede cosa si è fatto a lezione e come si collega.» · *in arrivo* su lato studente e piano di studio | Quattro note che salgono lungo il percorso |
| 7 | E intorno | 4,5 s | Quattro riquadri: la classe simulata (griglia studenti × domande che si colora), la lezione registrata (onda sonora che diventa un nodo), gli argomenti fatti a lezione (caselle da spuntare, la domanda la scrive il docente), la coerenza fra gli appelli (due livelli che si allineano) | E INTORNO · Classe simulata · Lezione registrata · Argomenti fatti a lezione · Coerenza fra appelli · *in arrivo* su ognuno | Un tick per riquadro |
| 8 | Chiusura | 4,0 s | Il grafo resta in filigrana; un raggio entra nel prisma e ne escono tre raggi, il segno del nome; il nome si compone accanto, la frase sotto | **Prisma** · «Ogni domanda d'esame, guardata da tre lati prima dell'appello.» · «Porta la prova. Decide il docente.» | La campana morbida del logo, poi silenzio |

Transizioni: dissolvenze di 12 fotogrammi fra le scene; fra la 2 e la 3 i punti grigi diventano il grafo.

## Le rime

I punti grigi scollegati dello studente (scena 2) sono gli stessi nodi del grafo (scena 3), che torna in sola lettura per lo studente (scena 6) e in filigrana sotto il nome (scena 8). Il prisma che apre il triplo attacco (scena 4) è il segno del nome (scena 8). La domanda che nella scena 1 si sdoppia in due letture è quella che il Cavillatore prende in fallo nella scena 4.

## Cosa è *in arrivo*

Classe simulata, lezione registrata, argomenti fatti a lezione, lato studente, piano di studio, coerenza fra appelli. Ognuno ha il suo indicatore in `copy.ts` (`inArrivo`): messo a `false`, l'etichetta sparisce dal video.
