"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useToday } from "@/lib/clock";
import { formatMonth, shiftMonth } from "@/lib/time";

export function MonthNav({ month, onChange }: { month: string; onChange: (month: string) => void }) {
  const today = useToday();
  const current = today?.slice(0, 7) ?? month;
  const isCurrent = month === current;
  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={() => onChange(shiftMonth(month, -1))} className="rounded-lg border border-slate-300 bg-white p-2 text-slate-600 hover:bg-slate-50" aria-label="Previous month">
        <ChevronLeft size={16} />
      </button>
      <span className="min-w-36 text-center text-sm font-semibold text-slate-900">{formatMonth(month)}</span>
      <button type="button" onClick={() => onChange(shiftMonth(month, 1))} className="rounded-lg border border-slate-300 bg-white p-2 text-slate-600 hover:bg-slate-50" aria-label="Next month">
        <ChevronRight size={16} />
      </button>
      {!isCurrent && (
        <button type="button" onClick={() => onChange(current)} className="ml-1 rounded-lg px-2.5 py-2 text-sm font-medium text-orange-600 hover:bg-orange-50">
          This month
        </button>
      )}
    </div>
  );
}
