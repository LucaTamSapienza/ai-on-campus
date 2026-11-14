import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

// Blocco 2 in un browser vero: classe simulata, lezioni (con il microfono finto di Chromium) e
// ruolo studente. Controlla che ogni passo arrivi a schermo, non il testo dei modelli.
// Le chiamate ai modelli sono vere: una corsa completa, alle due misure, costa meno di un centesimo.
// Le misure sono i progetti di playwright.config.ts (desktop 1440×900, telefono 390×844).
//
//   DEMO_URL=http://localhost:8789 npm run e2e -- e2e/blocco2.spec.ts            export servito dal Worker
//   DEMO_URL=http://localhost:3002 API_URL=http://localhost:8789 npm run e2e -- e2e/blocco2.spec.ts --project=desktop
//
// API_URL serve solo se il frontend gira su next dev, su un'altra porta del Worker.

const DEMO_URL = process.env.DEMO_URL ?? "http://localhost:3000";
const API_URL = process.env.API_URL ?? process.env.DEMO_URL ?? "http://localhost:8787";
const AUDIO = path.join(__dirname, "fixtures", "lezione-breve.wav");

test.use({
  permissions: ["microphone"],
  launchOptions: {
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-audio-capture=${AUDIO}`],
  },
});

// Errori in console e scorrimento orizzontale, controllati alla fine di ogni prova.
function watch(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement.scrollWidth - window.innerWidth;
    const col = document.querySelector("main .overflow-y-auto");
    return Math.max(doc, col ? col.scrollWidth - col.clientWidth : 0);
  });
  expect(overflow, "scorrimento orizzontale").toBeLessThanOrEqual(0);
}

const visible = (page: Page, role: "button" | "link", name: string | RegExp) => page.getByRole(role, { name }).filter({ visible: true });

test.describe("blocco 2", () => {
  test("Classe: domanda, otto studenti dal vivo, voti, riepilogo, dettaglio", async ({ page }) => {
    test.setTimeout(180_000);
    const errors = watch(page);
    await page.goto("/classe");
    await expect(page.getByRole("heading", { name: "Classe simulata" })).toBeVisible();
    await expect(page.getByText("non è una previsione dei voti veri")).toBeVisible();

    // Scelta della domanda.
    await page.getByRole("button", { name: /Domanda 3/ }).click();
    await expect(page).toHaveURL(/\/classe\?q=/);
    await expect(page.getByRole("button", { name: /Domanda 3/ })).toHaveAttribute("aria-pressed", "true");

    // Esecuzione dal vivo.
    await page.getByRole("button", { name: /Fai rispondere/ }).click();
    await expect(page.getByRole("button", { name: "La classe sta rispondendo" })).toBeDisabled();
    await expect(page.getByText(/^(Sta scrivendo|In correzione)$/).first()).toBeVisible({ timeout: 30_000 });

    // Otto voti, poi il riepilogo.
    await expect(page.getByText("Corretto", { exact: true })).toHaveCount(8, { timeout: 120_000 });
    await expect(page.getByRole("button", { name: "Fai rispondere di nuovo" })).toBeEnabled();
    await expect(page.getByRole("heading", { name: "Distribuzione dei voti" })).toBeVisible();
    await expect(page.getByText("8 di 8 corretti")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Cosa spiega i punti persi" })).toBeVisible();

    // Dettaglio di uno studente.
    await page.getByRole("button", { name: /Aurora Venti/ }).click();
    const detail = page.getByRole("region", { name: /Risposta di Aurora Venti/ });
    await expect(detail).toBeVisible();
    await expect(detail.getByText("Cosa aveva in mano")).toBeVisible();
    await expect(detail.getByRole("button", { name: /Voto del Correttore/ })).toBeVisible();

    await noHorizontalScroll(page);
    expect(errors, "errori in console").toEqual([]);
  });

  test("Lezioni: lezione svolta, proposte con prove, registrazione fino alla trascrizione", async ({ page }) => {
    test.setTimeout(120_000);
    const errors = watch(page);
    await page.goto("/lezioni");
    await expect(page.getByRole("heading", { name: "Lezioni", exact: true })).toBeVisible();

    // Segna una lezione svolta e torna com'era.
    const lessons = page.getByRole("region", { name: "Lezioni svolte" });
    const lesson = lessons.getByRole("button", { name: /^L01/ });
    const before = await lesson.getAttribute("aria-pressed");
    await lesson.click();
    await expect(lesson).toHaveAttribute("aria-pressed", before === "true" ? "false" : "true");
    await page.reload();
    await expect(lesson).toHaveAttribute("aria-pressed", before === "true" ? "false" : "true");
    await lesson.click();
    await expect(lesson).toHaveAttribute("aria-pressed", before ?? "false");

    // Proposte con le prove (citazioni «L08 · slide 31»).
    const proposals = page.getByRole("region", { name: "Argomenti proposti" });
    await expect(proposals.getByRole("heading", { name: "Su cosa fare domande" })).toBeVisible();
    await expect(proposals.getByRole("listitem").first()).toBeVisible();
    await expect(proposals.getByRole("button", { name: /· slide \d+/ }).first()).toBeVisible();

    // Registrazione con il microfono finto, fino alla trascrizione; poi si scarta.
    await page.getByRole("button", { name: "Registra", exact: true }).click();
    await expect(page.getByText(/\d:\d\d \/ 3:00/)).toBeVisible();
    await page.waitForTimeout(8_000);
    await page.getByRole("button", { name: /Ferma e trascrivi/ }).click();
    await expect(page.getByText("Trascrive la registrazione…")).toBeVisible();
    await expect(page.getByRole("button", { name: "Manda al Cartografo" })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(/secondi trascritti/)).toBeVisible();
    await page.getByRole("button", { name: "Scarta" }).click();
    await expect(page.getByRole("button", { name: "Registra", exact: true })).toBeVisible();

    await noHorizontalScroll(page);
    expect(errors, "errori in console").toEqual([]);
  });

  test("Studente: voci del docente sparite, materiali in sola lettura, 403 dal server", async ({ page, request }) => {
    const errors = watch(page);
    await page.goto("/classe");
    await expect(page.getByRole("heading", { name: "Classe simulata" })).toBeVisible();
    await visible(page, "button", /^studente$/i).click();

    // Da una pagina del docente si torna al grafo; restano solo Grafo e Materiali.
    await expect(page).toHaveURL(new URL("/", DEMO_URL).href);
    await expect(visible(page, "link", "Grafo")).toBeVisible();
    await expect(visible(page, "link", "Materiali")).toBeVisible();
    for (const name of ["Esame", "Classe", "Lezioni"]) await expect(visible(page, "link", name)).toHaveCount(0);

    await visible(page, "link", "Materiali").click();
    await expect(page.getByRole("heading", { name: /^Fonti/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Carica/ })).toHaveCount(0);
    await noHorizontalScroll(page);
    expect(errors, "errori in console").toEqual([]);

    // Il server: con ruolo studente scritture ed esame rispondono 403, il grafo si legge.
    const student = { "x-role": "studente" };
    const courseId = (await (await request.get(`${API_URL}/api/courses`)).json()).courses[0].id as string;
    const examId = (await (await request.get(`${API_URL}/api/courses/${courseId}/exams`)).json()).exams[0].id as string;
    const questionId = (await (await request.get(`${API_URL}/api/exams/${examId}`)).json()).questions[0].id as string;
    const sourceId = (await (await request.get(`${API_URL}/api/courses/${courseId}/lessons`)).json()).lessons[0].id as string;

    expect((await request.get(`${API_URL}/api/courses/${courseId}/graph`, { headers: student })).status()).toBe(200);
    expect((await request.get(`${API_URL}/api/courses/${courseId}/sources`, { headers: student })).status()).toBe(200);
    for (const [method, url, data] of [
      ["get", `/api/courses/${courseId}/exams`, undefined],
      ["get", `/api/exams/${examId}`, undefined],
      ["get", `/api/questions/${questionId}/class`, undefined],
      ["get", `/api/courses/${courseId}/students`, undefined],
      ["get", `/api/courses/${courseId}/proposals`, undefined],
      ["post", `/api/questions/${questionId}/attack`, {}],
      ["post", `/api/questions/${questionId}/class`, {}],
      ["post", `/api/courses/${courseId}/sources`, { title: "x", text: "testo" }],
      ["put", `/api/sources/${sourceId}/done`, { done: true }],
      ["post", `/api/courses/${courseId}/lessons/transcribe`, { audio: "x", format: "wav" }],
    ] as const) {
      const res = await request[method](`${API_URL}${url}`, { headers: student, data });
      expect(res.status(), `${method.toUpperCase()} ${url}`).toBe(403);
    }
  });
});
