"use client";

import { LoaderCircle, X } from "lucide-react";
import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost" | "success";

const variants: Record<Variant, string> = {
  primary: "bg-orange-500 text-white hover:bg-orange-600 shadow-sm shadow-orange-500/20",
  secondary: "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50",
  danger: "bg-white text-red-600 border border-red-200 hover:bg-red-50",
  success: "bg-emerald-600 text-white hover:bg-emerald-700",
  ghost: "text-slate-600 hover:bg-slate-100",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className = "",
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md"; loading?: boolean }) {
  const sizing = size === "sm" ? "px-3 py-1.5 text-sm" : "px-4 py-2.5 text-sm";
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 disabled:cursor-not-allowed disabled:opacity-60 ${sizing} ${variants[variant]} ${className}`}
    >
      {loading && <LoaderCircle className="animate-spin" size={16} aria-hidden />}
      {children}
    </button>
  );
}

export function Card({ title, action, children, className = "" }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white ${className}`}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

const tones = {
  slate: "bg-slate-100 text-slate-700",
  orange: "bg-orange-100 text-orange-800",
  green: "bg-emerald-100 text-emerald-800",
  red: "bg-red-100 text-red-700",
  blue: "bg-sky-100 text-sky-800",
  amber: "bg-amber-100 text-amber-800",
} as const;

export type Tone = keyof typeof tones;

export function Badge({ tone = "slate", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

export function Alert({ tone = "red", children }: { tone?: "red" | "orange" | "green"; children: ReactNode }) {
  const styles = {
    red: "border-red-200 bg-red-50 text-red-700",
    orange: "border-orange-200 bg-orange-50 text-orange-800",
    green: "border-emerald-200 bg-emerald-50 text-emerald-800",
  };
  return (
    <div role={tone === "red" ? "alert" : "status"} className={`rounded-lg border px-4 py-3 text-sm font-medium ${styles[tone]}`}>
      {children}
    </div>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500" role="status">
      <LoaderCircle className="animate-spin" size={18} aria-hidden />
      {label}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="px-5 py-10 text-center text-sm text-slate-500">{children}</p>;
}

export const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:bg-slate-50";

export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

/** Native <dialog>: focus trap, Escape to close, and backdrop come from the browser. */
export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl"
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
        <h2 className="text-base font-semibold">{title}</h2>
        <button type="button" onClick={onClose} className="rounded-md p-1 text-slate-500 hover:bg-slate-100" aria-label="Close">
          <X size={18} />
        </button>
      </div>
      <div className="px-5 py-4">{open && children}</div>
    </dialog>
  );
}
