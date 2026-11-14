// Segreti facoltativi, non dichiarati in wrangler.jsonc.
// SESSION_SECRET firma i token di sessione: in locale da .dev.vars (se manca vale un segreto di
// sviluppo dichiarato in src/auth.ts), online con `wrangler secret put SESSION_SECRET`.
interface Env {
  DEMO_CODE?: string;
  SESSION_SECRET?: string;
}
