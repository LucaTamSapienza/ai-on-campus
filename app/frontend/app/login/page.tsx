"use client";

// Accesso di demo, fuori dal guscio: email e password controllate dal Worker contro due account
// fissi, dichiarati qui sotto. Sostituisce il login d'ateneo, che è simulato.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { ApiError, signIn } from "@/lib/api";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const MAX_CHARS = 200;

const DEMO_ACCOUNTS = [
  { role: "Teacher", email: "teacher@prisma.edu", hint: "Builds the exam and runs the agents" },
  { role: "Student", email: "student@prisma.edu", hint: "Reads the course and plans study" },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
      router.replace("/");
    } catch (err) {
      // Un solo messaggio per email o password sbagliate: nessun indizio sul campo.
      setError(
        err instanceof ApiError && err.status === 401
          ? "Email or password is not correct. Check both and try again."
          : err instanceof Error
            ? err.message
            : "Unable to sign in. Try again.",
      );
      setBusy(false);
    }
  };

  const fill = (account: string) => {
    setEmail(account);
    setPassword(account);
    setError(null);
  };

  return (
    <main className="flex min-h-dvh w-full items-start justify-center overflow-y-auto bg-background px-4 pt-(--space-12) pb-(--space-8) lg:items-center lg:py-(--space-12)">
      <div className="flex w-full max-w-(--login-width) flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/prisma-mark.svg" alt="" className="size-12" />
          <h1 className="text-2xl font-bold tracking-wide">{BRAND.name}</h1>
          <p className="max-w-(--measure) text-base text-pretty text-muted-foreground">{BRAND.tagline}</p>
        </div>

        <section className="flex flex-col gap-6 rounded-2xl bg-card p-6 shadow-float" aria-labelledby="login-title">
          <div className="flex flex-col gap-1">
            <h2 id="login-title" className="text-lg font-semibold">
              Demo sign-in
            </h2>
            <p className="text-sm text-muted-foreground">This sign-in stands in for the university login. Use one of the demo accounts below.</p>
          </div>

          <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                inputMode="email"
                spellCheck={false}
                autoCapitalize="none"
                maxLength={MAX_CHARS}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "login-error" : undefined}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                maxLength={MAX_CHARS}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "login-error" : undefined}
                required
              />
            </div>
            <p id="login-error" role="alert" className={cn("text-sm font-medium text-destructive-strong", !error && "sr-only")}>
              {error ?? ""}
            </p>
            <Button type="submit" size="lg" className="h-11 gap-2 text-base" disabled={busy || !email.trim() || !password}>
              {busy ? <Loader2 className="size-5 animate-spin motion-reduce:animate-none" aria-hidden /> : null}
              {busy ? "Signing in" : "Sign in"}
              {!busy && <ArrowRight className="size-5" aria-hidden />}
            </Button>
          </form>
        </section>

        <section className="flex flex-col gap-3" aria-labelledby="demo-accounts">
          <div className="flex flex-col gap-1 px-1">
            <h2 id="demo-accounts" className="text-sm font-semibold">
              Demo accounts
            </h2>
            <p className="text-sm text-muted-foreground">Tap one to fill the fields. The password is the same as the email.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {DEMO_ACCOUNTS.map((a) => {
              const on = email.trim().toLowerCase() === a.email && password === a.email;
              return (
                <button
                  key={a.email}
                  type="button"
                  onClick={() => fill(a.email)}
                  aria-pressed={on}
                  className={cn(
                    "flex min-h-11 flex-col items-start gap-1 rounded-xl border bg-card px-4 py-3 text-left transition-colors duration-150 ease-out outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring",
                    on && "border-primary bg-primary-soft ring-1 ring-primary ring-inset hover:bg-primary-soft",
                  )}
                >
                  <span className="text-base font-semibold">{a.role}</span>
                  <span className="text-sm break-all text-muted-foreground">{a.email}</span>
                  <span className="text-xs text-muted-foreground">{a.hint}</span>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
