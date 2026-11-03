"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { AdminOnly } from "@/components/AppShell";
import { dayCountLabel, LEAVE_TYPE_LABEL, leaveRange, PAY_LABEL } from "@/components/labels";
import { LeaveActions } from "@/components/LeaveActions";
import { Alert, Badge, Card, Empty, PageHeader, Spinner } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { keys } from "@/lib/queries";
import { formatDay, formatTimeIST } from "@/lib/time";
import type { LeaveListResponse, OverviewResponse } from "@/lib/types";

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className={`mt-1 text-3xl font-bold ${tone}`}>{value}</dd>
    </div>
  );
}

function Dashboard() {
  const overview = useQuery({ queryKey: keys.overview, queryFn: () => api<OverviewResponse>("/api/admin/overview"), refetchInterval: 60_000 });
  const pending = useQuery({
    queryKey: keys.adminLeaves("pending", ""),
    queryFn: () => api<LeaveListResponse>("/api/admin/leaves?status=pending"),
  });

  if (overview.isPending) return <Spinner />;
  if (overview.isError) return <Alert>{errorMessage(overview.error)}</Alert>;
  const o = overview.data;

  return (
    <>
      <PageHeader title="Dashboard" subtitle={`${formatDay(o.today)}${o.isOffDay ? " · weekly off or holiday" : ""}`} />
      <div className="space-y-6">
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Stat label="Team size" value={o.counts.employees} tone="text-slate-900" />
          <Stat label="Checked in" value={o.counts.checkedIn} tone="text-emerald-700" />
          <Stat label="On leave" value={o.counts.onLeave} tone="text-sky-700" />
          <Stat label="Not marked" value={o.counts.notMarked} tone="text-amber-600" />
          <Stat label="Requests waiting" value={o.counts.pendingLeaves} tone="text-orange-600" />
        </dl>

        <Card title="Waiting for a decision" action={<Link href="/admin/leaves" className="text-sm font-medium text-orange-600 hover:text-orange-700">All requests</Link>}>
          {pending.isPending ? (
            <Spinner />
          ) : pending.isError ? (
            <div className="p-5"><Alert>{errorMessage(pending.error)}</Alert></div>
          ) : pending.data.leaves.length === 0 ? (
            <Empty>Nothing waiting. Nice.</Empty>
          ) : (
            <ul className="divide-y divide-slate-200">
              {pending.data.leaves.slice(0, 8).map((leave) => (
                <li key={leave.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">{leave.user.name}</p>
                    <p className="text-sm text-slate-600">
                      {leaveRange(leave.fromDate, leave.toDate, leave.halfDay)} · {LEAVE_TYPE_LABEL[leave.type]} · {dayCountLabel(leave.dayCount)}
                    </p>
                    <p className="truncate text-sm text-slate-500">{leave.reason}</p>
                  </div>
                  <LeaveActions leave={leave} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card title={`Checked in (${o.checkedIn.length})`}>
            {o.checkedIn.length === 0 ? <Empty>No one yet.</Empty> : (
              <ul className="divide-y divide-slate-100">
                {o.checkedIn.map((row) => (
                  <li key={row.user.id} className="flex items-center justify-between px-5 py-2.5 text-sm">
                    <span className="font-medium text-slate-900">{row.user.name}</span>
                    <span className="text-slate-500">{formatTimeIST(row.checkInAt)}{row.checkOutAt ? ` to ${formatTimeIST(row.checkOutAt)}` : ""}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title={`On leave (${o.onLeave.length})`}>
            {o.onLeave.length === 0 ? <Empty>No one on leave.</Empty> : (
              <ul className="divide-y divide-slate-100">
                {o.onLeave.map((row) => (
                  <li key={row.user.id} className="flex items-center justify-between gap-2 px-5 py-2.5 text-sm">
                    <span className="font-medium text-slate-900">{row.user.name}{row.halfDay ? " (half)" : ""}</span>
                    {row.payType && <Badge tone={PAY_LABEL[row.payType].tone}>{PAY_LABEL[row.payType].label}</Badge>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title={`Not marked (${o.notMarked.length})`}>
            {o.notMarked.length === 0 ? <Empty>Everyone is accounted for.</Empty> : (
              <ul className="divide-y divide-slate-100">
                {o.notMarked.map((user) => (
                  <li key={user.id} className="px-5 py-2.5 text-sm">
                    <p className="font-medium text-slate-900">{user.name}</p>
                    <p className="truncate text-xs text-slate-500">{user.email}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

export default function AdminDashboardPage() {
  return <AdminOnly><Dashboard /></AdminOnly>;
}
