import { LEGEND } from "./labels";

export function Legend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-600">
      {LEGEND.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span className={`inline-flex h-5 w-5 items-center justify-center rounded text-[11px] font-bold ${item.cell}`}>{item.short}</span>
          {item.label}
        </li>
      ))}
    </ul>
  );
}
