"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { useState } from "react";
import { AdminOnly } from "@/components/AppShell";
import { cellStyle, DAY_STYLE, LEAVE_TYPE_LABEL } from "@/components/labels";
import { Legend } from "@/components/Legend";
import { MonthNav } from "@/components/MonthNav";
import { Alert, Button, Card, Empty, Field, inputClass, Modal, PageHeader, Spinner } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { keys } from "@/lib/queries";
import { useToday } from "@/lib/clock";
import { formatDay, formatTimeIST, weekdayOf } from "@/lib/time";
import type { DayCell, OverrideStatus, PersonMonth, PublicUser, TeamMonthResponse } from "@/lib/types";

const OPTIONS: { value: OverrideStatus | null; label: string }[] = [
  { value: "present", label: "Present" },
  { value: "half_day", label: "Half day" },
  { value: "absent", label: "Absent" },
  { value: null, label: "No override" },
];

function EditDay({ user, cell, today, onClose }: { user: PublicUser; cell: DayCell; today: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [override, setOverride] = useState<OverrideStatus | null>(cell.override);
  const [note, setNote] = useState(cell.overrideNote ?? "");
  const save = useMutation({
    mutationFn: () => api("/api/admin/attendance", { method: "PUT", body: { userId: user.id, date: cell.day, override, note } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      onClose();
    },
  });
  const future = cell.day > today;

  return (
    <Modal open onClose={onClose} title={`${user.name} · ${formatDay(cell.day)}`}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <dl className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 px-4 py-3 text-sm">
          <dt className="text-slate-500">Shows as</dt><dd className="font-semibold">{DAY_STYLE[cell.status].label}</dd>
          <dt className="text-slate-500">Check in</dt><dd>{formatTimeIST(cell.checkInAt)}</dd>
          <dt className="text-slate-500">Check out</dt><dd>{formatTimeIST(cell.checkOutAt)}</dd>
          {cell.leave && (<><dt className="text-slate-500">Leave</dt><dd>{LEAVE_TYPE_LABEL[cell.leave.type]}{cell.leave.halfDay ? ", half" : ""}{cell.leave.payType ? `, ${cell.leave.payType}` : ""}</dd></>)}
          {cell.holiday && (<><dt className="text-slate-500">Holiday</dt><dd>{cell.holiday}</dd></>)}
        </dl>
        {future ? (
          <Alert tone="orange">You can only correct today or earlier.</Alert>
        ) : (
          <>
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium text-slate-700">Mark as</legend>
              <div className="grid grid-cols-2 gap-2">
                {OPTIONS.map((o) => (
                  <label key={o.label} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${override === o.value ? "border-orange-500 bg-orange-50 text-orange-800" : "border-slate-300 text-slate-700"}`}>
                    <input type="radio" name="override" checked={override === o.value} onChange={() => setOverride(o.value)} className="accent-orange-500" />
                    {o.label}
                  </label>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-slate-500">An override beats check-ins and approved leave for this day.</p>
            </fieldset>
            {override && (
              <Field label="Note (optional)" htmlFor="override-note">
                <input id="override-note" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} placeholder="Forgot to check in, client visit..." />
              </Field>
            )}
            {save.isError && <Alert>{errorMessage(save.error)}</Alert>}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={onClose}>Cancel</Button>
              <Button type="submit" loading={save.isPending}>Save</Button>
            </div>
          </>
        )}
      </form>
    </Modal>
  );
}

function toCsv(month: string, people: PersonMonth[]): string {
  const days = people[0]?.days.map((d) => d.day) ?? [];
  const head = ["Name", "Email", ...days.map((d) => d.slice(8)), "Present", "Half days", "Absent", "Paid leave", "Unpaid leave"];
  const rows = people.map((p) => [
    p.user.name,
    p.user.email,
    ...p.days.map((d) => (d.status === "leave" ? (d.leave?.payType === "unpaid" ? "UL" : "PL") : DAY_STYLE[d.status].short)),
    p.summary.present, p.summary.halfDay, p.summary.absent, p.summary.paidLeave, p.summary.unpaidLeave,
  ]);
  const escape = (v: string | number) => {
    const s = String(v);
    // Leading =,+,-,@ would run as a formula in Excel or Sheets.
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return [`Attendance ${month}`, head.join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
}

function download(month: string, people: PersonMonth[]) {
  const blob = new Blob([toCsv(month, people)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `attendance-${month}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function Grid() {
  const today = useToday();
  const [picked, setPicked] = useState<string | null>(null);
  const month = picked ?? today?.slice(0, 7) ?? null;
  const [editing, setEditing] = useState<{ user: PublicUser; cell: DayCell } | null>(null);
  const team = useQuery({
    queryKey: keys.team(month ?? ""),
    queryFn: () => api<TeamMonthResponse>(`/api/admin/attendance?month=${month}`),
    enabled: month !== null,
  });

  return (
    <>
      <PageHeader
        title="Team attendance"
        subtitle="Click any day to see times or correct it."
        action={
          <div className="flex flex-wrap items-center gap-2">
            {month && <MonthNav month={month} onChange={setPicked} />}
            <Button variant="secondary" disabled={!team.data?.people.length} onClick={() => team.data && download(team.data.month, team.data.people)}>
              <Download size={16} aria-hidden /> CSV
            </Button>
          </div>
        }
      />
      <Card>
        {team.isPending ? (
          <Spinner />
        ) : team.isError ? (
          <div className="p-5"><Alert>{errorMessage(team.error)}</Alert></div>
        ) : team.data.people.length === 0 ? (
          <Empty>No active people yet.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  <th scope="col" className="sticky left-0 z-10 min-w-44 border-b border-slate-200 bg-white px-4 py-2 text-left font-semibold text-slate-700">Name</th>
                  {team.data.people[0].days.map((d) => {
                    const wd = weekdayOf(d.day);
                    return (
                      <th key={d.day} scope="col" className={`border-b border-slate-200 px-0.5 py-2 text-center text-xs font-medium ${d.day === team.data.today ? "text-orange-600" : "text-slate-500"}`}>
                        <div>{"SMTWTFS"[wd]}</div>
                        <div className="font-semibold">{Number(d.day.slice(8))}</div>
                      </th>
                    );
                  })}
                  {["P", "½", "A", "PL", "UL"].map((h) => (
                    <th key={h} scope="col" className="border-b border-l border-slate-200 px-2 py-2 text-center text-xs font-semibold text-slate-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {team.data.people.map((p) => (
                  <tr key={p.user.id} className="group">
                    <th scope="row" className="sticky left-0 z-10 border-b border-slate-100 bg-white px-4 py-1.5 text-left font-medium text-slate-900 group-hover:bg-slate-50">
                      <div className="truncate">{p.user.name}</div>
                    </th>
                    {p.days.map((cell) => {
                      const style = cellStyle(cell);
                      const label = style.short;
                      return (
                        <td key={cell.day} className="border-b border-slate-100 p-0.5 group-hover:bg-slate-50">
                          <button
                            type="button"
                            onClick={() => setEditing({ user: p.user, cell })}
                            aria-label={`${p.user.name}, ${formatDay(cell.day)}: ${style.label}`}
                            title={`${formatDay(cell.day)}: ${style.label}${cell.override ? " (admin)" : ""}`}
                            className={`relative flex h-8 w-full min-w-7 items-center justify-center rounded text-xs font-bold hover:brightness-95 focus-visible:outline-2 focus-visible:outline-orange-500 ${style.cell}`}
                          >
                            {label}
                            {cell.override && <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-slate-700" aria-hidden />}
                          </button>
                        </td>
                      );
                    })}
                    <td className="border-b border-l border-slate-100 px-2 text-center font-semibold text-emerald-700">{p.summary.present}</td>
                    <td className="border-b border-slate-100 px-2 text-center font-semibold text-lime-700">{p.summary.halfDay}</td>
                    <td className="border-b border-slate-100 px-2 text-center font-semibold text-red-600">{p.summary.absent}</td>
                    <td className="border-b border-slate-100 px-2 text-center font-semibold text-sky-700">{p.summary.paidLeave}</td>
                    <td className="border-b border-slate-100 px-2 text-center font-semibold text-orange-600">{p.summary.unpaidLeave}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3">
          <Legend />
          <p className="text-xs text-slate-500">Dot = corrected by an admin</p>
        </div>
      </Card>
      {editing && team.data && <EditDay user={editing.user} cell={editing.cell} today={team.data.today} onClose={() => setEditing(null)} />}
    </>
  );
}

export default function TeamAttendancePage() {
  return <AdminOnly><Grid /></AdminOnly>;
}
