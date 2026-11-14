import { defineConfig, devices } from "@playwright/test";

// Il percorso della demo, in un browser vero, su desktop e su telefono.
// Si lancia solo quando lo chiede Luca.
// In locale: npm run e2e (l'app deve già girare su localhost:3000).
// Online:    DEMO_URL=https://ai-on-campus.<sottodominio>.workers.dev npm run e2e
// Un progetto solo: npm run e2e -- --project=desktop
// Le chiamate ai modelli sono vere e il percorso scrive nel D1: fra due corse si risemina.
export default defineConfig({
  testDir: "e2e",
  timeout: 600_000, // caricamento dal vivo e due attacchi con modelli veri
  expect: { timeout: 15_000 },
  retries: 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.DEMO_URL ?? "http://localhost:3000",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    {
      name: "telefono",
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
    },
  ],
});
