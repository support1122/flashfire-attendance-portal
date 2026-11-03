"use client";

import { useState } from "react";
import { cellStyle, DAY_STYLE, LEAVE_TYPE_LABEL } from "./labels";
import { formatDay, formatTimeIST, weekdayOf } from "@/lib/time";
import type { DayCell } from "@/lib/types";

const HEADINGS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function describe(cell: DayCell): string {
  const parts = [DAY_STYLE[cell.status].label];
  if (cell.leave) parts.push(`${LEAVE_TYPE_LABEL[cell.leave.type]} leave${cell.leave.halfDay ? ", half day" : ""}${cell.leave.payType ? `, ${cell.leave.payType}` : ""}`);
  if (cell.holiday) parts.push(cell.holiday);
  if (cell.checkInAt) parts.push(`in ${formatTimeIST(cell.checkInAt)}, out ${formatTimeIST(cell.checkOutAt)}`);
  if (cell.override) parts.push(`set by admin${cell.overrideNote ? `: ${cell.overrideNote}` : ""}`);
  return parts.join(" · ");
}

export function MonthCalendar({ days, today }: { days: DayCell[]; today: string }) {
  const [selected, setSelected] = useState<string | null>(null);
  // Monday-first grid: pad the first week with blanks.
  const lead = (weekdayOf(days[0].day) + 6) % 7;
  const picked = days.find((d) => d.day === selected) ?? null;

  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5 text-center">
        {HEADINGS.map((h) => (
          <div key={h} className="pb-1 text-xs font-semibold text-slate-500">{h}</div>
        ))}
        {Array.from({ length: lead }, (_, i) => <div key={`pad-${i}`} />)}
        {days.map((cell) => {
          const style = cellStyle(cell);
          const isToday = cell.day === today;
          return (
            <button
              key={cell.day}
              type="button"
              onClick={() => setSelected(cell.day === selected ? null : cell.day)}
              aria-label={`${formatDay(cell.day)}: ${describe(cell)}`}
              aria-pressed={cell.day === selected}
              className={`flex h-12 flex-col items-center justify-center rounded-lg sm:h-14 text-sm transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-orange-500 ${style.cell} ${
                isToday ? "outline-2 outline-offset-1 outline-slate-900" : ""
              } ${cell.day === selected ? "ring-2 ring-orange-500" : ""}`}
            >
              <span className="font-semibold">{Number(cell.day.slice(8))}</span>
              {style.short && <span className="text-[10px] font-bold leading-none">{style.short}</span>}
            </button>
          );
        })}
      </div>
      <p className="mt-3 min-h-5 text-sm text-slate-600" aria-live="polite">
        {picked ? <><strong className="text-slate-900">{formatDay(picked.day)}</strong> · {describe(picked)}</> : "Pick a day to see its details."}
      </p>
    </div>
  );
}
