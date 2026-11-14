import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// Blocco 3, piano di studio: lo studente sceglie giorni e cosa conosce, il backend ordina dal
// grafo, il Pianificatore spiega ogni sessione con le slide di prova. Chiamate ai modelli vere:
// una corsa alle due misure costa meno di un centesimo. In fondo il piano a pagina intera e il
// download del PDF.
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

    // Il docente non ha la voce Study; lo studente sì, accanto a Graph e Materials.
    await page.goto("/");
    await expect(visible(page, "link", "Graph")).toBeVisible();
    await expect(visible(page, "link", /^Study$/)).toHaveCount(0);
    await visible(page, "button", /^student$/i).click();
    for (const name of ["Exam", "Class", "Lessons"]) await expect(visible(page, "link", new RegExp(`^${name}$`))).toHaveCount(0);
    await visible(page, "link", /^Study$/).click();
    await expect(page).toHaveURL(new URL("/study", DEMO_URL).href);
    await expect(page.getByRole("heading", { name: "Study plan" })).toBeVisible();
    // Il confine è dichiarato a schermo.
    await expect(page.getByText("does not write exam answers")).toBeVisible();
    await shot("1-scelte");

    // Cosa conosce già: una lezione e un concetto. Giorni: da 7 a 4.
    await page.getByRole("button", { name: /^L00,/ }).click();
    await expect(page.getByRole("button", { name: /^L00,/ })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("searchbox", { name: "Search a concept" }).fill("Policy");
    await page.getByRole("list", { name: "Concepts found" }).getByRole("button").first().click();
    await expect(page.getByLabel("Concepts marked").getByRole("button")).toHaveCount(1);
    for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "One day less" }).click();
    await expect(page.getByRole("spinbutton", { name: "Days until the exam" })).toHaveValue("4");
    await noHorizontalScroll(page);

    await page.getByRole("button", { name: "Build the plan" }).click();
    await expect(page).toHaveURL(/\/study\?p=/);
    await expect(page.getByText("Order from the graph")).toBeVisible();
    const sessions = page.getByRole("list", { name: "Study sessions" }).locator(":scope > li");
    await expect(sessions).toHaveCount(4);
    await shot("2-pianificatore");

    // Il Pianificatore finisce: ogni sessione ha la spiegazione e almeno una slide da guardare.
    await expect(page.getByText("Sessions explained")).toBeVisible({ timeout: 150_000 });
    await expect(page.getByText("The Planner did not write this session")).toHaveCount(0);
    await expect(page.getByText("What to review")).toHaveCount(4);
    const ref = page.getByRole("button", { name: /^L\d+ · slide \d+/ }).first();
    await ref.click();
    await expect(ref).toHaveAttribute("aria-expanded", "true");
    await page.getByRole("button", { name: "Order in the graph" }).first().click();
    await expect(page.getByText(/^after |no prerequisite/).first()).toBeVisible();
    await noHorizontalScroll(page);
    await shot("3-piano");

    // Il piano a pagina intera, fuori dalla navigazione, e il PDF scaricato davvero.
    await visible(page, "link", "Open full plan").click();
    await expect(page).toHaveURL(/\/study\/plan\?p=/);
    const doc = page.locator("[data-plan-document]");
    await expect(doc.getByRole("heading", { name: "Study plan", level: 1 })).toBeVisible();
    await expect(doc.getByRole("img", { name: "Reply" })).toBeVisible();
    await expect(doc.getByRole("list", { name: "Study sessions" }).locator(":scope > li")).toHaveCount(4);
    await expect(doc.getByText("Slides to look at")).toHaveCount(4);
    await expect(doc.getByText("The Planner never sees exam questions, rubrics or class results.")).toBeVisible();
    const docOverflow = await doc.evaluate((el) => Math.max(el.scrollWidth - el.clientWidth, document.documentElement.scrollWidth - window.innerWidth));
    expect(docOverflow, "scorrimento orizzontale del documento").toBeLessThanOrEqual(0);
    await shot("4-documento");
    const [download] = await Promise.all([page.waitForEvent("download", { timeout: 60_000 }), doc.getByRole("button", { name: "Download PDF" }).click()]);
    expect(download.suggestedFilename()).toMatch(/^prisma-study-plan-.+\.pdf$/);
    const pdf = readFileSync(await download.path());
    expect(pdf.subarray(0, 5).toString(), "intestazione PDF").toBe("%PDF-");
    expect(pdf.length, "dimensione del PDF").toBeGreaterThan(20_000);
    await download.saveAs(`${SHOTS}/blocco3-${testInfo.project.name}-piano.pdf`);
    expect(errors, "errori in console").toEqual([]);

    // Lato server lo studente apre solo il piano di studio: l'esame resta chiuso.
    const courseId = (await (await request.get(`${API_URL}/api/courses`)).json()).courses[0].id as string;
    const exams = await request.get(`${API_URL}/api/courses/${courseId}/exams`, { headers: { "x-role": "studente" } });
    expect(exams.status()).toBe(403);
  });
});
