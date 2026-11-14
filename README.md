# ai-on-campus

Hackathon del 14/11/2026, tema «AI on Campus». Un'idea B2B per le università, costruita da Luca Tam con agenti AI.

## Stato

- **Fase:** input, prima della fase 00. Lo workspace è pronto. In `input/` c'è solo lo sponsor (Reply): mancano regolamento, criteri e tracce.
- **Idea:** non scelta.
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
