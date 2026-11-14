"use client";

// Guscio comune: navigazione a sinistra su desktop e in basso su telefono, corso corrente,
// selettore di ruolo (simulato) e richiesta del codice demo. File comune dell'orchestratore.
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, Network, type LucideIcon } from "lucide-react";
import { api, DEMO_CODE_EVENT, setDemoCode, type Course } from "@/lib/api";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type Role = "docente" | "studente";

type NavItem = { href: string; label: string; icon: LucideIcon; roles: Role[] };

// Le pagine delle fasi successive si aggiungono qui quando esistono.
const NAV: NavItem[] = [
  { href: "/", label: "Grafo", icon: Network, roles: ["docente", "studente"] },
  { href: "/materiali", label: "Materiali", icon: FileText, roles: ["docente"] },
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
      setCourseError(e instanceof Error ? e.message : "Errore");
    } finally {
      setCourseLoading(false);
    }
  }, []);

  useEffect(() => {
    reloadCourse();
  }, [reloadCourse]);

  const nav = NAV.filter((n) => n.roles.includes(role));
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <ShellContext.Provider value={{ course, courseLoading, courseError, reloadCourse, role }}>
      <div className="flex h-dvh w-full overflow-hidden">
        {/* Desktop: barra a sinistra */}
        <aside className="hidden w-[232px] shrink-0 flex-col border-r bg-card lg:flex">
          <div className="px-6 pt-8 pb-6">
            <p className="text-lg font-bold tracking-wide" title={BRAND.tagline}>
              {BRAND.name}
            </p>
            <CourseName course={course} loading={courseLoading} className="mt-1 text-sm text-muted-foreground" />
          </div>
          <nav className="flex flex-col gap-1 px-3" aria-label="Navigazione principale">
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
          <header className="flex shrink-0 items-center justify-between gap-3 border-b bg-card px-4 pt-[env(safe-area-inset-top)] lg:hidden">
            <div className="flex h-14 min-w-0 flex-col justify-center">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground">{BRAND.name}</p>
              <CourseName course={course} loading={courseLoading} className="truncate text-base font-semibold" />
            </div>
            <RoleSwitch role={role} onChange={setRole} compact />
          </header>

          <main className="relative min-h-0 flex-1 overflow-hidden">{children}</main>

          {/* Telefono: barra in basso */}
          <nav
            className="grid shrink-0 border-t bg-card pb-[env(safe-area-inset-bottom)] lg:hidden"
            style={{ gridTemplateColumns: `repeat(${nav.length}, minmax(0, 1fr))` }}
            aria-label="Navigazione principale"
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
  return <p className={className}>{loading ? " " : (course?.name ?? "Nessun corso")}</p>;
}

// Selettore di ruolo: simulato, sostituisce il login d'ateneo.
function RoleSwitch({ role, onChange, compact }: { role: Role; onChange: (r: Role) => void; compact?: boolean }) {
  return (
    <div className={cn("flex flex-col gap-1.5", compact && "items-end")}>
      {!compact && <p className="text-xs font-medium text-muted-foreground">Ruolo (simulato)</p>}
      <div role="group" aria-label="Ruolo simulato" className="flex rounded-lg bg-muted p-0.5">
        {(["docente", "studente"] as Role[]).map((r) => (
          <button
            key={r}
            type="button"
            aria-pressed={role === r}
            onClick={() => onChange(r)}
            className={cn(
              "h-10 flex-1 rounded-md px-3 text-sm font-medium capitalize text-muted-foreground transition-colors duration-150 ease-out outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              role === r && "bg-card text-foreground shadow-sm",
            )}
          >
            {r}
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
          <DialogTitle>Codice demo</DialogTitle>
          <DialogDescription>Per usare la demo serve il suo codice. Sostituisce il login d&apos;ateneo, che qui è simulato.</DialogDescription>
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
          <Input value={code} onChange={(e) => setCode(e.target.value)} autoFocus aria-label="Codice demo" />
          <DialogFooter>
            <Button type="submit" disabled={!code.trim()}>
              Salva il codice
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
