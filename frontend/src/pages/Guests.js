import { useEffect, useState, useCallback } from "react";
import { Search, Crown, Plus, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { api, eur, formatApiError, prettyDate } from "../lib/api";
import { PageHeader } from "../components/StaffLayout";
import { GuestSheet } from "../components/GuestSheet";
import { Input } from "../components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";

function NewGuestDialog({ open, onOpenChange, onSaved }) {
  const [f, setF] = useState({ name: "", email: "", phone: "", allergies: "" });
  const save = async (e) => {
    e.preventDefault();
    try {
      await api.post("/guests", f);
      toast.success("Guest added");
      setF({ name: "", email: "", phone: "", allergies: "" });
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-[#332B25] bg-[#1C1714] sm:max-w-sm" data-testid="new-guest-dialog">
        <DialogHeader><DialogTitle className="font-serif-d text-2xl font-medium">New guest</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-3">
          {["name", "email", "phone", "allergies"].map((k) => (
            <Input key={k} placeholder={k[0].toUpperCase() + k.slice(1)} required={k === "name"} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} data-testid={`newguest-${k}`} />
          ))}
          <button type="submit" data-testid="newguest-save" className="w-full rounded-full bg-[#D4A359] py-2.5 text-sm font-semibold text-[#120E0D] hover:bg-[#E5B86C]">Save guest</button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Guests() {
  const [list, setList] = useState([]);
  const [q, setQ] = useState("");
  const [vip, setVip] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const { data } = await api.get("/guests", { params: { q: q || undefined, vip: vip || undefined } });
    setList(data);
  }, [q, vip]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <PageHeader eyebrow={`${list.length} guests`} title="Guest book">
        <button onClick={() => setAdding(true)} data-testid="new-guest-btn" className="flex items-center gap-2 rounded-full bg-[#D4A359] px-5 py-2.5 text-sm font-semibold text-[#120E0D] hover:bg-[#E5B86C]"><Plus className="h-4 w-4" /> New guest</button>
      </PageHeader>
      <div className="mb-6 flex flex-wrap gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#786E65]" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email or phone" className="pl-9" data-testid="guest-search-input" />
        </div>
        <button onClick={() => setVip(!vip)} data-testid="guest-vip-filter" className={`flex items-center gap-2 rounded-full border px-4 text-sm ${vip ? "border-purple-400/60 text-purple-200" : "border-[#332B25] text-[#786E65]"}`}>
          <Crown className="h-3.5 w-3.5" /> VIP only
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#332B25] bg-[#1C1714]">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-[#332B25] text-left font-mono text-[10px] uppercase tracking-[0.2em] text-[#D4A359]/80">
              <th className="px-5 py-3 font-normal">Guest</th><th className="px-5 py-3 font-normal">Contact</th>
              <th className="px-5 py-3 font-normal">Allergies</th><th className="px-5 py-3 text-right font-normal">Visits</th>
              <th className="px-5 py-3 text-right font-normal">Spend</th><th className="px-5 py-3 font-normal">Last visit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#332B25]">
            {list.map((g) => (
              <tr key={g.id} onClick={() => setOpenId(g.id)} className="cursor-pointer transition-colors hover:bg-[#26201C]" data-testid={`guest-row-${g.id}`}>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    {g.vip && <span className="rounded-full border border-purple-400/50 bg-purple-950/70 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-purple-200">VIP</span>}
                    <span className="font-medium">{g.name}</span>
                  </div>
                </td>
                <td className="px-5 py-3.5 text-xs text-[#B0A59A]">{g.email}<div className="text-[#786E65]">{g.phone}</div></td>
                <td className="px-5 py-3.5 text-xs text-rose-300">{g.allergies && <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3" />{g.allergies}</span>}</td>
                <td className="px-5 py-3.5 text-right font-mono">{g.visits}</td>
                <td className="px-5 py-3.5 text-right font-mono text-[#D4A359]">{eur(g.total_spend)}</td>
                <td className="px-5 py-3.5 text-xs text-[#786E65]">{g.last_visit ? prettyDate(g.last_visit) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <p className="py-16 text-center text-sm text-[#786E65]" data-testid="guest-empty">No guests yet. They appear here automatically when someone books.</p>}
      </div>
      <GuestSheet id={openId} onClose={() => setOpenId(null)} onChange={load} />
      <NewGuestDialog open={adding} onOpenChange={setAdding} onSaved={load} />
    </div>
  );
}
