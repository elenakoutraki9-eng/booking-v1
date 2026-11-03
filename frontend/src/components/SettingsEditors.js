import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowUp, ArrowDown, Eye, EyeOff, Plus, Trash2, ExternalLink } from "lucide-react";
import { api, formatApiError } from "../lib/api";
import { btnPrimary, btnGhost, card } from "../lib/status";
import { useSite } from "../context/SiteContext";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";

const L = ({ children }) => <div className="mb-1.5 text-xs font-semibold text-slate-500">{children}</div>;
const Panel = ({ title, hint, children }) => (
  <section className={`${card} p-6`}>
    <h2 className="font-display text-xl font-bold">{title}</h2>
    {hint && <p className="mt-1 text-sm text-slate-500">{hint}</p>}
    <div className="mt-5">{children}</div>
  </section>
);

async function saveSettings(patch, msg, onSaved) {
  try {
    const { data } = await api.put("/settings", patch);
    onSaved(data);
    toast.success(msg);
  } catch (e) {
    toast.error(formatApiError(e));
  }
}

const WIDGET_LABELS = {
  stat_bookings: "Bookings count", stat_covers: "Covers", stat_seated: "Seated now", stat_pending: "To confirm",
  stat_revenue: "Revenue logged", upcoming: "Upcoming today list", floor: "Floor status",
};

export function TodayLayoutEditor({ s, onSaved }) {
  const [title, setTitle] = useState(s.dashboard_title);
  const [items, setItems] = useState(s.dashboard);
  const move = (i, d) => {
    const next = [...items];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    setItems(next);
  };
  const toggle = (i) => setItems(items.map((w, j) => (j === i ? { ...w, visible: !w.visible } : w)));
  return (
    <Panel title="Today page layout" hint="Show, hide and reorder what appears on the Today page. The first visible stat is highlighted.">
      <div className="mb-5 max-w-sm"><L>Page title</L><Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} data-testid="layout-title-input" /></div>
      <ul className="space-y-2" data-testid="layout-list">
        {items.map((w, i) => (
          <li key={w.key} className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${w.visible ? "border-border bg-white" : "border-dashed border-border bg-slate-50 text-slate-400"}`} data-testid={`layout-item-${w.key}`}>
            <span className="flex-1 text-sm font-semibold">{WIDGET_LABELS[w.key]}</span>
            <span className="text-[11px] text-slate-400">{w.key.startsWith("stat") ? "Stat card" : "Section"}</span>
            <button onClick={() => toggle(i)} data-testid={`layout-toggle-${w.key}`} className="rounded-lg p-1.5 hover:bg-slate-100" title={w.visible ? "Hide" : "Show"}>
              {w.visible ? <Eye className="h-4 w-4 text-[#120092]" /> : <EyeOff className="h-4 w-4" />}
            </button>
            <button disabled={i === 0} onClick={() => move(i, -1)} data-testid={`layout-up-${w.key}`} className="rounded-lg p-1.5 hover:bg-slate-100 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
            <button disabled={i === items.length - 1} onClick={() => move(i, 1)} data-testid={`layout-down-${w.key}`} className="rounded-lg p-1.5 hover:bg-slate-100 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
          </li>
        ))}
      </ul>
      <div className="mt-5 flex gap-2">
        <button onClick={() => saveSettings({ dashboard_title: title || "Today", dashboard: items }, "Today page updated", onSaved)} data-testid="layout-save-btn" className={btnPrimary}>Save layout</button>
        <button onClick={() => { setItems(Object.keys(WIDGET_LABELS).map((key) => ({ key, visible: true }))); setTitle("Today's service"); }} data-testid="layout-reset-btn" className={btnGhost}>Reset to default</button>
      </div>
    </Panel>
  );
}

export function ZonesEditor({ s, onSaved }) {
  const { refresh } = useSite();
  const [zones, setZones] = useState(s.zones.map((z) => ({ name: z, original: z })));
  const save = async () => {
    try {
      const { data } = await api.put("/settings/zones", { zones: zones.map((z) => ({ ...z, name: z.name.trim() })) });
      onSaved(data);
      setZones(data.zones.map((z) => ({ name: z, original: z })));
      refresh();
      toast.success("Seating areas saved");
    } catch (e) {
      toast.error(formatApiError(e));
      setZones(s.zones.map((z) => ({ name: z, original: z })));
    }
  };
  return (
    <Panel title="Seating areas" hint="Used on the floor plan, in reservations and on the public booking page. Renaming an area updates its tables too.">
      <ul className="space-y-2" data-testid="zones-list">
        {zones.map((z, i) => (
          <li key={i} className="flex items-center gap-2">
            <Input value={z.name} onChange={(e) => setZones(zones.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} maxLength={40} data-testid={`zone-input-${i}`} />
            <button onClick={() => setZones(zones.filter((_, j) => j !== i))} disabled={zones.length === 1} data-testid={`zone-delete-${i}`} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30"><Trash2 className="h-4 w-4" /></button>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex gap-2">
        <button onClick={() => setZones([...zones, { name: "", original: null }])} data-testid="zone-add-btn" className={btnGhost}><Plus className="h-4 w-4" /> Add area</button>
        <button onClick={save} disabled={zones.some((z) => !z.name.trim())} data-testid="zones-save-btn" className={btnPrimary}>Save areas</button>
      </div>
    </Panel>
  );
}

const CONTENT_KEYS = ["tagline", "description", "booking_title", "booking_text"];

export function BookingPageEditor({ s, onSaved }) {
  const { refresh } = useSite();
  const [f, setF] = useState(() => Object.fromEntries(CONTENT_KEYS.map((k) => [k, s[k]])));
  useEffect(() => {
    setF(Object.fromEntries(CONTENT_KEYS.map((k) => [k, s[k]])));
  }, [s]);
  const t = (k) => ({ value: f[k] || "", onChange: (e) => setF({ ...f, [k]: e.target.value }), "data-testid": `content-${k}` });
  const save = () => saveSettings(f, "Booking page updated", (d) => { onSaved(d); refresh(); });
  return (
    <div className="space-y-6">
      <Panel title="Restaurant info & booking form" hint="Your booking page shows only the booking form plus your basic details. Hours, address, phone and email are edited under General.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div><L>Tagline</L><Input {...t("tagline")} /></div>
          <div><L>Form heading</L><Input {...t("booking_title")} maxLength={120} /></div>
          <div className="sm:col-span-2"><L>Short description</L><Textarea rows={2} {...t("description")} /></div>
          <div className="sm:col-span-2"><L>Text under the form heading</L><Textarea rows={2} {...t("booking_text")} maxLength={600} /></div>
        </div>
      </Panel>
      <div className="flex gap-2">
        <button onClick={save} data-testid="content-save-btn" className={btnPrimary}>Save booking page</button>
        <a href="/" target="_blank" rel="noreferrer" data-testid="content-preview-link" className={btnGhost}><ExternalLink className="h-4 w-4" /> Open booking page</a>
      </div>
    </div>
  );
}
