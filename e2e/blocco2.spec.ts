import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { authHeaders, signIn, switchRole } from "./auth";

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
  // Ogni prova parte dall'accesso di demo come docente.
  test.beforeEach(async ({ page }) => {
    await signIn(page, "teacher");
  });

  test("Classe: domanda, otto studenti dal vivo, voti, riepilogo, dettaglio", async ({ page }) => {
    test.setTimeout(180_000);
    const errors = watch(page);
    await page.goto("/class");
    await expect(page.getByRole("heading", { name: "Simulated class" })).toBeVisible();
    await expect(page.getByText("not a prediction of real grades")).toBeVisible();

    // Scelta della domanda.
    await page.getByRole("button", { name: /Question 3/ }).click();
    await expect(page).toHaveURL(/\/class\?q=/);
    await expect(page.getByRole("button", { name: /Question 3/ })).toHaveAttribute("aria-pressed", "true");

    // Esecuzione dal vivo.
    await page.getByRole("button", { name: /Run the class/ }).click();
    await expect(page.getByRole("button", { name: "The class is answering" })).toBeDisabled();
    await expect(page.getByText(/^(Writing|Being graded)$/).first()).toBeVisible({ timeout: 30_000 });

    // Otto voti, poi il riepilogo.
    await expect(page.getByText("Graded", { exact: true })).toHaveCount(8, { timeout: 120_000 });
    await expect(page.getByRole("button", { name: "Run the class again" })).toBeEnabled();
    await expect(page.getByRole("heading", { name: "Score distribution" })).toBeVisible();
    await expect(page.getByText("8 of 8 graded")).toBeVisible();
    await expect(page.getByRole("heading", { name: "What explains the lost points" })).toBeVisible();

    // Dettaglio di uno studente.
    await page.getByRole("button", { name: /Aurora Venti/ }).click();
    const detail = page.getByRole("region", { name: /Answer by Aurora Venti/ });
    await expect(detail).toBeVisible();
    await expect(detail.getByText("What they had")).toBeVisible();
    await expect(detail.getByRole("button", { name: /Grader's score/ })).toBeVisible();

    await noHorizontalScroll(page);
    expect(errors, "errori in console").toEqual([]);
  });

  test("Lezioni: lezione svolta, proposte con prove, registrazione fino alla trascrizione", async ({ page }) => {
    test.setTimeout(120_000);
    const errors = watch(page);
    await page.goto("/lessons");
    await expect(page.getByRole("heading", { name: "Lessons", exact: true })).toBeVisible();

    // Segna L01 svolta (anche su D1 appena seminato, dove nessuna lezione lo è), controlla che
    // resti dopo il ricaricamento e le proposte che ne nascono, poi torna com'era.
    const lessons = page.getByRole("region", { name: "Lessons taught" });
    const lesson = lessons.getByRole("button", { name: /^L01/ });
    const before = (await lesson.getAttribute("aria-pressed")) ?? "false";
    const toggle = async (want: string) => {
      await lesson.click();
      await expect(lesson).toHaveAttribute("aria-pressed", want);
    };
    if (before === "true") {
      await toggle("false");
      await page.reload();
      await expect(lesson).toHaveAttribute("aria-pressed", "false");
      await toggle("true");
    } else {
      await toggle("true");
      await page.reload();
      await expect(lesson).toHaveAttribute("aria-pressed", "true");
    }

    // Proposte con le prove (citazioni «L08 · slide 31»).
    const proposals = page.getByRole("region", { name: "Suggested topics" });
    await expect(proposals.getByRole("heading", { name: "What to ask about" })).toBeVisible();
    await expect(proposals.getByRole("listitem").first()).toBeVisible();
    await expect(proposals.getByRole("button", { name: /· slide \d+/ }).first()).toBeVisible();
    if (before === "false") await toggle("false");

    // Registrazione con il microfono finto, fino alla trascrizione; poi si scarta.
    await page.getByRole("button", { name: "Record", exact: true }).click();
    await expect(page.getByText(/\d:\d\d \/ 3:00/)).toBeVisible();
    await page.waitForTimeout(8_000);
    await page.getByRole("button", { name: /Stop and transcribe/ }).click();
    await expect(page.getByText("Transcribing the recording…")).toBeVisible();
    await expect(page.getByRole("button", { name: "Send to the Cartographer" })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(/seconds transcribed/)).toBeVisible();
    await page.getByRole("button", { name: "Discard" }).click();
    await expect(page.getByRole("button", { name: "Record", exact: true })).toBeVisible();

    await noHorizontalScroll(page);
    expect(errors, "errori in console").toEqual([]);
  });

  test("Studente: voci del docente sparite, materiali in sola lettura, 403 dal server", async ({ page, request }) => {
    const errors = watch(page);
    await page.goto("/class");
    await expect(page.getByRole("heading", { name: "Simulated class" })).toBeVisible();
    // Cambio di ruolo: si esce e si rientra come studente.
    await switchRole(page, "student");
    // Una pagina del docente porta al grafo; restano solo Grafo e Materiali.
    await page.goto("/class");
    await expect(page).toHaveURL(new URL("/", DEMO_URL).href);
    await expect(visible(page, "link", "Graph")).toBeVisible();
    await expect(visible(page, "link", "Materials")).toBeVisible();
    for (const name of ["Exam", "Class", "Lessons"]) await expect(visible(page, "link", new RegExp(`^${name}$`))).toHaveCount(0);

    await visible(page, "link", "Materials").click();
    await expect(page.getByRole("heading", { name: /^Sources/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Upload/ })).toHaveCount(0);
    await noHorizontalScroll(page);
    expect(errors, "errori in console").toEqual([]);

    // Il server: con il token dello studente scritture ed esame rispondono 403, il grafo si legge;
    // senza token tutto risponde 401 e la vecchia intestazione x-role non vale più.
    const teacher = await authHeaders(request, API_URL, "teacher");
    const student = await authHeaders(request, API_URL, "student");
    const courseId = (await (await request.get(`${API_URL}/api/courses`, { headers: teacher })).json()).courses[0].id as string;
    const examId = (await (await request.get(`${API_URL}/api/courses/${courseId}/exams`, { headers: teacher })).json()).exams[0].id as string;
    const questionId = (await (await request.get(`${API_URL}/api/exams/${examId}`, { headers: teacher })).json()).questions[0].id as string;
    const sourceId = (await (await request.get(`${API_URL}/api/courses/${courseId}/lessons`, { headers: teacher })).json()).lessons[0].id as string;

    expect((await request.get(`${API_URL}/api/courses/${courseId}/graph`)).status(), "senza token").toBe(401);
    expect((await request.get(`${API_URL}/api/courses/${courseId}/graph`, { headers: { "x-role": "docente" } })).status(), "x-role").toBe(401);

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
