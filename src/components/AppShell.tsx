"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Alert, Spinner } from "./ui";
import { api, errorMessage } from "@/lib/api";
import { keys, useMe } from "@/lib/queries";
import type { OverviewResponse } from "@/lib/types";

const EMPLOYEE_LINKS = [
  { href: "/", label: "My attendance" },
  { href: "/leaves", label: "My leave" },
];

const ADMIN_LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/leaves", label: "Leave requests" },
  { href: "/admin/attendance", label: "Team attendance" },
  { href: "/admin/employees", label: "People" },
  { href: "/admin/settings", label: "Settings" },
];

function isActive(pathname: string, href: string) {
  if (href === "/" || href === "/admin") return pathname === href;
  return pathname.startsWith(href);
}

function PendingCount() {
  const { data } = useQuery({
    queryKey: keys.overview,
    queryFn: () => api<OverviewResponse>("/api/admin/overview"),
  });
  const count = data?.counts.pendingLeaves ?? 0;
  if (!count) return null;
  return (
    <span className="ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-orange-500 px-1.5 text-[11px] font-bold text-white">
      {count}
    </span>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const me = useMe();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    try {
      await api("/api/auth/logout", { body: {} });
    } finally {
      // Nothing from this account may survive into the next one on a shared machine.
      queryClient.clear();
      router.replace("/login");
    }
  }

  // The chrome and the page render right away; only the name and admin links wait for /api/me.
  const user = me.data?.user;
  const isAdmin = user?.role === "admin";
  const links = isAdmin ? [...EMPLOYEE_LINKS, ...ADMIN_LINKS] : EMPLOYEE_LINKS;

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="rounded-lg bg-orange-500 p-1.5">
              <CalendarCheck className="text-white" size={18} aria-hidden />
            </span>
            <span className="font-bold text-slate-900">Flashfire Attendance Portal</span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="hidden min-w-32 text-right sm:block">
              {user ? (
                <>
                  <p className="text-sm font-semibold leading-tight text-slate-900">{user.name}</p>
                  <p className="text-xs text-slate-500">{isAdmin ? "Admin" : user.email}</p>
                </>
              ) : (
                <div className="ml-auto h-8 w-28 animate-pulse rounded bg-slate-100" aria-hidden />
              )}
            </div>
            <button
              type="button"
              onClick={signOut}
              disabled={signingOut}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              <LogOut size={15} aria-hidden />
              Sign out
            </button>
          </div>
        </div>
        <nav aria-label="Main" className="mx-auto max-w-7xl overflow-x-auto px-4 sm:px-6">
          <ul className="flex gap-1">
            {links.map((link, i) => {
              const active = isActive(pathname, link.href);
              const startsAdmin = isAdmin && i === EMPLOYEE_LINKS.length;
              return (
                <li key={link.href} className={`flex items-center ${startsAdmin ? "ml-3 border-l border-slate-200 pl-3" : ""}`}>
                  <Link
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={`inline-flex items-center whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                      active ? "border-orange-500 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {link.label}
                    {link.href === "/admin/leaves" && <PendingCount />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {me.isError ? <Alert>{errorMessage(me.error)}</Alert> : children}
      </main>
    </div>
  );
}

/** Wraps admin pages. The API enforces this too; this just avoids showing a page full of 403s. */
export function AdminOnly({ children }: { children: ReactNode }) {
  const me = useMe();
  if (me.isPending) return <Spinner />;
  if (me.data?.user.role !== "admin") return <Alert>Only admins can open this page.</Alert>;
  return <>{children}</>;
}
