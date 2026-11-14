// Accesso di demo: due account fissi (docente e studente), dichiarati nella pagina /login e nel
// README come sostituto simulato del login d'ateneo. Il server controlla le credenziali e firma
// un token di sessione HMAC-SHA256 con il segreto SESSION_SECRET; il ruolo arriva solo da lì.
import type { MiddlewareHandler } from "hono";

export type Role = "docente" | "studente";

// La password di ogni account di demo è uguale alla sua email: lo dice la pagina di accesso.
const DEMO_ACCOUNTS: { email: string; password: string; role: Role; name: string }[] = [
  { email: "teacher@prisma.edu", password: "teacher@prisma.edu", role: "docente", name: "Teacher" },
  { email: "student@prisma.edu", password: "student@prisma.edu", role: "studente", name: "Student" },
];

// Segreto di sviluppo dichiarato: vale solo se SESSION_SECRET manca (in locale senza .dev.vars).
// Online va impostato con `wrangler secret put SESSION_SECRET`.
const DEV_SECRET = "prisma-dev-session-secret-local-only";
const SESSION_HOURS = 12;
export const MAX_CREDENTIAL_CHARS = 200;

export type Session = { role: Role; email: string; name: string; exp: number };

const enc = new TextEncoder();

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (ch) => ch.charCodeAt(0));

async function hmacKey(env: Env) {
  return crypto.subtle.importKey("raw", enc.encode(env.SESSION_SECRET || DEV_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export function timingSafeEqual(a: string, b: string): boolean {
  const ea = enc.encode(a);
  const eb = enc.encode(b);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}

// Controlla tutte e due le voci senza uscire prima: il tempo non dice quale campo è sbagliato.
export function checkCredentials(email: string, password: string) {
  const e = email.trim().toLowerCase();
  let found: (typeof DEMO_ACCOUNTS)[number] | null = null;
  for (const a of DEMO_ACCOUNTS) {
    const ok = timingSafeEqual(e, a.email) && timingSafeEqual(password, a.password);
    if (ok) found = a;
  }
  return found;
}

export async function signSession(env: Env, account: { role: Role; email: string; name: string }) {
  const session: Session = { role: account.role, email: account.email, name: account.name, exp: Math.floor(Date.now() / 1000) + SESSION_HOURS * 3600 };
  const payload = b64url(enc.encode(JSON.stringify(session)));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(env), enc.encode(payload)));
  return { token: `${payload}.${b64url(sig)}`, session };
}

export async function verifySession(env: Env, token: string | null | undefined): Promise<Session | null> {
  if (!token || token.length > 1024) return null;
  const [payload, sig, extra] = token.split(".");
  if (!payload || !sig || extra !== undefined) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", await hmacKey(env), fromB64url(sig), enc.encode(payload));
    if (!ok) return null;
    const s = JSON.parse(new TextDecoder().decode(fromB64url(payload))) as Session;
    if ((s.role !== "docente" && s.role !== "studente") || typeof s.exp !== "number" || s.exp < Date.now() / 1000) return null;
    return s;
  } catch {
    return null;
  }
}

const bearer = (header: string | undefined) => header?.match(/^Bearer\s+(\S+)$/i)?.[1] ?? null;

// Tutte le rotte /api tranne /api/health e /api/login vogliono una sessione valida.
const PUBLIC = new Set(["/api/health", "/api/login"]);

export const sessionGuard: MiddlewareHandler<{ Bindings: Env; Variables: { session: Session } }> = async (c, next) => {
  if (c.req.method === "OPTIONS" || PUBLIC.has(c.req.path)) return next();
  const session = await verifySession(c.env, bearer(c.req.header("authorization")));
  if (!session) return c.json({ error: { code: "unauthorized", message: "Sign in to continue." } }, 401);
  c.set("session", session);
  return next();
};
