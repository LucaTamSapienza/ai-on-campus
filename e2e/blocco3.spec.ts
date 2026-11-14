import { expect, test, type Page } from "@playwright/test";

// Blocco 3, piano di studio: lo studente sceglie giorni e cosa conosce, il backend ordina dal
// grafo, il Pianificatore spiega ogni sessione con le slide di prova. Chiamate ai modelli vere:
// una corsa alle due misure costa meno di un centesimo.
// Le misure sono i progetti di playwright.config.ts (desktop 1440×900, telefono 390×844).
//
//   DEMO_URL=http://localhost:8790 npm run e2e -- e2e/blocco3.spec.ts            export servito dal Worker
//   DEMO_URL=http://localhost:3003 API_URL=http://localhost:8790 npm run e2e -- e2e/blocco3.spec.ts --project=desktop
//
// API_URL serve solo se il frontend gira su next dev, su un'altra porta del Worker.

const DEMO_URL = process.env.DEMO_URL ?? "http://localhost:3000";
const API_URL = process.env.API_URL ?? process.env.DEMO_URL ?? "http://localhost:8787";
const SHOTS = process.env.E2E_SHOTS ?? "test-results/e2e-shots";

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement.scrollWidth - window.innerWidth;
    const col = document.querySelector("main .overflow-y-auto");
    return Math.max(doc, col ? col.scrollWidth - col.clientWidth : 0);
  });
  expect(overflow, "scorrimento orizzontale").toBeLessThanOrEqual(0);
}

const visible = (page: Page, role: "button" | "link", name: string | RegExp) => page.getByRole(role, { name }).filter({ visible: true });

test.describe("blocco 3", () => {
  test("Studio: lo studente prepara il piano e il Pianificatore lo spiega con le slide", async ({ page, request }, testInfo) => {
    test.setTimeout(180_000);
    const shot = (name: string) => page.screenshot({ path: `${SHOTS}/blocco3-${testInfo.project.name}-${name}.png` });
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(e.message));

    // Il docente non ha la voce Studio; lo studente sì, accanto a Grafo e Materiali.
    await page.goto("/");
    await expect(visible(page, "link", "Grafo")).toBeVisible();
    await expect(visible(page, "link", "Studio")).toHaveCount(0);
    await visible(page, "button", /^studente$/i).click();
    for (const name of ["Esame", "Classe", "Lezioni"]) await expect(visible(page, "link", name)).toHaveCount(0);
    await visible(page, "link", "Studio").click();
    await expect(page).toHaveURL(new URL("/studio", DEMO_URL).href);
    await expect(page.getByRole("heading", { name: "Piano di studio" })).toBeVisible();
    // Il confine è dichiarato a schermo.
    await expect(page.getByText("non scrive risposte d'esame")).toBeVisible();
    await shot("1-scelte");

    // Cosa conosce già: una lezione e un concetto. Giorni: da 7 a 4.
    await page.getByRole("button", { name: /^L00,/ }).click();
    await expect(page.getByRole("button", { name: /^L00,/ })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("searchbox", { name: "Cerca un concetto" }).fill("Policy");
    await page.getByRole("list", { name: "Concetti trovati" }).getByRole("button").first().click();
    await expect(page.getByLabel("Concetti segnati").getByRole("button")).toHaveCount(1);
    for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Un giorno in meno" }).click();
    await expect(page.getByLabel("Giorni all'appello")).toHaveValue("4");
    await noHorizontalScroll(page);

    await page.getByRole("button", { name: "Prepara il piano" }).click();
    await expect(page).toHaveURL(/\/studio\?p=/);
    await expect(page.getByText("Ordine dal grafo")).toBeVisible();
    const sessions = page.getByRole("list", { name: "Sessioni di studio" }).locator(":scope > li");
    await expect(sessions).toHaveCount(4);
    await shot("2-pianificatore");

    // Il Pianificatore finisce: ogni sessione ha la spiegazione e almeno una slide da guardare.
    await expect(page.getByText("Sessioni spiegate")).toBeVisible({ timeout: 150_000 });
    await expect(page.getByText("Il Pianificatore non ha scritto questa sessione")).toHaveCount(0);
    await expect(page.getByText("Cosa guardare")).toHaveCount(4);
    const ref = page.getByRole("button", { name: /^L\d+ · slide \d+/ }).first();
    await ref.click();
    await expect(ref).toHaveAttribute("aria-expanded", "true");
    await page.getByRole("button", { name: "L'ordine nel grafo" }).first().click();
    await expect(page.getByText(/^dopo |nessun prerequisito/).first()).toBeVisible();
    await noHorizontalScroll(page);
    await shot("3-piano");
    expect(errors, "errori in console").toEqual([]);

    // Lato server lo studente apre solo il piano di studio: l'esame resta chiuso.
    const courseId = (await (await request.get(`${API_URL}/api/courses`)).json()).courses[0].id as string;
    const exams = await request.get(`${API_URL}/api/courses/${courseId}/exams`, { headers: { "x-role": "studente" } });
    expect(exams.status()).toBe(403);
  });
});
