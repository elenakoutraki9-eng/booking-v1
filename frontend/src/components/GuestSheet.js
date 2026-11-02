import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Crown, Trash2 } from "lucide-react";
import { api, eur, formatApiError, prettyDate } from "../lib/api";
import { ResBadge } from "../lib/status";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "./ui/sheet";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Switch } from "./ui/switch";

const L = ({ children }) => <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-[#786E65]">{children}</div>;

export function GuestSheet({ id, onClose, onChange }) {
  const [g, setG] = useState(null);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    const { data } = await api.get(`/guests/${id}`);
    setG(data);
  }, [id]);

  useEffect(() => {
    setG(null);
    load();
  }, [load]);

  const save = async (patch) => {
    try {
      const { data } = await api.patch(`/guests/${id}`, patch);
      setG(data);
      onChange();
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const saveProfile = async () => {
    await save({ name: g.name, email: g.email, phone: g.phone, allergies: g.allergies, preferences: g.preferences });
    toast.success("Guest profile saved");
  };

  const addNote = async (e) => {
    e.preventDefault();
    if (!note.trim()) return;
    await api.post(`/guests/${id}/notes`, { text: note });
    setNote("");
    load();
  };

  const delNote = async (nid) => {
    await api.delete(`/guests/${id}/notes/${nid}`);
    load();
  };

  const field = (k) => ({ value: g[k] || "", onChange: (e) => setG({ ...g, [k]: e.target.value }) });

  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto border-[#332B25] bg-[#1C1714] sm:max-w-lg" data-testid="guest-sheet">
        {g && (
          <div className="space-y-7">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-3 font-serif-d text-4xl font-medium">
                {g.vip && <Crown className="h-6 w-6 text-purple-300" />}<span data-testid="guest-sheet-name">{g.name}</span>
              </SheetTitle>
            </SheetHeader>
            <div className="grid grid-cols-3 gap-3">
              {[["Visits", g.visits, "guest-visits"], ["Lifetime", eur(g.total_spend), "guest-spend"], ["Last visit", g.last_visit ? prettyDate(g.last_visit) : "—", "guest-last"]].map(([l, v, tid]) => (
                <div key={l} className="rounded-lg border border-[#332B25] p-3" data-testid={tid}><L>{l}</L><div className="font-outfit text-lg">{v}</div></div>
              ))}
            </div>
            <label className="flex items-center justify-between rounded-lg border border-purple-400/30 bg-purple-950/30 px-4 py-3">
              <span className="text-sm text-purple-200">VIP guest</span>
              <Switch checked={!!g.vip} onCheckedChange={(v) => save({ vip: v })} data-testid="guest-vip-switch" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><L>Name</L><Input {...field("name")} data-testid="guest-name-input" /></div>
              <div><L>Email</L><Input {...field("email")} data-testid="guest-email-input" /></div>
              <div><L>Phone</L><Input {...field("phone")} data-testid="guest-phone-input" /></div>
              <div className="col-span-2"><L>Allergies & dietary</L><Input {...field("allergies")} placeholder="e.g. shellfish, gluten-free" data-testid="guest-allergies-input" /></div>
              <div className="col-span-2"><L>Preferences</L><Textarea rows={2} {...field("preferences")} placeholder="e.g. window seat, sparkling water, loves the Negroni" data-testid="guest-preferences-input" /></div>
              <button onClick={saveProfile} data-testid="guest-save-btn" className="col-span-2 rounded-full bg-[#D4A359] py-2.5 text-sm font-semibold text-[#120E0D] hover:bg-[#E5B86C]">Save profile</button>
            </div>

            <div>
              <L>Staff notes</L>
              <form onSubmit={addNote} className="flex gap-2">
                <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note…" data-testid="guest-note-input" />
                <button type="submit" data-testid="guest-note-add" className="rounded-md border border-[#332B25] px-4 text-sm hover:border-[#D4A359]/60">Add</button>
              </form>
              <ul className="mt-3 space-y-2">
                {[...(g.notes || [])].reverse().map((n) => (
                  <li key={n.id} className="group rounded-lg bg-[#120E0D] p-3 text-sm" data-testid={`guest-note-${n.id}`}>
                    <div className="flex justify-between gap-2"><span>{n.text}</span>
                      <button onClick={() => delNote(n.id)} data-testid={`guest-note-delete-${n.id}`} className="text-[#786E65] opacity-0 transition-opacity hover:text-rose-400 group-hover:opacity-100"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                    <div className="mt-1 text-[10px] text-[#786E65]">{n.author} · {new Date(n.created_at).toLocaleDateString("en-GB")}</div>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <L>Visit history</L>
              {g.history.length === 0 && <p className="text-sm text-[#786E65]">No bookings yet.</p>}
              <ul className="divide-y divide-[#332B25] rounded-lg border border-[#332B25]" data-testid="guest-history">
                {g.history.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                    <span className="w-24 text-xs text-[#B0A59A]">{prettyDate(r.date)}</span>
                    <span className="font-mono text-xs text-[#786E65]">{r.time}</span>
                    <span className="flex-1 text-xs text-[#786E65]">{r.party_size}p</span>
                    {r.spend ? <span className="font-mono text-xs text-[#D4A359]">{eur(r.spend)}</span> : null}
                    <ResBadge status={r.status} />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
