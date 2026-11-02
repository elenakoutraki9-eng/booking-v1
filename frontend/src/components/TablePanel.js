import { useEffect, useState } from "react";
import { toast } from "sonner";
import { UserPlus, Sparkles, Trash2, Pencil, MousePointerClick } from "lucide-react";
import { api, formatApiError, toDateStr } from "../lib/api";
import { TABLE_STATUS, ResBadge, btnPrimary, btnGhost, card } from "../lib/status";
import { useZones } from "../context/SiteContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { CompleteDialog } from "./ReservationDialog";

const L = ({ children, icon: Icon }) => (
  <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{Icon && <Icon className="h-3.5 w-3.5" />}{children}</div>
);

async function run(fn, msg, after) {
  try {
    await fn();
    if (msg) toast.success(msg);
    after();
  } catch (e) {
    toast.error(formatApiError(e));
  }
}

export function TableFormDialog({ open, onOpenChange, onSaved, table }) {
  const zones = useZones();
  const [f, setF] = useState({ name: "", capacity: 4, zone: "", shape: "round" });
  useEffect(() => {
    if (open) setF(table ? { name: table.name, capacity: table.capacity, zone: table.zone, shape: table.shape } : { name: "", capacity: 4, zone: zones[0] || "", shape: "round", x: 45, y: 45 });
  }, [open, table, zones]);
  const save = (e) => {
    e.preventDefault();
    const body = { ...f, capacity: Number(f.capacity) };
    run(() => (table ? api.patch(`/tables/${table.id}`, body) : api.post("/tables", body)), table ? "Table updated" : "Table added", () => { onOpenChange(false); onSaved(); });
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl bg-white sm:max-w-sm" data-testid="table-form-dialog">
        <DialogHeader><DialogTitle className="font-display text-2xl font-bold">{table ? "Edit table" : "Add table"}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="grid grid-cols-2 gap-3">
          <Input placeholder="Name (e.g. T7)" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required data-testid="tableform-name" />
          <Input type="number" min={1} max={30} value={f.capacity} onChange={(e) => setF({ ...f, capacity: e.target.value })} required data-testid="tableform-capacity" />
          <Select value={f.zone} onValueChange={(v) => setF({ ...f, zone: v })}>
            <SelectTrigger data-testid="tableform-zone"><SelectValue /></SelectTrigger>
            <SelectContent>{[...new Set([...zones, f.zone].filter(Boolean))].map((z) => <SelectItem key={z} value={z}>{z}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={f.shape} onValueChange={(v) => setF({ ...f, shape: v })}>
            <SelectTrigger data-testid="tableform-shape"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="round">Round</SelectItem>
              <SelectItem value="square">Square</SelectItem>
              <SelectItem value="rect">Long</SelectItem>
            </SelectContent>
          </Select>
          <button type="submit" data-testid="tableform-save" className={`${btnPrimary} col-span-2 mt-2`}>Save table</button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function WalkInForm({ table, onDone }) {
  const [f, setF] = useState({ name: "", party_size: Math.min(2, table.capacity), phone: "" });
  const submit = (e) => {
    e.preventDefault();
    run(() => api.post(`/tables/${table.id}/walk-in`, { ...f, name: f.name || "Walk-in", party_size: Number(f.party_size) }), `Walk-in seated at ${table.name}`, onDone);
  };
  return (
    <form onSubmit={submit} className="space-y-2 rounded-xl border border-border bg-slate-50/60 p-3" data-testid="walkin-form">
      <div className="grid grid-cols-3 gap-2">
        <Input className="col-span-2 bg-white" placeholder="Name (optional)" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} data-testid="walkin-name" />
        <Input className="bg-white" type="number" min={1} value={f.party_size} onChange={(e) => setF({ ...f, party_size: e.target.value })} data-testid="walkin-party" />
      </div>
      <Input className="bg-white" placeholder="Phone (optional, saves guest)" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} data-testid="walkin-phone" />
      <button type="submit" data-testid="walkin-submit" className={`${btnPrimary} w-full`}>Seat walk-in</button>
    </form>
  );
}

function AssignBooking({ table, onDone }) {
  const [list, setList] = useState([]);
  useEffect(() => {
    api.get("/reservations", { params: { date: toDateStr(new Date()), status: "pending,confirmed" } }).then((r) => setList(r.data)).catch(() => {});
  }, [table.id]);
  const seat = (r) => run(() => api.patch(`/reservations/${r.id}`, { table_id: table.id, status: "seated" }), `${r.guest_name} seated at ${table.name}`, onDone);
  if (!list.length) return <p className="text-sm text-slate-400">No open bookings for today.</p>;
  return (
    <ul className="max-h-56 space-y-1 overflow-y-auto" data-testid="assign-booking-list">
      {list.map((r) => (
        <li key={r.id}>
          <button onClick={() => seat(r)} data-testid={`assign-seat-${r.id}`} className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm hover:bg-[#120092]/[0.05]">
            <span className="font-mono text-xs font-medium text-[#120092]">{r.time}</span>
            <span className="flex-1 truncate font-medium">{r.guest_name}</span>
            <span className={`text-xs ${r.party_size > table.capacity ? "font-semibold text-rose-600" : "text-slate-400"}`}>{r.party_size}p</span>
            {r.table_id === table.id && <span className="text-[10px] font-semibold text-[#120092]">assigned</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}

function CurrentGuest({ r, onChange }) {
  const [completing, setCompleting] = useState(false);
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4" data-testid="table-panel-reservation">
      <div className="flex items-center justify-between"><span className="font-semibold">{r.guest_name}</span><ResBadge status={r.status} /></div>
      <div className="mt-1 text-xs text-slate-600">{r.party_size} guests · since {r.seated_at ? new Date(r.seated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : r.time}</div>
      {r.notes && <div className="mt-1 text-xs font-medium text-rose-600">{r.notes}</div>}
      <button onClick={() => setCompleting(true)} data-testid="table-finish-btn" className="mt-3 w-full rounded-full bg-emerald-600 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Guests left · finish visit</button>
      <CompleteDialog r={r} open={completing} onOpenChange={setCompleting} onDone={onChange} />
    </div>
  );
}

export function TablePanel({ table, onChange, onDeleted }) {
  const [editing, setEditing] = useState(false);
  if (!table)
    return (
      <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[#120092]/25 bg-white p-8 text-center text-sm text-slate-500" data-testid="table-panel-empty">
        <MousePointerClick className="h-6 w-6 text-[#120092]" />Select a table to seat guests, change status or see who's there.
      </div>
    );
  const s = TABLE_STATUS[table.status];
  const r = table.current_reservation;
  const setStatus = (status) => run(() => api.patch(`/tables/${table.id}`, { status }), `${table.name} → ${TABLE_STATUS[status].label}`, onChange);
  const remove = () => window.confirm(`Delete table ${table.name}?`) && run(() => api.delete(`/tables/${table.id}`), "Table deleted", onDeleted);
  return (
    <div className={`${card} space-y-5 p-5`} data-testid="table-panel">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-display text-4xl font-bold" data-testid="table-panel-name">{table.name}</div>
          <div className="text-sm text-slate-500">{table.capacity} seats · {table.zone}</div>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${s.cls}`} data-testid="table-panel-status">{s.label}</span>
      </div>

      {r && <CurrentGuest r={r} onChange={onChange} />}

      {table.status === "cleaning" && (
        <button onClick={() => setStatus("free")} data-testid="table-mark-clean-btn" className="flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">
          <Sparkles className="h-4 w-4" /> Mark clean & free
        </button>
      )}

      {table.status === "free" && (
        <>
          <div><L icon={UserPlus}>Walk-in</L><WalkInForm key={table.id} table={table} onDone={onChange} /></div>
          <div><L>Seat a booking</L><AssignBooking table={table} onDone={onChange} /></div>
        </>
      )}

      {table.status !== "seated" && (
        <div>
          <L>Set status</L>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(TABLE_STATUS).filter(([k]) => k !== table.status && k !== "seated").map(([k, v]) => (
              <button key={k} onClick={() => setStatus(k)} data-testid={`table-set-${k}`} className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-opacity ${v.cls} hover:opacity-80`}>{v.label}</button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 border-t border-border pt-4">
        <button onClick={() => setEditing(true)} data-testid="table-edit-btn" className={`${btnGhost} flex-1`}><Pencil className="h-3.5 w-3.5" /> Edit</button>
        <button onClick={remove} data-testid="table-delete-btn" className={`${btnGhost} flex-1 hover:!border-rose-300 hover:!text-rose-600`}><Trash2 className="h-3.5 w-3.5" /> Delete</button>
      </div>
      <TableFormDialog open={editing} onOpenChange={setEditing} onSaved={onChange} table={table} />
    </div>
  );
}
