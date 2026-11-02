import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, formatApiError } from "../lib/api";
import { ZONES } from "../lib/status";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

const F = ({ label, children, className = "" }) => (
  <label className={`block ${className}`}>
    <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.2em] text-[#786E65]">{label}</span>
    {children}
  </label>
);

const NONE = "__none";

export function ReservationDialog({ value, defaultDate, onClose, onSaved }) {
  const isEdit = !!value?.id;
  const [f, setF] = useState({});
  const [tables, setTables] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!value) return;
    setF(isEdit ? { ...value } : { name: "", email: "", phone: "", party_size: 2, date: defaultDate, time: "19:30", zone: "", notes: "", table_id: null, status: "confirmed" });
    api.get("/tables").then((r) => setTables(r.data));
  }, [value, isEdit, defaultDate]);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (isEdit) {
        const { party_size, date, time, zone, notes, table_id } = f;
        await api.patch(`/reservations/${f.id}`, { party_size: Number(party_size), date, time, zone, notes, table_id });
      } else {
        await api.post("/reservations", { ...f, party_size: Number(f.party_size) });
      }
      toast.success(isEdit ? "Reservation updated" : "Reservation created");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!value} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-[#332B25] bg-[#1C1714] sm:max-w-lg" data-testid="reservation-dialog">
        <DialogHeader>
          <DialogTitle className="font-serif-d text-3xl font-medium">{isEdit ? f.guest_name : "New reservation"}</DialogTitle>
          {isEdit && <p className="font-mono text-xs text-[#786E65]">#{f.ref} · {f.email || "no email"} · {f.phone || "no phone"}</p>}
        </DialogHeader>
        <form onSubmit={save} className="grid grid-cols-2 gap-4">
          {!isEdit && (
            <>
              <F label="Guest name" className="col-span-2"><Input value={f.name || ""} onChange={set("name")} required data-testid="resform-name" /></F>
              <F label="Email"><Input type="email" value={f.email || ""} onChange={set("email")} data-testid="resform-email" /></F>
              <F label="Phone"><Input value={f.phone || ""} onChange={set("phone")} data-testid="resform-phone" /></F>
            </>
          )}
          <F label="Date"><Input type="date" value={f.date || ""} onChange={set("date")} required data-testid="resform-date" className="[color-scheme:dark]" /></F>
          <F label="Time"><Input type="time" value={f.time || ""} onChange={set("time")} required data-testid="resform-time" className="[color-scheme:dark]" /></F>
          <F label="Party size"><Input type="number" min={1} max={50} value={f.party_size || ""} onChange={set("party_size")} required data-testid="resform-party" /></F>
          <F label="Zone">
            <Select value={f.zone || NONE} onValueChange={(v) => setF({ ...f, zone: v === NONE ? "" : v })}>
              <SelectTrigger data-testid="resform-zone"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Any</SelectItem>
                {ZONES.map((z) => <SelectItem key={z} value={z}>{z}</SelectItem>)}
              </SelectContent>
            </Select>
          </F>
          <F label="Table" className="col-span-2">
            <Select value={f.table_id || NONE} onValueChange={(v) => setF({ ...f, table_id: v === NONE ? null : v })}>
              <SelectTrigger data-testid="resform-table"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Not assigned</SelectItem>
                {tables.map((t) => (
                  <SelectItem key={t.id} value={t.id} data-testid={`resform-table-opt-${t.name}`}>
                    {t.name} · {t.capacity} seats · {t.zone}{t.capacity < Number(f.party_size) ? " (too small)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </F>
          <F label="Notes" className="col-span-2"><Textarea rows={2} value={f.notes || ""} onChange={set("notes")} data-testid="resform-notes" /></F>
          {!isEdit && (
            <F label="Status" className="col-span-2">
              <Select value={f.status || "confirmed"} onValueChange={(v) => setF({ ...f, status: v })}>
                <SelectTrigger data-testid="resform-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </F>
          )}
          <div className="col-span-2 flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} data-testid="resform-cancel" className="rounded-full border border-[#332B25] px-5 py-2 text-sm text-[#B0A59A] hover:text-[#F7F4EF]">Cancel</button>
            <button type="submit" disabled={busy} data-testid="resform-save" className="rounded-full bg-[#D4A359] px-6 py-2 text-sm font-semibold text-[#120E0D] hover:bg-[#E5B86C] disabled:opacity-60">{busy ? "Saving…" : "Save"}</button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CompleteDialog({ r, open, onOpenChange, onDone }) {
  const [spend, setSpend] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.patch(`/reservations/${r.id}`, { status: "completed", spend: spend === "" ? null : Number(spend) });
      toast.success("Visit completed — table marked for cleaning");
      onOpenChange(false);
      onDone();
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-[#332B25] bg-[#1C1714] sm:max-w-sm" data-testid="complete-dialog">
        <DialogHeader><DialogTitle className="font-serif-d text-2xl font-medium">Finish visit · {r.guest_name}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <F label="Bill total (€) — optional">
            <Input type="number" min={0} step="0.01" value={spend} onChange={(e) => setSpend(e.target.value)} data-testid="complete-spend-input" placeholder="e.g. 142.50" />
          </F>
          <button type="submit" data-testid="complete-submit-btn" className="w-full rounded-full bg-[#D4A359] py-2.5 text-sm font-semibold text-[#120E0D] hover:bg-[#E5B86C]">Complete visit</button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
