import { useEffect, useState, useCallback } from "react";
import { Search, Crown, Plus, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { api, eur, formatApiError, prettyDate } from "../lib/api";
import { btnPrimary, card } from "../lib/status";
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
      <DialogContent className="rounded-2xl bg-white sm:max-w-sm" data-testid="new-guest-dialog">
        <DialogHeader><DialogTitle className="font-display text-2xl font-bold">New guest</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-3">
          {["name", "email", "phone", "allergies"].map((k) => (
            <Input key={k} placeholder={k[0].toUpperCase() + k.slice(1)} required={k === "name"} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} data-testid={`newguest-${k}`} />
          ))}
          <button type="submit" data-testid="newguest-save" className={`${btnPrimary} w-full`}>Save guest</button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const initials = (n) => n.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

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
        <button onClick={() => setAdding(true)} data-testid="new-guest-btn" className={`${btnPrimary} brand-shadow`}><Plus className="h-4 w-4" /> New guest</button>
      </PageHeader>
      <div className="mb-5 flex flex-wrap gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email or phone" className="rounded-xl bg-white pl-9" data-testid="guest-search-input" />
        </div>
        <button onClick={() => setVip(!vip)} data-testid="guest-vip-filter" className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${vip ? "border-[#120092] bg-[#120092] text-white" : "border-border bg-white text-slate-500 hover:text-slate-900"}`}>
          <Crown className="h-3.5 w-3.5" /> VIP only
        </button>
      </div>

      <div className={`${card} overflow-x-auto`}>
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border bg-slate-50/70 text-left text-xs font-semibold text-slate-500">
              <th className="px-5 py-3">Guest</th><th className="px-5 py-3">Contact</th>
              <th className="px-5 py-3">Allergies</th><th className="px-5 py-3 text-right">Visits</th>
              <th className="px-5 py-3 text-right">Spend</th><th className="px-5 py-3">Last visit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {list.map((g) => (
              <tr key={g.id} onClick={() => setOpenId(g.id)} className="cursor-pointer transition-colors hover:bg-[#120092]/[0.03]" data-testid={`guest-row-${g.id}`}>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${g.vip ? "bg-[#120092] text-white" : "bg-slate-100 text-slate-600"}`}>{initials(g.name)}</span>
                    <span className="font-semibold">{g.name}</span>
                    {g.vip && <span className="rounded-full bg-[#120092]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#120092]">VIP</span>}
                  </div>
                </td>
                <td className="px-5 py-3.5 text-xs text-slate-600">{g.email}<div className="text-slate-400">{g.phone}</div></td>
                <td className="px-5 py-3.5 text-xs font-medium text-rose-600">{g.allergies && <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3" />{g.allergies}</span>}</td>
                <td className="px-5 py-3.5 text-right font-semibold">{g.visits}</td>
                <td className="px-5 py-3.5 text-right font-semibold text-[#120092]">{eur(g.total_spend)}</td>
                <td className="px-5 py-3.5 text-xs text-slate-500">{g.last_visit ? prettyDate(g.last_visit) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <p className="py-16 text-center text-sm text-slate-400" data-testid="guest-empty">No guests yet. They appear here automatically when someone books.</p>}
      </div>
      <GuestSheet id={openId} onClose={() => setOpenId(null)} onChange={load} />
      <NewGuestDialog open={adding} onOpenChange={setAdding} onSaved={load} />
    </div>
  );
}
