"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { AdminOnly } from "@/components/AppShell";
import { Alert, Button, Card, PageHeader, Spinner, inputClass } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { keys } from "@/lib/queries";
import { formatDay } from "@/lib/time";
import type { AppSettings, SettingsResponse } from "@/lib/types";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function Editor({ initial }: { initial: AppSettings }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(initial);
  const [domain, setDomain] = useState("");
  const [holiday, setHoliday] = useState({ date: "", name: "" });
  const save = useMutation({
    mutationFn: () => api<SettingsResponse>("/api/admin/settings", { method: "PUT", body: draft }),
    onSuccess: (data) => {
      setDraft(data.settings);
      queryClient.setQueryData(keys.settings, data);
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
    },
  });
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  function addDomain() {
    const clean = domain.trim().toLowerCase().replace(/^@/, "");
    if (clean && !draft.allowedDomains.includes(clean)) setDraft({ ...draft, allowedDomains: [...draft.allowedDomains, clean] });
    setDomain("");
  }

  function addHoliday() {
    if (!holiday.date || !holiday.name.trim()) return;
    const rest = draft.holidays.filter((h) => h.date !== holiday.date);
    setDraft({ ...draft, holidays: [...rest, { date: holiday.date, name: holiday.name.trim() }].sort((a, b) => a.date.localeCompare(b.date)) });
    setHoliday({ date: "", name: "" });
  }

  return (
    <div className="space-y-6">
      <Card title="Company email domains">
        <div className="space-y-3 p-5">
          <p className="text-sm text-slate-600">Anyone with an email at these domains can sign in and joins as an employee.</p>
          <ul className="flex flex-wrap gap-2">
            {draft.allowedDomains.length === 0 && <li className="text-sm text-slate-500">No domains. Only people you add by email can sign in.</li>}
            {draft.allowedDomains.map((d) => (
              <li key={d} className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-1 pl-3 pr-1 text-sm font-medium text-slate-800">
                @{d}
                <button type="button" onClick={() => setDraft({ ...draft, allowedDomains: draft.allowedDomains.filter((x) => x !== d) })} className="rounded-full p-0.5 text-slate-500 hover:bg-slate-200 hover:text-slate-800" aria-label={`Remove ${d}`}>
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
          <form className="flex max-w-md gap-2" onSubmit={(e) => { e.preventDefault(); addDomain(); }}>
            <label htmlFor="domain" className="sr-only">Domain</label>
            <input id="domain" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="company.com" className={inputClass} />
            <Button type="submit" variant="secondary" disabled={!domain.trim()}><Plus size={16} aria-hidden /> Add</Button>
          </form>
        </div>
      </Card>

      <Card title="Weekly offs">
        <div className="space-y-3 p-5">
          <p className="text-sm text-slate-600">Leave on these days costs nothing, and not checking in isn’t counted as absent.</p>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((label, i) => {
              const on = draft.weeklyOffDays.includes(i);
              return (
                <button
                  key={label}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setDraft({ ...draft, weeklyOffDays: on ? draft.weeklyOffDays.filter((d) => d !== i) : [...draft.weeklyOffDays, i].sort() })}
                  className={`w-14 rounded-lg border py-2 text-sm font-semibold ${on ? "border-orange-500 bg-orange-50 text-orange-800" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      <Card title="Holidays">
        <div className="space-y-3 p-5">
          <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); addHoliday(); }}>
            <label htmlFor="holiday-date" className="sr-only">Date</label>
            <input id="holiday-date" type="date" value={holiday.date} onChange={(e) => setHoliday({ ...holiday, date: e.target.value })} className={`${inputClass} w-44`} />
            <label htmlFor="holiday-name" className="sr-only">Name</label>
            <input id="holiday-name" value={holiday.name} maxLength={80} onChange={(e) => setHoliday({ ...holiday, name: e.target.value })} placeholder="Diwali" className={`${inputClass} w-56`} />
            <Button type="submit" variant="secondary" disabled={!holiday.date || !holiday.name.trim()}><Plus size={16} aria-hidden /> Add</Button>
          </form>
          {draft.holidays.length === 0 ? (
            <p className="text-sm text-slate-500">No holidays added.</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {draft.holidays.map((h) => (
                <li key={h.date} className="flex items-center justify-between px-4 py-2 text-sm">
                  <span><span className="inline-block w-36 text-slate-500">{formatDay(h.date)} {h.date.slice(0, 4)}</span><span className="font-medium text-slate-900">{h.name}</span></span>
                  <button type="button" onClick={() => setDraft({ ...draft, holidays: draft.holidays.filter((x) => x.date !== h.date) })} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Remove ${h.name}`}>
                    <Trash2 size={15} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-slate-500">Leave requests already sent keep the day count they had when they were made.</p>
        </div>
      </Card>

      {(dirty || save.isError || save.isSuccess) && (
      <div className="sticky bottom-4 flex items-center justify-end gap-3 rounded-xl border border-slate-200 bg-white/95 px-5 py-3 shadow-lg backdrop-blur">
        {save.isError && <p className="mr-auto text-sm font-medium text-red-600">{errorMessage(save.error)}</p>}
        {save.isSuccess && !dirty && <p className="mr-auto text-sm font-medium text-emerald-700">Saved.</p>}
        {dirty && <p className="mr-auto text-sm text-slate-500">You have unsaved changes.</p>}
        <Button variant="secondary" disabled={!dirty || save.isPending} onClick={() => setDraft(initial)}>Discard</Button>
        <Button disabled={!dirty} loading={save.isPending} onClick={() => save.mutate()}>Save settings</Button>
      </div>
      )}
    </div>
  );
}

function SettingsPage() {
  const settings = useQuery({ queryKey: keys.settings, queryFn: () => api<SettingsResponse>("/api/admin/settings") });
  return (
    <>
      <PageHeader title="Settings" subtitle="Who can sign in, and which days don't count." />
      {settings.isPending ? <Spinner /> : settings.isError ? <Alert>{errorMessage(settings.error)}</Alert> : <Editor key={JSON.stringify(settings.data.settings)} initial={settings.data.settings} />}
    </>
  );
}

export default function AdminSettingsPage() {
  return <AdminOnly><SettingsPage /></AdminOnly>;
}
