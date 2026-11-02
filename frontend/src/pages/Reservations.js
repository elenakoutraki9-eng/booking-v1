import { useEffect, useState, useCallback } from "react";
import { Plus, Crown, AlertTriangle, MoreHorizontal, Search } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiError, toDateStr, prettyDate } from "../lib/api";
import { RES_STATUS, ResBadge, btnPrimary, card } from "../lib/status";
import { PageHeader } from "../components/StaffLayout";
import { ReservationDialog, CompleteDialog } from "../components/ReservationDialog";
import { DateDrum, shiftDate } from "../components/DateDrum";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "../components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../components/ui/dropdown-menu";

const pill = "rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset transition-colors";

export function ReservationActions({ r, onChange, onEdit }) {
  const [completing, setCompleting] = useState(false);
  const run = async (fn, msg) => {
    try {
      await fn();
      if (msg) toast.success(msg);
      onChange();
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };
  const setStatus = (status) => run(() => api.patch(`/reservations/${r.id}`, { status }), `Marked ${RES_STATUS[status].label.toLowerCase()}`);
  const remove = () => window.confirm("Delete this reservation?") && run(() => api.delete(`/reservations/${r.id}`), "Reservation deleted");
  return (
    <>
      {r.status === "pending" && <button onClick={() => setStatus("confirmed")} data-testid={`res-confirm-${r.id}`} className={`${pill} bg-[#120092] text-white ring-[#120092] hover:bg-[#1d0fc4]`}>Confirm</button>}
      {r.status === "confirmed" && <button onClick={() => setStatus("seated")} data-testid={`res-seat-${r.id}`} className={`${pill} bg-amber-50 text-amber-700 ring-amber-300 hover:bg-amber-100`}>Seat</button>}
      {r.status === "seated" && <button onClick={() => setCompleting(true)} data-testid={`res-complete-${r.id}`} className={`${pill} bg-emerald-50 text-emerald-700 ring-emerald-300 hover:bg-emerald-100`}>Finish</button>}
      <DropdownMenu>
        <DropdownMenuTrigger data-testid={`res-menu-${r.id}`} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-900"><MoreHorizontal className="h-4 w-4" /></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {onEdit && <DropdownMenuItem onClick={() => onEdit(r)} data-testid={`res-edit-${r.id}`}>Edit / assign table</DropdownMenuItem>}
          {["pending", "confirmed", "seated"].filter((s) => s !== r.status).map((s) => (
            <DropdownMenuItem key={s} onClick={() => setStatus(s)} data-testid={`res-set-${s}-${r.id}`}>Mark {RES_STATUS[s].label.toLowerCase()}</DropdownMenuItem>
          ))}
          <DropdownMenuItem onClick={() => setStatus("no_show")} data-testid={`res-set-no_show-${r.id}`}>Mark no-show</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setStatus("cancelled")} data-testid={`res-set-cancelled-${r.id}`}>Cancel booking</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={remove} className="text-rose-600" data-testid={`res-delete-${r.id}`}>Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <CompleteDialog r={r} open={completing} onOpenChange={setCompleting} onDone={onChange} />
    </>
  );
}

function ResRow({ r, onChange, onEdit }) {
  return (
    <div className="flex flex-wrap items-center gap-4 px-5 py-4 transition-colors hover:bg-slate-50" data-testid={`res-row-${r.id}`}>
      <span className="rounded-lg bg-[#120092]/[0.06] px-2 py-1 font-mono text-sm font-medium text-[#120092]">{r.time}</span>
      <button onClick={() => onEdit(r)} className="min-w-[180px] flex-1 text-left" data-testid={`res-open-${r.id}`}>
        <div className="flex items-center gap-2">
          {r.vip && <Crown className="h-3.5 w-3.5 text-[#120092]" />}
          <span className="font-semibold">{r.guest_name}</span>
          <span className="font-mono text-[11px] text-slate-400">#{r.ref}</span>
        </div>
        <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-slate-500">
          <span>{r.party_size} guests</span>
          {r.zone && <span>{r.zone}</span>}
          <span className={r.table_name ? "font-medium text-slate-700" : "font-medium text-amber-600"}>{r.table_name || "No table"}</span>
          <span className="capitalize">{r.source}</span>
        </div>
        {(r.allergies || r.notes) && (
          <div className="mt-1 flex items-center gap-1 text-xs font-medium text-rose-600">
            {r.allergies && <AlertTriangle className="h-3 w-3" />}{[r.allergies, r.notes].filter(Boolean).join(" · ")}
          </div>
        )}
      </button>
      <ResBadge status={r.status} testId={`res-status-${r.id}`} />
      <div className="flex items-center gap-2"><ReservationActions r={r} onChange={onChange} onEdit={onEdit} /></div>
    </div>
  );
}

