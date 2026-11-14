"use client";

// Guscio comune: barra laterale a gruppi su desktop (logo e scritta, niente nome del corso), intestazione e barra in basso su telefono,
// corso corrente, utente entrato con «Sign out» e richiesta del codice demo. Senza sessione ogni
// pagina porta a /login, che sta fuori dal guscio. File comune dell'orchestratore.
import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Drawer as DrawerPrimitive } from "vaul";
import { CalendarCheck, ClipboardList, FileText, LogOut, Network, Route, Users, type LucideIcon } from "lucide-react";
import { api, DEMO_CODE_EVENT, getSession, SESSION_EVENT, setDemoCode, signOut, type Course, type Role, type Session } from "@/lib/api";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type { Role };

// Il valore resta quello dell'API; a schermo si legge l'etichetta inglese.
export const ROLE_LABEL: Record<Role, string> = { docente: "Teacher", studente: "Student" };

type NavItem = { href: string; label: string; icon: LucideIcon; roles: Role[] };
type NavGroup = { label: string; items: NavItem[] };

// Gruppi della barra laterale. Sul telefono le stesse voci, in ordine, nella barra in basso:
// al massimo cinque per ruolo (docente cinque, studente tre).
const GROUPS: NavGroup[] = [
  {
    label: "Course",
    items: [
      { href: "/", label: "Graph", icon: Network, roles: ["docente", "studente"] },
      { href: "/materials", label: "Materials", icon: FileText, roles: ["docente", "studente"] },
      { href: "/lessons", label: "Lessons", icon: CalendarCheck, roles: ["docente"] },
    ],
  },
  {
    label: "Assessment",
    items: [
      { href: "/exam", label: "Exam", icon: ClipboardList, roles: ["docente"] },
      { href: "/class", label: "Class", icon: Users, roles: ["docente"] },
    ],
  },
  {
    label: "My study",
    items: [{ href: "/study", label: "Study", icon: Route, roles: ["studente"] }],
  },
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

// Sessione letta da sessionStorage; null finché il browser non l'ha letta (export statico).
const subscribeSession = (cb: () => void) => {
  window.addEventListener(SESSION_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(SESSION_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
};
let cachedRaw: string | null = null;
let cachedSession: Session | null = null;
function readSession() {
  const s = getSession();
  const raw = s ? JSON.stringify(s) : null;
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedSession = s;
  }
  return cachedSession;
}
export function useSession() {
  const session = useSyncExternalStore(subscribeSession, readSession, () => null);
  const ready = useSyncExternalStore(subscribeSession, () => true, () => false);
  return { session, ready };
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, ready } = useSession();
  const onLogin = pathname === "/login" || pathname.startsWith("/login/");

  // Senza sessione si va all'accesso; con la sessione l'accesso porta al grafo.
  useEffect(() => {
    if (!ready) return;
    if (!session && !onLogin) router.replace("/login");
    if (session && onLogin) router.replace("/");
  }, [ready, session, onLogin, router]);

  if (onLogin) return <>{children}</>;
  if (!ready || !session) return null;
  return (
    <SignedInShell session={session} pathname={pathname}>
      {children}
    </SignedInShell>
  );
}

function SignedInShell({ session, pathname, children }: { session: Session; pathname: string; children: React.ReactNode }) {
  const router = useRouter();
  const role = session.user.role;
  const [course, setCourse] = useState<Course | null>(null);
  const [courseLoading, setCourseLoading] = useState(true);
  const [courseError, setCourseError] = useState<string | null>(null);

  const reloadCourse = useCallback(async () => {
    try {
      const courses = await api.courses();
      setCourse(courses[0] ?? null);
      setCourseError(null);
    } catch (e) {
      setCourseError(e instanceof Error ? e.message : "Unable to reach the server. Check the connection and try again.");
    } finally {
      setCourseLoading(false);
    }
  }, []);

  useEffect(() => {
    reloadCourse();
  }, [reloadCourse]);

  const groups = GROUPS.map((g) => ({ ...g, items: g.items.filter((n) => n.roles.includes(role)) })).filter((g) => g.items.length > 0);
  const nav = groups.flatMap((g) => g.items);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  // blocco 2: una pagina del docente con ruolo studente porta al grafo (il server risponde comunque 403).
  const allowed = nav.some((n) => isActive(n.href)) || pathname.startsWith("/study/plan"); // piano a pagina intera, per entrambi i ruoli
  useEffect(() => {
    if (!allowed) router.replace("/");
  }, [allowed, router]);

  return (
    <ShellContext.Provider value={{ course, courseLoading, courseError, reloadCourse, role }}>
      <a
        href="#main"
        className="pointer-events-none fixed top-(--space-2) left-(--space-2) z-50 rounded-lg bg-card px-4 py-3 text-base font-medium whitespace-nowrap opacity-0 shadow-float outline-none focus-visible:pointer-events-auto focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-ring"
      >
        Skip to content
      </a>
      <div className="flex h-dvh w-full overflow-hidden">
        {/* Desktop: barra a sinistra, logo in alto, gruppi al centro, utente in fondo */}
        <aside className="hidden w-(--nav-width) shrink-0 flex-col border-r bg-card lg:flex">
          {/* solo logo e scritta: il nome del corso sta nell'intestazione del telefono, non qui */}
          <div className="px-6 pt-8 pb-6">
            <p className="flex items-center gap-2 text-lg font-bold tracking-wide" title={BRAND.tagline}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/prisma-mark.svg" alt="" className="size-8" />
              {BRAND.name}
            </p>
          </div>
          <nav className="flex flex-col gap-6 px-3" aria-label="Main navigation">
            {groups.map((g) => (
              <div key={g.label} className="flex flex-col gap-1" role="group" aria-labelledby={`nav-${g.label}`}>
                <p id={`nav-${g.label}`} className="px-3 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {g.label}
                </p>
                {g.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive(item.href) ? "page" : undefined}
                    className={cn(
                      "flex h-11 items-center gap-3 rounded-lg px-3 text-base font-medium text-muted-foreground transition-colors duration-150 ease-out outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring",
                      isActive(item.href) && "bg-primary-soft font-semibold text-primary-strong hover:bg-primary-soft hover:text-primary-strong",
                    )}
                  >
                    <item.icon className="size-5" aria-hidden />
                    {item.label}
                  </Link>
                ))}
              </div>
            ))}
          </nav>
          <div className="mt-auto flex flex-col gap-2 border-t px-3 pt-4 pb-4">
            <UserBadge session={session} />
            <SignOutButton />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Telefono: intestazione con marchio, corso e utente */}
          <header className="flex shrink-0 items-center justify-between gap-3 border-b bg-card px-4 pt-(--safe-top) lg:hidden">
            <div className="flex h-14 min-w-0 flex-col justify-center">
              <p className="flex items-center gap-1 text-xs font-semibold tracking-wide text-muted-foreground">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brand/prisma-mark.svg" alt="" className="size-4" />
                {BRAND.name}
              </p>
              <CourseName course={course} loading={courseLoading} className="line-clamp-2 text-sm leading-tight font-semibold" />
            </div>
            <AccountSheet session={session} />
          </header>

          <main id="main" tabIndex={-1} key={/* blocco 2 */ role} className="relative min-h-0 flex-1 overflow-hidden outline-none">
            {allowed ? children : null}
          </main>

          {/* Telefono: barra in basso, al massimo cinque voci */}
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
                  "group/nav flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium text-muted-foreground transition-colors duration-150 ease-out outline-none focus-visible:bg-muted focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-inset",
                  isActive(item.href) && "font-semibold text-primary-strong",
                )}
              >
                {/* la voce attiva ha anche una forma, non solo un colore */}
                <span
                  className={cn(
                    "flex h-7 w-12 items-center justify-center rounded-full transition-colors duration-150 ease-out",
                    isActive(item.href) && "bg-primary-soft",
                  )}
                >
                  <item.icon className="size-5" aria-hidden />
                </span>
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
  return <p className={className}>{loading ? "\u00a0" : (course?.name ?? "No course")}</p>;
}

