import { useEffect, useState } from "react";
import { toast } from "sonner";
import { UserPlus, Sparkles, Trash2, Pencil } from "lucide-react";
import { api, formatApiError, toDateStr } from "../lib/api";
import { TABLE_STATUS, ZONES, ResBadge } from "../lib/status";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { CompleteDialog } from "./ReservationDialog";

export function TableFormDialog({ open, onOpenChange, onSaved, table }) {
  const [f, setF] = useState({ name: "", capacity: 4, zone: "Main Dining", shape: "round" });
  useEffect(() => {
    if (open) setF(table ? { name: table.name, capacity: table.capacity, zone: table.zone, shape: table.shape } : { name: "", capacity: 4, zone: "Main Dining", shape: "round", x: 45, y: 45 });
  }, [open, table]);
  const save = async (e) => {
    e.preventDefault();
    try {
      const body = { ...f, capacity: Number(f.capacity) };
      if (table) await api.patch(`/tables/${table.id}`, body);
      else await api.post("/tables", body);
      toast.success(table ? "Table updated" : "Table added");
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-[#332B25] bg-[#1C1714] sm:max-w-sm" data-testid="table-form-dialog">
        <DialogHeader><DialogTitle className="font-serif-d text-2xl font-medium">{table ? "Edit table" : "Add table"}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="grid grid-cols-2 gap-3">
          <Input placeholder="Name (e.g. T7)" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required data-testid="tableform-name" />
          <Input type="number" min={1} max={30} value={f.capacity} onChange={(e) => setF({ ...f, capacity: e.target.value })} required data-testid="tableform-capacity" />
          <Select value={f.zone} onValueChange={(v) => setF({ ...f, zone: v })}>
            <SelectTrigger data-testid="tableform-zone"><SelectValue /></SelectTrigger>
            <SelectContent>{ZONES.map((z) => <SelectItem key={z} value={z}>{z}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={f.shape} onValueChange={(v) => setF({ ...f, shape: v })}>
            <SelectTrigger data-testid="tableform-shape"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="round">Round</SelectItem>
              <SelectItem value="square">Square</SelectItem>
              <SelectItem value="rect">Long</SelectItem>
            </SelectContent>
          </Select>
          <button type="submit" data-testid="tableform-save" className="col-span-2 mt-2 rounded-full bg-[#D4A359] py-2.5 text-sm font-semibold text-[#120E0D] hover:bg-[#E5B86C]">Save table</button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function WalkInForm({ table, onDone }) {
  const [f, setF] = useState({ name: "", party_size: Math.min(2, table.capacity), phone: "" });
  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/tables/${table.id}/walk-in`, { ...f, name: f.name || "Walk-in", party_size: Number(f.party_size) });
      toast.success(`Walk-in seated at ${table.name}`);
      onDone();
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };
  return (
    <form onSubmit={submit} className="space-y-2 rounded-lg border border-[#332B25] p-3" data-testid="walkin-form">
      <div className="grid grid-cols-3 gap-2">
        <Input className="col-span-2" placeholder="Name (optional)" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} data-testid="walkin-name" />
        <Input type="number" min={1} value={f.party_size} onChange={(e) => setF({ ...f, party_size: e.target.value })} data-testid="walkin-party" />
      </div>
      <Input placeholder="Phone (optional, saves guest)" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} data-testid="walkin-phone" />
      <button type="submit" data-testid="walkin-submit" className="w-full rounded-full bg-amber-500/90 py-2 text-sm font-semibold text-[#120E0D] hover:bg-amber-400">Seat walk-in</button>
    </form>
  );
}

function AssignBooking({ table, onDone }) {
  const [list, setList] = useState([]);
  useEffect(() => {
    api.get("/reservations", { params: { date: toDateStr(new Date()), status: "pending,confirmed" } }).then((r) => setList(r.data));
  }, [table.id]);
  const seat = async (r) => {
    try {
      await api.patch(`/reservations/${r.id}`, { table_id: table.id, status: "seated" });
      toast.success(`${r.guest_name} seated at ${table.name}`);
      onDone();
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };
  if (!list.length) return <p className="text-xs text-[#786E65]">No open bookings for today.</p>;
  return (
    <ul className="max-h-56 space-y-1 overflow-y-auto" data-testid="assign-booking-list">
      {list.map((r) => (
        <li key={r.id}>
          <button onClick={() => seat(r)} data-testid={`assign-seat-${r.id}`} className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm hover:bg-[#26201C]">
            <span className="font-mono text-xs text-[#D4A359]">{r.time}</span>
            <span className="flex-1 truncate">{r.guest_name}</span>
            <span className={`text-xs ${r.party_size > table.capacity ? "text-rose-400" : "text-[#786E65]"}`}>{r.party_size}p</span>
            {r.table_id === table.id && <span className="text-[10px] text-sky-300">assigned</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function TablePanel({ table, onChange, onDeleted }) {
  const [editing, setEditing] = useState(false);
  const [completing, setCompleting] = useState(false);
  if (!table)
    return (
      <div className="flex h-full min-h-[200px] items-center justify-center rounded-xl border border-dashed border-[#332B25] p-8 text-center text-sm text-[#786E65]" data-testid="table-panel-empty">
        Select a table to seat guests, change status or see who's there.
      </div>
    );
  const s = TABLE_STATUS[table.status];
  const r = table.current_reservation;
  const setStatus = async (status) => {
    await api.patch(`/tables/${table.id}`, { status });
    toast.success(`${table.name} → ${TABLE_STATUS[status].label}`);
    onChange();
  };
  const remove = async () => {
    if (!window.confirm(`Delete table ${table.name}?`)) return;
    await api.delete(`/tables/${table.id}`);
    onDeleted();
  };
  return (
    <div className="space-y-5 rounded-xl border border-[#332B25] bg-[#1C1714] p-5" data-testid="table-panel">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-serif-d text-4xl" data-testid="table-panel-name">{table.name}</div>
          <div className="text-xs text-[#786E65]">{table.capacity} seats · {table.zone}</div>
        </div>
        <span className={`rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.15em] ${s.cls}`} data-testid="table-panel-status">{s.label}</span>
      </div>

      {r && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3" data-testid="table-panel-reservation">
          <div className="flex items-center justify-between">
            <span className="font-medium">{r.guest_name}</span><ResBadge status={r.status} />
          </div>
          <div className="mt-1 text-xs text-[#B0A59A]">{r.party_size} guests · since {r.seated_at ? new Date(r.seated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : r.time}</div>
          {r.notes && <div className="mt-1 text-xs text-rose-300">{r.notes}</div>}
          <button onClick={() => setCompleting(true)} data-testid="table-finish-btn" className="mt-3 w-full rounded-full border border-emerald-500/40 py-1.5 text-xs text-emerald-300 hover:bg-emerald-500/10">Guests left · finish visit</button>
          <CompleteDialog r={r} open={completing} onOpenChange={setCompleting} onDone={onChange} />
        </div>
      )}

      {table.status === "cleaning" && (
        <button onClick={() => setStatus("free")} data-testid="table-mark-clean-btn" className="flex w-full items-center justify-center gap-2 rounded-full bg-emerald-500/90 py-2.5 text-sm font-semibold text-[#120E0D] hover:bg-emerald-400">
          <Sparkles className="h-4 w-4" /> Mark clean & free
        </button>
      )}

      {table.status === "free" && (
        <>
          <div>
            <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[#786E65]"><UserPlus className="h-3 w-3" /> Walk-in</div>
            <WalkInForm key={table.id} table={table} onDone={onChange} />
          </div>
          <div>
            <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[#786E65]">Seat a booking</div>
            <AssignBooking table={table} onDone={onChange} />
          </div>
        </>
      )}

      <div>
        <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[#786E65]">Set status</div>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(TABLE_STATUS).filter(([k]) => k !== table.status && k !== "seated").map(([k, v]) => (
            <button key={k} onClick={() => setStatus(k)} data-testid={`table-set-${k}`} className={`rounded-lg border px-3 py-2 text-xs ${v.cls} hover:opacity-80`}>{v.label}</button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 border-t border-[#332B25] pt-4">
        <button onClick={() => setEditing(true)} data-testid="table-edit-btn" className="flex flex-1 items-center justify-center gap-2 rounded-full border border-[#332B25] py-2 text-xs text-[#B0A59A] hover:text-[#F7F4EF]"><Pencil className="h-3 w-3" /> Edit</button>
        <button onClick={remove} data-testid="table-delete-btn" className="flex flex-1 items-center justify-center gap-2 rounded-full border border-rose-500/30 py-2 text-xs text-rose-300 hover:bg-rose-500/10"><Trash2 className="h-3 w-3" /> Delete</button>
      </div>
      <TableFormDialog open={editing} onOpenChange={setEditing} onSaved={onChange} table={table} />
    </div>
  );
}
