// Il percorso della demo, blocco 1: grafo, dettaglio, filtri, caricamento dal vivo, triplo attacco,
// decisione e riattacco, domanda nuova, rifiuto senza griglia, ruolo studente.
// Controlla che ogni passo arrivi a schermo, non il testo dei modelli. Su ogni schermata misura:
// scorrimento orizzontale, errori in console, bersagli sotto i 44 px, elementi tagliati o sovrapposti.
// Le chiamate ai modelli sono vere e il percorso scrive nel D1: fra due corse si risemina
// (seed.mjs --ontologia e seed-esame.mjs).
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SHOTS = process.env.E2E_SHOTS ?? "test-results/e2e-shots";
const API = process.env.DEMO_URL ?? process.env.API_URL ?? "http://localhost:8787";
const LIVE_FILE = process.env.LIVE_FILE ?? "materiale-locale/dal-vivo/Lab06-session-slides.md";
const TOPIC_COUNT_BEFORE = 179;

type Audit = {
  step: string;
  overflowX: boolean;
  consoleErrors: string[];
  smallTargets: string[];
  cutOff: string[];
  overlaps: string[];
  ellipsis: string[]; // solo informazione: testo accorciato con i puntini
};

// Misure su ciò che è a schermo in questo momento (gli elementi coperti da un foglio non contano).
async function measure(page: Page) {
  return page.evaluate(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const label = (el: Element) =>
      `${el.tagName.toLowerCase()} «${(el.getAttribute("aria-label") || (el as HTMLElement).innerText || el.getAttribute("placeholder") || "").trim().slice(0, 40)}»`;
    // Dentro una fila che scorre in orizzontale per scelta (i chip su desktop) un elemento fuori
    // vista non è tagliato. Un contenitore che scorre in verticale (un foglio) non conta.
    const inScrollerX = (el: Element) => {
      for (let p = el.parentElement; p; p = p.parentElement) {
        const ox = getComputedStyle(p).overflowX;
        const horizontal = p.scrollWidth > p.clientWidth && p.scrollHeight <= p.clientHeight + 1;
        if ((ox === "auto" || ox === "scroll") && horizontal) return true;
      }
      return false;
    };
    const onTop = (el: Element, r: DOMRect) => {
      const x = Math.min(Math.max(r.left + r.width / 2, 0), vw - 1);
      const y = Math.min(Math.max(r.top + r.height / 2, 0), vh - 1);
      const hit = document.elementFromPoint(x, y);
      return !!hit && (hit === el || el.contains(hit) || hit.contains(el));
    };
    const interactive = [
      ...document.querySelectorAll<HTMLElement>(
        'a[href], button, input:not([type="hidden"]):not([type="file"]), textarea, select, [role="option"], [role="tab"]',
      ),
    ].filter((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (r.width < 2 || r.height < 2 || cs.visibility === "hidden" || cs.opacity === "0") return false;
      if (r.bottom <= 0 || r.top >= vh) return false;
      return onTop(el, r);
    });
    const smallTargets: string[] = [];
    const cutOff: string[] = [];
    const ellipsis: string[] = [];
    for (const el of interactive) {
      const r = el.getBoundingClientRect();
      if (r.height < 43.5 || r.width < 43.5) smallTargets.push(`${label(el)} ${Math.round(r.width)}×${Math.round(r.height)}`);
      if ((r.left < -1 || r.right > vw + 1) && !inScrollerX(el)) cutOff.push(`${label(el)} da ${Math.round(r.left)} a ${Math.round(r.right)}`);
    }
    // Testo che esce dallo schermo o dal suo contenitore senza puntini.
    for (const el of document.querySelectorAll<HTMLElement>("h1, h2, h3, p, span, label, li, button, a")) {
      if (el.childElementCount > 0 || !el.innerText?.trim()) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.bottom <= 0 || r.top >= vh || !onTop(el, r)) continue;
      if (r.right > vw + 1 && !inScrollerX(el)) cutOff.push(`testo ${label(el)} esce a destra`);
      const cs = getComputedStyle(el);
      if (cs.textOverflow === "ellipsis" && el.scrollWidth > el.clientWidth + 1) ellipsis.push(label(el));
      const clipped = el.scrollWidth > el.clientWidth + 1 && cs.overflowX !== "visible" && cs.textOverflow !== "ellipsis";
      if (clipped && !cs.webkitLineClamp?.match(/\d/)) cutOff.push(`testo ${label(el)} tagliato`);
    }
    // Riquadro visibile: tagliato dai contenitori che scorrono (un pulsante mezzo fuori dall'area
    // che scorre non è sovrapposto alla barra sotto).
    const visibleRect = (el: Element) => {
      let { left, top, right, bottom } = el.getBoundingClientRect();
      for (let p = el.parentElement; p; p = p.parentElement) {
        const cs = getComputedStyle(p);
        if (cs.overflowX === "visible" && cs.overflowY === "visible") continue;
        const r = p.getBoundingClientRect();
        left = Math.max(left, r.left);
        top = Math.max(top, r.top);
        right = Math.min(right, r.right);
        bottom = Math.min(bottom, r.bottom);
      }
      return { left, top, right, bottom, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
    };
    const overlaps: string[] = [];
    for (let i = 0; i < interactive.length; i++) {
      for (let j = i + 1; j < interactive.length; j++) {
        const a = interactive[i];
        const b = interactive[j];
        if (a.contains(b) || b.contains(a)) continue;
        // Un elenco che galleggia (risultati della ricerca, fogli) sta sopra il resto per scelta.
        const floating = (el: Element) => !!el.closest('[role="listbox"], [role="dialog"], [data-vaul-drawer]');
        if (floating(a) !== floating(b)) continue;
        const ra = visibleRect(a);
        const rb = visibleRect(b);
        const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
        const h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
        if (w > 2 && h > 2 && w * h > 0.2 * Math.min(ra.width * ra.height, rb.width * rb.height)) overlaps.push(`${label(a)} su ${label(b)}`);
      }
    }
    return { overflowX: document.documentElement.scrollWidth > vw + 1, smallTargets, cutOff, overlaps, ellipsis };
  });
}

