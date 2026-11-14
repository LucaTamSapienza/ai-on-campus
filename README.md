# ai-on-campus

Hackathon del 14/11/2026, tema «AI on Campus». Un'idea B2B per le università, costruita da Luca Tam con agenti AI.

## Stato

- **Fase:** 02, scheletro, ontologia e grafo. Piano in `docs/fase-01-piano.md`, design system in `docs/design-system.md`.
- **Idea:** Controesame. Il docente carica il corso e ne esce il grafo dei concetti; scrive una domanda d'esame e tre agenti la attaccano (si supera senza il corso, non si ricava dal materiale, ammette due letture) portando la prova; il docente riscrive e si riattacca. Poi classe simulata, lezione registrata, lato studente in lettura.
- **Corso della demo:** Reinforcement Learning, materiale vero in `materiale-locale/`, fuori da Git.
- **Alle 15:00** gli esperti passano in aula: 60 secondi di pitch senza slide, in italiano o in inglese. Non è chiaro se sia già la prima valutazione: da chiedere.
- **Criteri:** creatività e innovazione 40%, impatto 20%, tecnica 20%, presentazione 20%. Fuori tema amministrazione e logistica.
- **Inizio:** verso le 11:15, orario approssimativo detto da Luca. **Consegna:** non ancora nota; con 7 ore di durata cadrebbe verso le 18:15. Gli orari sotto si correggono appena arrivano quelli ufficiali.
- **Cloudflare:** solo l'account personale di Luca (`account_id` in `AGENTS.md`), risorse con prefisso `aoc-`.

| Orario | Cosa | Si chiude quando |
|---|---|---|
| 11:15 – 11:55 | Input e brainstorming | Luca ha scelto l'idea |
| 11:55 – 12:15 | Proposta visiva | Luca l'ha approvata |
| 12:15 – 12:35 | Piano dettagliato e design system | il piano è su `main` |
| 12:35 – 13:05 | Scheletro e filo verticale | frontend, backend e un agente del prodotto si parlano in locale |
| 13:05 – 16:15 | Build dei moduli | tutto su `main`, il percorso della demo gira per intero |
| 16:15 | Stop alle funzioni nuove | da qui solo correzioni |
| 16:15 – 17:15 | Rifinitura e registrazione di riserva | |
| 17:15 – 18:15 | Pitch | |

## Come si lavora qui

Le regole per gli agenti sono in `AGENTS.md`. In breve: fonti in `input/`, brainstorming in `docs/fase-00-brainstorming.md`, piano in `docs/fase-01-piano.md`, poi le fasi di build e il pitch. Stack: Next.js e Hono su Cloudflare Workers, D1, agenti su Durable Objects.
