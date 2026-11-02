export const TABLE_STATUS = {
  free: { label: "Free", cls: "bg-emerald-950/60 border-emerald-500/50 text-emerald-300", dot: "bg-emerald-400" },
  reserved: { label: "Reserved", cls: "bg-sky-950/60 border-sky-500/50 text-sky-300", dot: "bg-sky-400" },
  seated: { label: "Seated", cls: "bg-amber-950/60 border-amber-500/60 text-amber-200", dot: "bg-amber-400" },
  cleaning: { label: "Needs cleaning", cls: "bg-rose-950/60 border-rose-500/50 text-rose-300", dot: "bg-rose-400" },
};

export const RES_STATUS = {
  pending: { label: "Pending", cls: "bg-yellow-500/10 text-yellow-300 border-yellow-500/30" },
  confirmed: { label: "Confirmed", cls: "bg-sky-500/10 text-sky-300 border-sky-500/30" },
  seated: { label: "Seated", cls: "bg-amber-500/10 text-amber-300 border-amber-500/30" },
  completed: { label: "Completed", cls: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30" },
  cancelled: { label: "Cancelled", cls: "bg-stone-500/10 text-stone-400 border-stone-500/30" },
  no_show: { label: "No-show", cls: "bg-rose-500/10 text-rose-300 border-rose-500/30" },
};

export const ZONES = ["Main Dining", "Bar", "Terrace"];

export function ResBadge({ status, testId }) {
  const s = RES_STATUS[status] || RES_STATUS.pending;
  return (
    <span data-testid={testId} className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${s.cls}`}>
      {s.label}
    </span>
  );
}