function setup(page: Page, info: TestInfo) {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 300)));
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 300)));
  const audits: Audit[] = [];
  let n = 0;
  mkdirSync(SHOTS, { recursive: true });

  // Una schermata: screenshot, misure, controlli morbidi (il percorso continua e il report li elenca).
  async function screen(name: string) {
    await page.waitForTimeout(400); // fine delle transizioni da 250 ms
    n += 1;
    const file = join(SHOTS, `${info.project.name}-${String(n).padStart(2, "0")}-${name}.png`);
    await page.screenshot({ path: file });
    const m = await measure(page);
    const audit: Audit = { step: `${String(n).padStart(2, "0")}-${name}`, consoleErrors: errors.splice(0), ...m };
    audits.push(audit);
    expect.soft(audit.overflowX, `${name}: scorrimento orizzontale`).toBe(false);
    expect.soft(audit.consoleErrors, `${name}: errori in console`).toEqual([]);
    expect.soft(audit.smallTargets, `${name}: bersagli sotto i 44 px`).toEqual([]);
    expect.soft(audit.cutOff, `${name}: elementi tagliati`).toEqual([]);
    expect.soft(audit.overlaps, `${name}: elementi sovrapposti`).toEqual([]);
  }
  const save = () => writeFileSync(join(SHOTS, `audit-${info.project.name}.json`), JSON.stringify(audits, null, 2));
  return { screen, save };
}

async function conceptCount(page: Page) {
  await page.getByRole("button", { name: "Elenco dei concetti" }).click();
  const filter = page.getByRole("searchbox", { name: "Filtra i concetti" });
  await expect(filter).toBeVisible();
  const placeholder = (await filter.getAttribute("placeholder")) ?? "";
  return { filter, count: Number(placeholder.match(/\d+/)?.[0] ?? 0) };
}