function Avatar({ session, className }: { session: Session; className?: string }) {
  return (
    <span
      className={cn("flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-base font-semibold text-primary-strong", className)}
      aria-hidden
    >
      {session.user.name.slice(0, 1).toUpperCase()}
    </span>
  );
}

// Utente entrato: ruolo in chiaro, email sotto. Il ruolo arriva dall'account di demo.
function UserBadge({ session }: { session: Session }) {
  return (
    <div className="flex min-w-0 items-center gap-3 px-3 py-1">
      <Avatar session={session} />
      <div className="flex min-w-0 flex-col">
        <p className="text-sm font-semibold">{ROLE_LABEL[session.user.role]}</p>
        <p className="text-xs break-all text-muted-foreground">
          {session.user.email}
        </p>
      </div>
    </div>
  );
}

function SignOutButton({ className }: { className?: string }) {
  return (
    <Button variant="ghost" className={cn("h-11 justify-start gap-3 px-3 text-base text-muted-foreground", className)} onClick={() => signOut()}>
      <LogOut className="size-5" aria-hidden />
      Sign out
    </Button>
  );
}

// Telefono: l'avatar apre un foglio dal basso con utente, ruolo e «Sign out».
function AccountSheet({ session }: { session: Session }) {
  const [open, setOpen] = useState(false);
  return (
    <DrawerPrimitive.Root open={open} onOpenChange={setOpen}>
      <DrawerPrimitive.Trigger asChild>
        <button
          type="button"
          className="flex size-11 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring"
          aria-label={`Account: ${ROLE_LABEL[session.user.role]}, ${session.user.email}`}
        >
          <Avatar session={session} />
        </button>
      </DrawerPrimitive.Trigger>
      <DrawerPrimitive.Portal>
        <DrawerPrimitive.Overlay className="fixed inset-0 z-40 bg-overlay" />
        <DrawerPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-50 flex flex-col gap-4 rounded-t-2xl border-t bg-card px-4 pt-2 pb-(--sheet-padding-bottom) outline-none"
        >
          <div className="mx-auto h-1.5 w-12 rounded-full bg-muted" aria-hidden />
          <DrawerPrimitive.Title className="text-lg font-semibold">Account</DrawerPrimitive.Title>
          <div className="-mx-3">
            <UserBadge session={session} />
          </div>
          <Button variant="outline" className="h-11 gap-3 text-base" onClick={() => signOut()}>
            <LogOut className="size-5" aria-hidden />
            Sign out
          </Button>
        </DrawerPrimitive.Content>
      </DrawerPrimitive.Portal>
    </DrawerPrimitive.Root>
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
