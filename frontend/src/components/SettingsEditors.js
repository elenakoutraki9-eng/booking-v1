import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowUp, ArrowDown, Eye, EyeOff, Plus, Trash2, Upload, ExternalLink } from "lucide-react";
import { api, assetUrl, formatApiError } from "../lib/api";
import { btnPrimary, btnGhost, card } from "../lib/status";
import { useSite } from "../context/SiteContext";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Switch } from "./ui/switch";

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

function resizeToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1800 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function ImageField({ label, value, onChange, testId }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const { data } = await api.post("/assets", { data_url: await resizeToDataUrl(file) });
      onChange(data.url);
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };
  return (
    <div>
      <L>{label}</L>
      <div className="flex items-center gap-3">
        <img src={assetUrl(value)} alt={label} className="h-16 w-24 rounded-lg border border-border object-cover" data-testid={`${testId}-preview`} />
        <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={upload} data-testid={`${testId}-file`} />
        <button type="button" onClick={() => ref.current.click()} disabled={busy} data-testid={`${testId}-upload`} className={btnGhost}><Upload className="h-4 w-4" />{busy ? "Uploading…" : "Upload photo"}</button>
      </div>
    </div>
  );
}

const Toggle = ({ label, checked, onChange, testId }) => (
  <label className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
    <span className="text-sm font-medium">{label}</span>
    <Switch checked={checked} onCheckedChange={onChange} data-testid={testId} />
  </label>
);

const CONTENT_KEYS = ["tagline", "description", "hero_badge", "hero_image", "cta_label", "show_hero_cards", "booking_title", "booking_text", "show_steps", "show_gallery", "gallery_1", "gallery_2", "show_visit", "visit_title"];

export function BookingPageEditor({ s, onSaved }) {
  const { refresh } = useSite();
  const [f, setF] = useState(() => Object.fromEntries(CONTENT_KEYS.map((k) => [k, s[k]])));
  useEffect(() => {
    setF(Object.fromEntries(CONTENT_KEYS.map((k) => [k, s[k]])));
  }, [s]);
  const t = (k) => ({ value: f[k] || "", onChange: (e) => setF({ ...f, [k]: e.target.value }), "data-testid": `content-${k}` });
  const b = (k) => ({ checked: !!f[k], onChange: (v) => setF({ ...f, [k]: v }), testId: `content-${k}` });
  const save = () => saveSettings({ ...f, cta_label: f.cta_label || "Reserve a table" }, "Booking page updated", (d) => { onSaved(d); refresh(); });
  return (
    <div className="space-y-6">
      <Panel title="Top of the page" hint="The first thing guests see.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div><L>Small badge text (leave empty to hide)</L><Input {...t("hero_badge")} maxLength={80} /></div>
          <div><L>Button label</L><Input {...t("cta_label")} maxLength={40} /></div>
          <div><L>Tagline</L><Input {...t("tagline")} /></div>
          <div className="sm:col-span-2"><L>Description</L><Textarea rows={2} {...t("description")} /></div>
          <ImageField label="Main photo" value={f.hero_image} onChange={(v) => setF({ ...f, hero_image: v })} testId="content-hero-image" />
          <Toggle label="Show floating info cards on the photo" {...b("show_hero_cards")} />
        </div>
      </Panel>
      <Panel title="Booking section">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><L>Heading</L><Input {...t("booking_title")} maxLength={120} /></div>
          <div className="sm:col-span-2"><L>Intro text</L><Textarea rows={2} {...t("booking_text")} maxLength={600} /></div>
          <Toggle label="Show the 3 booking steps" {...b("show_steps")} />
          <Toggle label="Show the 2 photos" {...b("show_gallery")} />
          {f.show_gallery && (
            <>
              <ImageField label="Photo 1" value={f.gallery_1} onChange={(v) => setF({ ...f, gallery_1: v })} testId="content-gallery-1" />
              <ImageField label="Photo 2" value={f.gallery_2} onChange={(v) => setF({ ...f, gallery_2: v })} testId="content-gallery-2" />
            </>
          )}
        </div>
      </Panel>
      <Panel title="Visit us section" hint="Shows your hours, address, phone and email (edit those under General).">
        <div className="grid gap-4 sm:grid-cols-2">
          <Toggle label="Show this section" {...b("show_visit")} />
          <div><L>Heading</L><Input {...t("visit_title")} maxLength={120} /></div>
        </div>
      </Panel>
      <div className="flex gap-2">
        <button onClick={save} data-testid="content-save-btn" className={btnPrimary}>Save booking page</button>
        <a href="/" target="_blank" rel="noreferrer" data-testid="content-preview-link" className={btnGhost}><ExternalLink className="h-4 w-4" /> Open booking page</a>
      </div>
    </div>
  );
}