const shift = shiftDate;
const listSlide = {
  enter: (dir) => ({ x: dir * 48, opacity: 0 }),
  center: { x: 0, opacity: 1, transition: { type: "spring", stiffness: 260, damping: 28 } },
  exit: (dir) => ({ x: dir * -48, opacity: 0, transition: { duration: 0.15 } }),
};

export default function Reservations() {
  const [date, setDate] = useState(toDateStr(new Date()));
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState(null);
  const [week, setWeek] = useState({});
  const [loaded, setLoaded] = useState({ date: null, dir: 1 });

  const load = useCallback(async () => {
    const [d, w] = await Promise.all([
      api.get("/reservations", { params: { date, q: q || undefined } }),
      api.get("/reservations", { params: { start: shift(date, -6), end: shift(date, 6), status: "pending,confirmed,seated,completed" } }),
    ]);
    setItems(d.data);
    setLoaded((prev) => (prev.date === date ? prev : { date, dir: prev.date && date < prev.date ? -1 : 1 }));
    const counts = {};
    w.data.forEach((r) => { counts[r.date] = (counts[r.date] || 0) + r.party_size; });
    setWeek(counts);
  }, [date, q]);

  useEffect(() => {
    load();
  }, [load]);

  const shown = items.filter((r) => filter === "all" || r.status === filter);
  const covers = items.filter((r) => !["cancelled", "no_show"].includes(r.status)).reduce((a, r) => a + r.party_size, 0);

  return (
    <div>
      <PageHeader eyebrow="Bookings" title="Reservations">
        <button onClick={() => setEditing({})} data-testid="new-reservation-btn" className={`${btnPrimary} brand-shadow`}><Plus className="h-4 w-4" /> New reservation</button>
      </PageHeader>

      <div className="mb-5 flex items-center gap-2">
        <DateDrum date={date} onChange={setDate} counts={week} />
        <Input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} data-testid="date-picker-input" className="hidden h-11 w-40 rounded-xl bg-white md:block" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {["all", ...Object.keys(RES_STATUS)].map((s) => (
          <button key={s} onClick={() => setFilter(s)} data-testid={`filter-${s}`}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${filter === s ? "border-[#120092] bg-[#120092]/[0.06] text-[#120092]" : "border-border bg-white text-slate-500 hover:text-slate-900"}`}>
            {s === "all" ? "All" : RES_STATUS[s].label} <span className="ml-1 opacity-60">{s === "all" ? items.length : items.filter((r) => r.status === s).length}</span>
          </button>
        ))}
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, phone, ref" data-testid="res-search-input" className="rounded-xl bg-white pl-9" />
        </div>
      </div>

      <div className={`${card} overflow-hidden`}>
        <AnimatePresence mode="wait" initial={false} custom={loaded.dir}>
          <motion.div key={loaded.date || "init"} custom={loaded.dir} variants={listSlide} initial="enter" animate="center" exit="exit" data-testid="res-day-list">
            <div className="flex items-center justify-between border-b border-border px-5 py-3 text-sm">
              <span className="font-semibold">{prettyDate(loaded.date || date)}</span><span className="text-slate-500" data-testid="day-covers">{covers} covers</span>
            </div>
            {shown.length === 0 && <p className="py-16 text-center text-sm text-slate-400" data-testid="res-empty">No reservations for this day.</p>}
            <div className="divide-y divide-border">
              {shown.map((r) => <ResRow key={r.id} r={r} onChange={load} onEdit={setEditing} />)}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <ReservationDialog value={editing} defaultDate={date} onClose={() => setEditing(null)} onSaved={load} />
    </div>
  );
}
