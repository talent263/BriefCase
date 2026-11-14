"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { ArrowRight, BriefcaseBusiness, Building2, CircleAlert, LockKeyhole } from "lucide-react";
import { useAuth } from "@/components/providers";
import { getClientAuth, isFirebaseConfigured } from "@/lib/firebase/client";
import { signInLocal, signUpLocal } from "@/lib/local-auth";
import { isLocalMode } from "@/lib/local-mode";

type LocalMode = "signin" | "signup";

export default function LoginPage() {
  const localMode = isLocalMode();
  const { status, error: sessionError } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<LocalMode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const configured = isFirebaseConfigured();

  useEffect(() => {
    if (status === "ready") router.replace("/dashboard");
  }, [status, router]);

  async function signInWithGoogle() {
    setError(null);
    setBusy(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const result = await signInWithPopup(getClientAuth(), provider);
      const idToken = await result.user.getIdToken();
      const response = await fetch("/api/session/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
        credentials: "same-origin",
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message = typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string"
          ? payload.error
          : "Your account could not be verified.";
        throw new Error(message);
      }
      await result.user.getIdToken(true);
      const requestedNext = new URLSearchParams(window.location.search).get("next");
      const destination = requestedNext?.startsWith("/dashboard") && !requestedNext.startsWith("//") ? requestedNext : "/dashboard";
      window.location.assign(destination);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign in could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  async function submitLocal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "signup") await signUpLocal(name, email, password);
      else await signInLocal(email, password);
      const requestedNext = new URLSearchParams(window.location.search).get("next");
      const destination = requestedNext?.startsWith("/dashboard") && !requestedNext.startsWith("//") ? requestedNext : "/dashboard";
      router.replace(destination);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not complete authentication.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative grid min-h-screen overflow-hidden bg-paper lg:grid-cols-[1.03fr_.97fr]">
      <div className="login-orb" />
      <section className="relative flex min-h-[370px] flex-col justify-between overflow-hidden bg-forest px-7 py-8 text-white lg:min-h-screen lg:px-14 lg:py-12">
        <div className="absolute -bottom-36 -right-16 h-[520px] w-[520px] rounded-full border border-white/[.07]" />
        <div className="absolute -bottom-24 -right-3 h-[390px] w-[390px] rounded-full border border-white/[.07]" />
        <div className="relative flex items-center gap-3"><div className="brand-mark"><BriefcaseBusiness size={18} /></div><div><p className="font-display text-base font-extrabold tracking-[-.04em]">briefcase</p><p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[.2em] text-white/45">Moyo & Partners</p></div></div>
        <div className="relative max-w-xl py-14 lg:py-0">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[.06] px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[.16em] text-[#e2d0a7]"><Building2 size={12} /> Harare · Zimbabwe</div>
          <h1 className="font-display text-[38px] font-semibold leading-[1.08] tracking-[-.055em] sm:text-5xl lg:text-[58px]">Clarity for the <span className="text-gold">work</span> that matters.</h1>
          <p className="mt-5 max-w-md text-sm leading-7 text-white/62">A thoughtful workspace for matters, clients and the daily work of your practice.</p>
          <div className="mt-10 grid max-w-lg grid-cols-3 gap-3 border-t border-white/12 pt-5">
            <div><p className="font-display text-lg font-semibold text-white">Matters</p><p className="mt-1 text-[10px] text-white/45">Kept in view</p></div>
            <div><p className="font-display text-lg font-semibold text-white">Clients</p><p className="mt-1 text-[10px] text-white/45">At the centre</p></div>
            <div><p className="font-display text-lg font-semibold text-white">Practice</p><p className="mt-1 text-[10px] text-white/45">Moving forward</p></div>
          </div>
        </div>
        <p className="relative text-[10px] text-white/35">© {new Date().getFullYear()} Moyo & Partners · Confidential workspace</p>
      </section>

      <section className="relative flex items-center justify-center px-6 py-12 sm:px-12 lg:px-16">
        <div className="w-full max-w-[390px]">
          <div className="mb-9 lg:hidden"><div className="brand-mark !border-forest !text-forest"><BriefcaseBusiness size={18} /></div></div>
          <p className="eyebrow">{localMode ? (mode === "signup" ? "Create account" : "Welcome back") : "Welcome back"}</p>
          <h2 className="mt-2 font-display text-[30px] font-bold tracking-[-.05em]">{localMode ? (mode === "signup" ? "Sign up to Briefcase" : "Sign in to Briefcase") : "Sign in to Briefcase"}</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            {localMode
              ? "Local testing mode — accounts and workspace data stay in this browser."
              : "Use your firm Google account to access your workspace."}
          </p>

          <div className="mt-8 rounded-2xl border border-[#e4e6df] bg-white p-6 shadow-card sm:p-7">
            {localMode ? (
              <>
                <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg bg-paper p-1">
                  <button type="button" className={`rounded-md px-3 py-2 text-[11px] font-bold transition ${mode === "signin" ? "bg-white text-ink shadow-sm" : "text-muted"}`} onClick={() => { setMode("signin"); setError(null); }}>Sign in</button>
                  <button type="button" className={`rounded-md px-3 py-2 text-[11px] font-bold transition ${mode === "signup" ? "bg-white text-ink shadow-sm" : "text-muted"}`} onClick={() => { setMode("signup"); setError(null); }}>Sign up</button>
                </div>
                <form className="space-y-3.5" onSubmit={(event) => void submitLocal(event)}>
                  {mode === "signup" ? (
                    <label className="block">
                      <span className="field-label">Full name</span>
                      <input className="field-control" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Tendai Moyo" required minLength={2} />
                    </label>
                  ) : null}
                  <label className="block">
                    <span className="field-label">Email</span>
                    <input className="field-control" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@firm.co.zw" required />
                  </label>
                  <label className="block">
                    <span className="field-label">Password</span>
                    <input className="field-control" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" required minLength={8} />
                  </label>
                  <button disabled={busy} type="submit" className="btn-primary mt-1 flex min-h-12 w-full items-center justify-center gap-2 disabled:cursor-wait disabled:opacity-60">
                    {busy ? (mode === "signup" ? "Creating account…" : "Signing you in…") : mode === "signup" ? "Create local account" : "Sign in"}
                    <ArrowRight size={15} />
                  </button>
                </form>
              </>
            ) : !configured ? (
              <div className="rounded-xl border border-[#e7d7b5] bg-[#fbf7ed] p-4">
                <div className="flex gap-2.5"><CircleAlert size={16} className="mt-0.5 shrink-0 text-[#a27d42]" /><div><p className="text-xs font-bold text-ink">Firebase setup needed</p><p className="mt-1.5 text-[11px] leading-5 text-muted">Copy <code className="rounded bg-white px-1 py-0.5">.env.example</code> to <code className="rounded bg-white px-1 py-0.5">.env.local</code>, fill in your Firebase web app values, then restart the dev server.</p></div></div>
              </div>
            ) : (
              <button disabled={busy} onClick={() => void signInWithGoogle()} className="flex min-h-12 w-full items-center justify-center gap-3 rounded-lg border border-[#dfe2dc] bg-white px-4 text-xs font-bold text-ink transition hover:bg-[#fbfbf8] disabled:cursor-wait disabled:opacity-60">
                <GoogleIcon />{busy ? "Signing you in…" : "Continue with Google"}<ArrowRight size={15} className="ml-auto text-muted" />
              </button>
            )}
            {error || sessionError ? <div className="mt-4 flex gap-2 rounded-lg bg-[#fbefeb] p-3 text-[11px] leading-5 text-[#a6493c]"><CircleAlert size={15} className="mt-0.5 shrink-0" />{error ?? sessionError}</div> : null}
            <div className="mt-5 flex items-start gap-2.5 rounded-lg bg-paper p-3.5">
              <LockKeyhole size={14} className="mt-0.5 shrink-0 text-forest" />
              <p className="text-[10px] leading-5 text-muted">
                {localMode
                  ? "Testing only — passwords and workspace data are stored in this browser’s localStorage. Switch to Google auth later with NEXT_PUBLIC_AUTH_MODE=firebase."
                  : "Your sign-in is protected by Google. Workspace access is secured with an encrypted, httpOnly session."}
              </p>
            </div>
          </div>
          <p className="mt-6 text-center text-[10px] leading-5 text-muted">By signing in, you agree to use this workspace in accordance with your firm’s confidentiality policies.</p>
        </div>
      </section>
    </main>
  );
}

function GoogleIcon() {
  return <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.9c-.58 2.96-2.26 5.48-4.76 7.18l7.73 6c4.51-4.16 7.11-10.29 7.11-17.65Z"/><path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.75-4.59l-7.98-6.2A23.9 23.9 0 0 0 0 24c0 3.89.93 7.56 2.56 10.78l7.97-6.19Z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.8l-7.73-6c-2.14 1.45-4.88 2.3-8.17 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"/></svg>;
}
