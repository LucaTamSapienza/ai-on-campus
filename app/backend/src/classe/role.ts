// Ruolo studente in sola lettura, fatto valere dal server. Il ruolo arriva dal selettore simulato
// del frontend (intestazione x-role, parametro role sui WebSocket): è dichiarato fra le
// simulazioni come sostituto del login d'ateneo. Con ruolo studente si leggono grafo e materiali;
// ogni scrittura e tutto ciò che riguarda esame, classe e proposte risponde 403.
import type { MiddlewareHandler } from "hono";

// Letture riservate al docente: domande, griglie, attacchi, profili della classe, proposte.
const TEACHER_ONLY = [
  /^\/api\/courses\/[^/]+\/exams$/,
  /^\/api\/courses\/[^/]+\/students$/,
  /^\/api\/courses\/[^/]+\/proposals$/,
  /^\/api\/exams\//,
  /^\/api\/questions\//,
  /^\/api\/runs\//,
  /^\/api\/class-runs\//,
  /^\/api\/usage$/,
];

export const isStudent = (role: string | null | undefined) => role === "studente";

// blocco 3: l'unica scrittura dello studente, il suo piano di studio.
const STUDENT_WRITES = [/^\/api\/courses\/[^/]+\/study-plans$/];
// fine blocco 3

export function studentForbidden(method: string, path: string): boolean {
  if (method === "POST" && STUDENT_WRITES.some((re) => re.test(path))) return false; // blocco 3
  if (method !== "GET" && method !== "HEAD") return true;
  return TEACHER_ONLY.some((re) => re.test(path));
}

export const studentGuard: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  if (c.req.method === "OPTIONS" || !isStudent(c.req.header("x-role"))) return next();
  if (studentForbidden(c.req.method, c.req.path)) {
    return c.json({ error: { code: "forbidden_role", message: "With the student role this part is read-only or not visible." } }, 403);
  }
  return next();
};

// WebSocket: lo studente vede solo il Cartografo (il grafo che cresce) e, blocco 3, il Pianificatore del suo piano.
export function studentAgentForbidden(url: URL): boolean {
  return isStudent(url.searchParams.get("role")) && !/^\/agents\/(cartografo|pianificatore)\//.test(url.pathname);
}
