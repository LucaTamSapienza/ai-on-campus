"use client";

// Guscio comune: navigazione a sinistra su desktop e in basso su telefono, corso corrente,
// selettore di ruolo (simulato) e richiesta del codice demo. File comune dell'orchestratore.
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, FileText, Network, type LucideIcon } from "lucide-react";
import { api, DEMO_CODE_EVENT, setDemoCode, type Course } from "@/lib/api";
// blocco 2
import { useRouter } from "next/navigation";
import { CalendarCheck, Users } from "lucide-react";
import { setApiRole } from "@/lib/api";
// fine blocco 2
import { Route } from "lucide-react"; // blocco 3
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type Role = "docente" | "studente";

// Il valore resta quello dell'API; a schermo si legge l'etichetta inglese.
const ROLE_LABEL: Record<Role, string> = { docente: "Teacher", studente: "Student" };

type NavItem = { href: string; label: string; icon: LucideIcon; roles: Role[] };

// Le pagine delle fasi successive si aggiungono qui quando esistono.
const NAV: NavItem[] = [
  { href: "/", label: "Graph", icon: Network, roles: ["docente", "studente"] },
  // blocco 2: i materiali si leggono anche con ruolo studente
  { href: "/materials", label: "Materials", icon: FileText, roles: ["docente", "studente"] },
  // fase 03
  { href: "/exam", label: "Exam", icon: ClipboardList, roles: ["docente"] },
  // blocco 2
  { href: "/class", label: "Class", icon: Users, roles: ["docente"] },
  { href: "/lessons", label: "Lessons", icon: CalendarCheck, roles: ["docente"] },
  // blocco 3: il piano di studio, solo per lo studente (al docente la barra del telefono avrebbe sei voci)
  { href: "/study", label: "Study", icon: Route, roles: ["studente"] },
];

type ShellValue = {
  course: Course | null;
  courseLoading: boolean;
  courseError: string | null;
  reloadCourse: () => Promise<void>;
  role: Role;
};

const ShellContext = createContext<ShellValue | null>(null);

export function useShell() {
  const value = useContext(ShellContext);
  if (!value) throw new Error("useShell fuori da AppShell");
  return value;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [course, setCourse] = useState<Course | null>(null);
  const [courseLoading, setCourseLoading] = useState(true);
  const [courseError, setCourseError] = useState<string | null>(null);
  const [role, setRole] = useState<Role>("docente");

  const reloadCourse = useCallback(async () => {
    try {
      const courses = await api.courses();
      setCourse(courses[0] ?? null);
      setCourseError(null);
    } catch (e) {
      setCourseError(e instanceof Error ? e.message : "Error");
    } finally {
      setCourseLoading(false);
    }
  }, []);

  useEffect(() => {
    reloadCourse();
  }, [reloadCourse]);

  const nav = NAV.filter((n) => n.roles.includes(role));
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  // blocco 2: il ruolo va al server con ogni richiesta; una pagina del docente con ruolo
  // studente porta al grafo. Le pagine si rimontano al cambio di ruolo e rileggono i dati.
  const router = useRouter();
  setApiRole(role);
  const allowed = NAV.some((n) => n.roles.includes(role) && isActive(n.href));
  useEffect(() => {
    if (!allowed) router.replace("/");
  }, [allowed, router]);
  // fine blocco 2

  return (
    <ShellContext.Provider value={{ course, courseLoading, courseError, reloadCourse, role }}>
      <div className="flex h-dvh w-full overflow-hidden">
        {/* Desktop: barra a sinistra */}
        <aside className="hidden w-(--nav-width) shrink-0 flex-col border-r bg-card lg:flex">
          <div className="px-6 pt-8 pb-6">
            <p className="text-lg font-bold tracking-wide" title={BRAND.tagline}>
              {BRAND.name}
            </p>
            <CourseName course={course} loading={courseLoading} className="mt-1 text-sm text-muted-foreground" />
          </div>
          <nav className="flex flex-col gap-1 px-3" aria-label="Main navigation">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-lg px-3 text-base font-medium text-muted-foreground transition-colors duration-150 ease-out outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
                  isActive(item.href) && "bg-muted text-foreground",
                )}
              >
                <item.icon className="size-5" aria-hidden />
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-auto p-4">
            <RoleSwitch role={role} onChange={setRole} />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Telefono: intestazione */}
          <header className="flex shrink-0 items-center justify-between gap-3 border-b bg-card px-4 pt-(--safe-top) lg:hidden">
            <div className="flex h-14 min-w-0 flex-col justify-center">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground">{BRAND.name}</p>
              <CourseName course={course} loading={courseLoading} className="truncate text-sm font-semibold" />
            </div>
            <RoleSwitch role={role} onChange={setRole} compact />
          </header>

          <main key={/* blocco 2 */ role} className="relative min-h-0 flex-1 overflow-hidden">
            {allowed ? children : null}
          </main>

          {/* Telefono: barra in basso */}
          <nav
            className="grid shrink-0 auto-cols-fr grid-flow-col border-t bg-card pb-(--safe-bottom) lg:hidden"
            aria-label="Main navigation"
          >
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium text-muted-foreground transition-colors duration-150 ease-out outline-none focus-visible:bg-muted",
                  isActive(item.href) && "text-primary",
                )}
              >
                <item.icon className="size-5" aria-hidden />
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
      <DemoCodeDialog />
    </ShellContext.Provider>
  );
}

function CourseName({ course, loading, className }: { course: Course | null; loading: boolean; className?: string }) {
  return <p className={className}>{loading ? " " : (course?.name ?? "No course")}</p>;
}

// Selettore di ruolo: simulato, sostituisce il login d'ateneo.
function RoleSwitch({ role, onChange, compact }: { role: Role; onChange: (r: Role) => void; compact?: boolean }) {
  return (
    <div className={cn("flex flex-col gap-1.5", compact && "items-end")}>
      {!compact && <p className="text-xs font-medium text-muted-foreground">Role (simulated)</p>}
      <div role="group" aria-label="Simulated role" className="flex rounded-lg bg-muted p-0.5">
        {(["docente", "studente"] as Role[]).map((r) => (
          <button
            key={r}
            type="button"
            aria-pressed={role === r}
            onClick={() => onChange(r)}
            className={cn(
              "h-11 flex-1 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors duration-150 ease-out outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              role === r && "bg-card text-foreground shadow-sm",
            )}
          >
            {ROLE_LABEL[r]}
          </button>
        ))}
      </div>
    </div>
  );
}

// Compare quando una scrittura chiede il codice demo (segreto DEMO_CODE impostato online).
function DemoCodeDialog() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(DEMO_CODE_EVENT, show);
    return () => window.removeEventListener(DEMO_CODE_EVENT, show);
  }, []);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Demo code</DialogTitle>
          <DialogDescription>Enter the demo code to use the demo. It stands in for the university login, which is simulated here.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setDemoCode(code.trim());
            setOpen(false);
            window.location.reload();
          }}
          className="flex flex-col gap-4"
        >
          <Input value={code} onChange={(e) => setCode(e.target.value)} autoFocus aria-label="Demo code" />
          <DialogFooter>
            <Button type="submit" disabled={!code.trim()}>
              Save code
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
