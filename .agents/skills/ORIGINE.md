Le sette skill di questa cartella (`ui-ux-pro-max`, `design`, `design-system`, `ui-styling`, `brand`, `slides`, `banner-design`) sono copiate da `.claude/skills/` di https://github.com/nextlevelbuilder/ui-ux-pro-max-skill, commit `6ae86f61f520d6ca229d2f40e070410638c908c5` (14/11/2026), licenza MIT in `LICENSE-ui-ux-pro-max`.

Differenze dall'originale: tolte le cartelle `tests/`; in `ui-ux-pro-max/SKILL.md` il percorso dello script non usa più `${CLAUDE_PLUGIN_ROOT}` ma `.agents/skills/ui-ux-pro-max/scripts/search.py`, relativo alla radice del repository.

Gli script di `ui-ux-pro-max` lavorano solo su file locali. Quelli di `design` che generano loghi e mockup (`scripts/logo/`, `scripts/cip/`) chiamano servizi esterni di generazione immagini e vogliono chiavi proprie (`GEMINI_API_KEY` e simili), che qui non ci sono: non usano il credito OpenRouter.
