export const TABLE_STATUS = {
  free: { label: "Free", cls: "bg-emerald-50 border-emerald-300 text-emerald-700", dot: "bg-emerald-500" },
  reserved: { label: "Reserved", cls: "bg-sky-50 border-sky-300 text-sky-700", dot: "bg-sky-500" },
  seated: { label: "Seated", cls: "bg-amber-50 border-amber-400 text-amber-700", dot: "bg-amber-500" },
  cleaning: { label: "Needs cleaning", cls: "bg-rose-50 border-rose-300 text-rose-700", dot: "bg-rose-500" },
};

export const RES_STATUS = {
  pending: { label: "Pending", cls: "bg-yellow-50 text-yellow-800 ring-yellow-200" },
  confirmed: { label: "Confirmed", cls: "bg-[#120092]/[0.06] text-[#120092] ring-[#120092]/20" },
  seated: { label: "Seated", cls: "bg-amber-50 text-amber-700 ring-amber-200" },
  completed: { label: "Completed", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  cancelled: { label: "Cancelled", cls: "bg-slate-100 text-slate-500 ring-slate-200" },
  no_show: { label: "No-show", cls: "bg-rose-50 text-rose-700 ring-rose-200" },
};

export const ZONES = ["Main Dining", "Bar", "Terrace"];

export function ResBadge({ status, testId }) {
  const s = RES_STATUS[status] || RES_STATUS.pending;
  return (
    <span data-testid={testId} className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${s.cls}`}>
      {s.label}
    </span>
  );
}

export const btnPrimary = "inline-flex items-center justify-center gap-2 rounded-full bg-[#120092] px-5 py-2.5 text-sm font-semibold text-white transition-[background-color,transform] duration-200 hover:bg-[#1d0fc4] active:scale-[0.98] disabled:opacity-60";
export const btnGhost = "inline-flex items-center justify-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors duration-200 hover:border-[#120092]/40 hover:text-[#120092]";
export const card = "rounded-2xl border border-border bg-white card-shadow";
export const eyebrow = "text-xs font-semibold uppercase tracking-[0.14em] text-[#120092]";