test("percorso della demo, blocco 1", async ({ page }, info) => {
  const { screen, save } = setup(page, info);
  const desktop = info.project.name === "desktop";

  try {
    await test.step("grafo con l'ontologia del corso", async () => {
      await page.goto("/");
      await expect(page.locator("canvas").first()).toBeVisible();
      await page.waitForTimeout(4000); // assestamento e inquadratura
      await screen("grafo");
      const { count } = await conceptCount(page);
      expect(count).toBeGreaterThanOrEqual(TOPIC_COUNT_BEFORE);
      await screen("elenco-dei-concetti");
      await page.getByRole("button", { name: "Chiudi l'elenco" }).click();
    });

    await test.step("ricerca e dettaglio di Q-learning con le slide di prova", async () => {
      const search = page.getByRole("searchbox", { name: "Cerca un concetto" });
      await search.fill("Q-learning");
      await expect(page.getByRole("option").first()).toBeVisible();
      await screen("ricerca");
      await search.press("Enter");
      await expect(page.getByRole("heading", { name: "Q-learning", exact: true })).toBeVisible();
      await expect(page.getByText(/^L\d+ · slide \d+$/).first()).toBeVisible();
      await screen("dettaglio-q-learning");
      await page.getByRole("button", { name: "Chiudi il dettaglio" }).click();
      await expect(page.getByRole("heading", { name: "Q-learning", exact: true })).toBeHidden();
    });

    await test.step("filtro per argomento", async () => {
      if (!desktop) {
        await page.getByRole("button", { name: "Filtra per argomento" }).click();
        await expect(page.getByText("Argomenti", { exact: true })).toBeVisible();
      }
      const chips = page.getByRole("group", { name: "Filtra per argomento" }).getByRole("button");
      const chip = chips.first();
      await chip.click();
      await expect(chip).toHaveAttribute("aria-pressed", "true");
      await screen("filtro-argomento");
      await page.getByRole("button", { name: "Tutti" }).click();
      await expect(chip).toHaveAttribute("aria-pressed", "false");
      if (!desktop) await page.keyboard.press("Escape");
    });

    await test.step("caricamento dal vivo da Materiali, il Cartografo porta concetti nuovi", async () => {
      await page.getByRole("link", { name: "Materiali" }).click();
      await expect(page.getByRole("heading", { name: "Materiali" })).toBeVisible();
      await screen("materiali");
      await page.setInputFiles('input[type="file"]', LIVE_FILE);
      await expect(page.getByRole("textbox", { name: "Titolo" })).toHaveValue(/Lab06/);
      await page.getByRole("button", { name: "Carica e fai leggere al Cartografo" }).click();
      const row = page.getByRole("listitem").filter({ hasText: "Lab06" });
      await expect(row).toBeVisible();
      // Concetti che arrivano mentre il Cartografo legge (striscia dal vivo).
      await expect(page.getByText(/\+[1-9]\d* concett[oi]/).first()).toBeVisible({ timeout: 180_000 });
      await screen("cartografo-al-lavoro");
      await expect(row.getByText("Letta")).toBeVisible({ timeout: 300_000 });
      await expect(row.getByText(/[1-9]\d* concetti/)).toBeVisible();
      await screen("materiali-lab06-letta");
    });

    await test.step("il grafo ha i concetti nuovi", async () => {
      await page.getByRole("link", { name: "Grafo" }).click();
      await expect(page.locator("canvas").first()).toBeVisible();
      await page.waitForTimeout(3000);
      const { count } = await conceptCount(page);
      expect(count).toBeGreaterThan(TOPIC_COUNT_BEFORE);
      await page.getByRole("button", { name: "Chiudi l'elenco" }).click();
      await screen("grafo-dopo-il-caricamento");
    });

    await test.step("esame: elenco e domanda B", async () => {
      await page.getByRole("link", { name: "Esame" }).click();
      await expect(page.getByRole("link", { name: /Domanda 1/ })).toBeVisible();
      await expect(page.getByRole("link", { name: /Domanda 3/ })).toBeVisible();
      await screen("esame-elenco");
      await page.getByRole("link", { name: /Domanda 2/ }).click();
      await expect(page.getByText(/Domanda 2 · versione 1/)).toBeVisible();
      await screen("domanda-b");
    });

    await test.step("triplo attacco: i tre agenti finiscono, scheda con verdetti", async () => {
      await page.getByRole("button", { name: "Attacca la domanda" }).click();
      const progress = page.getByRole("list", { name: "Avanzamento dell'attacco" });
      await expect(progress).toBeVisible();
      await page.waitForTimeout(3000);
      await screen("attacco-in-corso");
      await expect(progress.getByText("3 di 3 finiti")).toBeVisible({ timeout: 240_000 });
      const scheda = page.getByRole("region", { name: "Scheda del Revisore" });
      await expect(scheda).toBeVisible({ timeout: 240_000 });
      await expect(page.getByText(/Sta rispondendo|In attesa/)).toHaveCount(0);
      await progress.scrollIntoViewIfNeeded();
      await screen("tre-agenti-finiti");
      await expect(scheda.getByRole("listitem").first()).toBeVisible();
      await scheda.scrollIntoViewIfNeeded();
      await screen("scheda-verdetti");
    });

    await test.step("approva e riattacca, prima e dopo", async () => {
      const scheda = page.getByRole("region", { name: "Scheda del Revisore" });
      const approve = scheda.getByRole("button", { name: "Approva e riattacca" });
      if (await approve.isVisible()) {
        await approve.click();
      } else {
        // Il Revisore non ha proposto: si modifica a mano, stesso percorso di riattacco.
        info.annotations.push({ type: "nota", description: "nessuna proposta del Revisore: usato Modifica e riattacca" });
        await scheda.getByRole("textbox").fill("Una transizione conclude l'episodio perché s' è terminale. Q(s,a)=2, alpha=0,5, gamma=0,9, ricompensa 1. Esegui l'aggiornamento Q-learning e giustifica il target.");
        await scheda.getByRole("button", { name: "Modifica e riattacca" }).click();
      }
      await expect(page.getByText(/Domanda 2 · versione 2/)).toBeVisible();
      const progress = page.getByRole("list", { name: "Avanzamento dell'attacco" });
      await expect(progress.getByText("3 di 3 finiti")).toBeVisible({ timeout: 240_000 });
      await expect(page.getByRole("region", { name: "Scheda del Revisore" })).toBeVisible({ timeout: 240_000 });
      const before = page.getByRole("region", { name: "Prima e dopo" });
      await expect(before.getByText("Versione 1", { exact: true })).toBeVisible({ timeout: 30_000 });
      await expect(before.getByText("Versione 2", { exact: true })).toBeVisible();
      await expect(before.getByText("Non ancora attaccata.")).toHaveCount(0, { timeout: 30_000 });
      await before.scrollIntoViewIfNeeded();
      await screen("prima-e-dopo");
    });

    await test.step("domanda senza griglia rifiutata, domanda nuova creata", async () => {
      await page.getByRole("link", { name: "Tutte le domande" }).click();
      await page.getByRole("button", { name: "Nuova domanda" }).click();
      await expect(page.getByRole("heading", { name: "Nuova domanda" })).toBeVisible();
      await page.getByLabel("Testo della domanda").fill("Spiega la differenza fra SARSA e Q-learning nel caso di una politica ϵ-greedy con ϵ fisso.");
      const save = page.getByRole("button", { name: "Salva la domanda" });
      await expect(save).toBeDisabled();
      // Il motivo si legge accanto al pulsante spento, anche su telefono.
      await save.scrollIntoViewIfNeeded();
      await expect(page.getByText(/Serve la griglia di correzione/)).toBeInViewport();
      await screen("domanda-senza-griglia");

      // Anche il server la rifiuta, con il messaggio.
      const course = (await (await page.request.get(`${API}/api/courses`)).json()).courses[0];
      const exam = (await (await page.request.get(`${API}/api/courses/${course.id}/exams`)).json()).exams[0];
      const res = await page.request.post(`${API}/api/exams/${exam.id}/questions`, { data: { text: "Domanda di prova senza griglia.", rubric: [] } });
      expect(res.status()).toBe(422);
      expect((await res.json()).error.message).toBe("Serve la griglia di correzione.");

      await page.getByLabel("Criterio 1", { exact: true }).fill("Distingue on-policy e off-policy");
      await page.getByLabel("Punti del criterio 1").fill("6");
      await page.getByLabel("Criterio 2", { exact: true }).fill("Conseguenza sull'esplorazione");
      await page.getByLabel("Punti del criterio 2").fill("4");
      await expect(page.getByText(/10 punti/)).toBeVisible();
      await screen("domanda-nuova-con-griglia");
      await page.getByRole("button", { name: "Salva la domanda" }).click();
      await expect(page.getByText(/Domanda 4 · versione 1/)).toBeVisible();
      await expect(page.getByRole("button", { name: "Attacca la domanda" })).toBeVisible();
      await screen("domanda-nuova-salvata");
    });

    await test.step("selettore studente", async () => {
      await page.getByRole("link", { name: "Grafo" }).click();
      await expect(page.locator("canvas").first()).toBeVisible();
      await page.getByRole("button", { name: "Studente" }).click();
      await expect(page.getByRole("button", { name: "Studente" })).toHaveAttribute("aria-pressed", "true");
      // Dal blocco 2 lo studente legge anche i materiali (senza caricamento); esame, classe e lezioni no.
      await expect(page.getByRole("link", { name: "Materiali" })).toBeVisible();
      for (const name of ["Esame", "Classe", "Lezioni"]) await expect(page.getByRole("link", { name })).toHaveCount(0);
      // Dal blocco 3 lo studente ha anche il suo piano di studio.
      await expect(page.getByRole("link", { name: "Studio" })).toBeVisible();
      const search = page.getByRole("searchbox", { name: "Cerca un concetto" });
      await search.fill("Q-learning");
      await search.press("Enter");
      await expect(page.getByRole("heading", { name: "Q-learning", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Correggi" })).toHaveCount(0);
      await screen("studente");
    });
  } finally {
    save();
  }
});
