"use client";

import { useMutation } from "@tanstack/react-query";
import { CalendarCheck, KeyRound, Mail } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Alert, Button, inputClass } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import type { MeResponse } from "@/lib/types";

/**
 * Where to go after signing in: the page they were sent away from, otherwise admins go to the
 * admin dashboard and everyone else to their own attendance. Only same-site paths are accepted,
 * so ?next= can't bounce people to another website.
 */
function destination(role: MeResponse["user"]["role"]): string {
  const next = new URLSearchParams(window.location.search).get("next");
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return role === "admin" ? "/admin" : "/";
}

// Full navigation so the proxy sees the new cookie and no cached data from another account survives.
function go(data: MeResponse) {
  window.location.assign(destination(data.user.role));
}

export default function LoginPage() {
  const [step, setStep] = useState<"email" | "code" | "password">("email");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const sendCode = useMutation({
    mutationFn: () => api<{ sent: true }>("/api/auth/request-code", { body: { email } }),
    onSuccess: () => {
      setStep("code");
      setCode("");
      setCooldown(45);
    },
  });

  const verify = useMutation({
    mutationFn: () => api<MeResponse>("/api/auth/verify-code", { body: { email, code } }),
    onSuccess: go,
  });

  const passwordLogin = useMutation({
    mutationFn: () => api<MeResponse>("/api/auth/password", { body: { email, password } }),
    onSuccess: go,
  });

  function onEmail(e: FormEvent) {
    e.preventDefault();
    sendCode.mutate();
  }

  function onCode(e: FormEvent) {
    e.preventDefault();
    verify.mutate();
  }

  const error = step === "email" ? sendCode.error : step === "password" ? passwordLogin.error : (verify.error ?? sendCode.error);

  function switchTo(next: "email" | "password") {
    setStep(next);
    setPassword("");
    sendCode.reset();
    verify.reset();
    passwordLogin.reset();
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center gap-3 bg-slate-900 px-6 py-6">
          <div className="rounded-xl bg-orange-500 p-2.5">
            <CalendarCheck className="text-white" size={22} aria-hidden />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Flashfire Attendance</h1>
            <p className="text-sm text-slate-300">Sign in with your work email</p>
          </div>
        </div>

        <div className="space-y-5 px-6 py-6">
          {error && <Alert>{errorMessage(error)}</Alert>}

          {step === "email" ? (
            <form onSubmit={onEmail} className="space-y-4">
              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Work email
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} aria-hidden />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@flashfirehq.com"
                    autoComplete="email"
                    required
                    autoFocus
                    className={`${inputClass} pl-10`}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" loading={sendCode.isPending} disabled={!email.trim()}>
                Email me a code
              </Button>
              <button
                type="button"
                onClick={() => switchTo("password")}
                className="mx-auto flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800"
              >
                <KeyRound size={14} aria-hidden /> Use a password instead
              </button>
            </form>
          ) : step === "password" ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                passwordLogin.mutate();
              }}
              className="space-y-4"
            >
              <div>
                <label htmlFor="pw-email" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Email
                </label>
                <input
                  id="pw-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  autoFocus
                  className={inputClass}
                />
              </div>
              <Button type="submit" className="w-full" loading={passwordLogin.isPending} disabled={!email.trim() || !password}>
                Sign in
              </Button>
              <button
                type="button"
                onClick={() => switchTo("email")}
                className="mx-auto flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800"
              >
                <Mail size={14} aria-hidden /> Email me a code instead
              </button>
            </form>
          ) : (
            <form onSubmit={onCode} className="space-y-4">
              <p className="text-sm text-slate-600">
                We sent a 6-digit code to <span className="font-semibold text-slate-900">{email.trim().toLowerCase()}</span>. It
                works for 10 minutes.
              </p>
              <div>
                <label htmlFor="code" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Code
                </label>
                <input
                  id="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="\d{6}"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                  required
                  autoFocus
                  className={`${inputClass} text-center text-xl font-semibold tracking-[0.5em]`}
                />
              </div>
              <Button type="submit" className="w-full" loading={verify.isPending} disabled={code.length !== 6}>
                Sign in
              </Button>
              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  className="font-medium text-slate-600 hover:text-slate-900"
                  onClick={() => switchTo("email")}
                >
                  Use another email
                </button>
                <button
                  type="button"
                  className="font-medium text-orange-600 hover:text-orange-700 disabled:text-slate-400"
                  disabled={cooldown > 0 || sendCode.isPending}
                  onClick={() => {
                    verify.reset();
                    sendCode.mutate();
                  }}
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
