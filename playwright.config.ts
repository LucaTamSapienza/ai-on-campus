import { defineConfig } from "@playwright/test";

// Il percorso della demo, in un browser vero.
// In locale: npm run e2e (l'app deve già girare su localhost:3000).
// Online:    DEMO_URL=https://ai-on-campus.<sottodominio>.workers.dev npm run e2e
export default defineConfig({
  testDir: "e2e",
  timeout: 120_000, // gli agenti rispondono in decine di secondi
  retries: 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.DEMO_URL ?? "http://localhost:3000",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
});
