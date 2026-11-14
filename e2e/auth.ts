// Accesso di demo negli spec: dalla pagina /login come farà Luca davanti alla giuria, e via API per
// le chiamate dirette. La password degli account di demo è uguale all'email.
import { expect, type APIRequestContext, type Page } from "@playwright/test";

export type DemoRole = "teacher" | "student";
const EMAIL: Record<DemoRole, string> = { teacher: "teacher@prisma.edu", student: "student@prisma.edu" };

// Entra dalla pagina di accesso con il blocco «Demo accounts» e aspetta il grafo.
export async function signIn(page: Page, role: DemoRole) {
  if (!page.url().includes("/login")) await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Demo sign-in" })).toBeVisible();
  await page.getByRole("button", { name: new RegExp(`^${role === "teacher" ? "Teacher" : "Student"}`) }).click();
  await expect(page.getByLabel("Email")).toHaveValue(EMAIL[role]);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

// «Sign out»: su desktop in fondo alla barra laterale, sul telefono nel foglio dell'account.
export async function signOut(page: Page) {
  const direct = page.getByRole("button", { name: "Sign out" }).filter({ visible: true });
  if ((await direct.count()) === 0) await page.getByRole("button", { name: /^Account/ }).click();
  await page.getByRole("button", { name: "Sign out" }).filter({ visible: true }).click();
  await expect(page).toHaveURL(/\/login/);
}

// Cambio di ruolo: si esce e si rientra con l'altro account.
export async function switchRole(page: Page, role: DemoRole) {
  await signOut(page);
  await signIn(page, role);
}

// Intestazione Authorization per le chiamate dirette all'API.
export async function authHeaders(request: APIRequestContext, api: string, role: DemoRole) {
  const res = await request.post(`${api}/api/login`, { data: { email: EMAIL[role], password: EMAIL[role] } });
  expect(res.status(), "accesso via API").toBe(200);
  return { authorization: `Bearer ${(await res.json()).token as string}` };
}
