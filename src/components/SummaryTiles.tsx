import type { MonthSummary } from "@/lib/types";

export function SummaryTiles({ summary }: { summary: MonthSummary }) {
  const tiles = [
    { label: "Present", value: summary.present, accent: "text-emerald-700" },
    { label: "Half days", value: summary.halfDay, accent: "text-lime-700" },
    { label: "Absent", value: summary.absent, accent: "text-red-600" },
    { label: "Paid leave", value: summary.paidLeave, accent: "text-sky-700" },
    { label: "Unpaid leave", value: summary.unpaidLeave, accent: "text-orange-600" },
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {tiles.map((t) => (
        <div key={t.label} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <dt className="text-xs font-medium text-slate-500">{t.label}</dt>
          <dd className={`mt-1 text-2xl font-bold ${t.accent}`}>{t.value}</dd>
        </div>
      ))}
    </dl>
  );
}
