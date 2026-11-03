import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, ArrowUp, ArrowDown, Eye, EyeOff, ExternalLink } from "lucide-react";
import { api, formatApiError } from "../lib/api";
import { btnPrimary, btnGhost, card } from "../lib/status";
import { TAGS } from "./MenuView";
import { Input } from "./ui/input";

const move = (arr, i, d) => { const n = [...arr]; [n[i], n[i + d]] = [n[i + d], n[i]]; return n; };
const iconBtn = "rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30";

function ItemRow({ item, idx, count, onChange, onMove, onDelete, testId }) {
  const set = (k, v) => onChange({ ...item, [k]: v });
  const toggleTag = (t) => set("tags", item.tags.includes(t) ? item.tags.filter((x) => x !== t) : [...item.tags, t]);
  return (
    <div className={`rounded-xl border p-3 ${item.available ? "border-border bg-white" : "border-dashed border-border bg-slate-50 opacity-70"}`} data-testid={testId}>
      <div className="flex gap-2">
        <Input value={item.name} onChange={(e) => set("name", e.target.value)} placeholder="Dish or drink name" maxLength={120} data-testid={`${testId}-name`} />
        <Input type="number" min={0} step="0.01" value={item.price ?? ""} onChange={(e) => set("price", e.target.value === "" ? null : Number(e.target.value))} placeholder="€" className="w-28" data-testid={`${testId}-price`} />
        <button onClick={() => set("available", !item.available)} title={item.available ? "Hide from menu" : "Show on menu"} className={iconBtn} data-testid={`${testId}-toggle`}>{item.available ? <Eye className="h-4 w-4 text-[#120092]" /> : <EyeOff className="h-4 w-4" />}</button>
        <button disabled={idx === 0} onClick={() => onMove(-1)} className={iconBtn} data-testid={`${testId}-up`}><ArrowUp className="h-4 w-4" /></button>
        <button disabled={idx === count - 1} onClick={() => onMove(1)} className={iconBtn} data-testid={`${testId}-down`}><ArrowDown className="h-4 w-4" /></button>
        <button onClick={onDelete} className={`${iconBtn} hover:!bg-rose-50 hover:!text-rose-600`} data-testid={`${testId}-delete`}><Trash2 className="h-4 w-4" /></button>
      </div>
      <Input value={item.description} onChange={(e) => set("description", e.target.value)} placeholder="Short description (optional)" maxLength={400} className="mt-2" data-testid={`${testId}-description`} />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {Object.entries(TAGS).map(([t, { label, icon: Icon, cls }]) => (
          <button key={t} onClick={() => toggleTag(t)} data-testid={`${testId}-tag-${t}`}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${item.tags.includes(t) ? cls : "bg-slate-100 text-slate-400 hover:text-slate-600"}`}>
            <Icon className="h-3 w-3" />{label}
          </button>
        ))}
      </div>
    </div>
  );
}

function CategoryCard({ cat, ci, count, onChange, onMove, onDelete }) {
  const items = cat.items;
  const setItems = (next) => onChange({ ...cat, items: next });
  const addItem = () => setItems([...items, { name: "", description: "", price: null, tags: [], available: true }]);
  return (
    <section className={`${card} p-5`} data-testid={`menu-cat-${ci}`}>
      <div className="flex gap-2">
        <Input value={cat.name} onChange={(e) => onChange({ ...cat, name: e.target.value })} placeholder="Category (e.g. Starters, Cocktails)" maxLength={80} className="font-semibold" data-testid={`menu-cat-${ci}-name`} />
        <button disabled={ci === 0} onClick={() => onMove(-1)} className={iconBtn} data-testid={`menu-cat-${ci}-up`}><ArrowUp className="h-4 w-4" /></button>
        <button disabled={ci === count - 1} onClick={() => onMove(1)} className={iconBtn} data-testid={`menu-cat-${ci}-down`}><ArrowDown className="h-4 w-4" /></button>
        <button onClick={() => window.confirm(`Delete "${cat.name || "this category"}" and its ${items.length} item(s)?`) && onDelete()} className={`${iconBtn} hover:!bg-rose-50 hover:!text-rose-600`} data-testid={`menu-cat-${ci}-delete`}><Trash2 className="h-4 w-4" /></button>
      </div>
      <Input value={cat.description} onChange={(e) => onChange({ ...cat, description: e.target.value })} placeholder="Category note (optional, e.g. served 12:00–15:00)" maxLength={300} className="mt-2" data-testid={`menu-cat-${ci}-description`} />
      <div className="mt-4 space-y-2">
        {items.map((it, ii) => (
          <ItemRow key={it.id || `new-${ii}`} item={it} idx={ii} count={items.length} testId={`menu-cat-${ci}-item-${ii}`}
            onChange={(v) => setItems(items.map((x, j) => (j === ii ? v : x)))}
            onMove={(d) => setItems(move(items, ii, d))}
            onDelete={() => setItems(items.filter((_, j) => j !== ii))} />
        ))}
      </div>
      <button onClick={addItem} className={`${btnGhost} mt-3`} data-testid={`menu-cat-${ci}-add-item`}><Plus className="h-4 w-4" /> Add item</button>
    </section>
  );
}

export function MenuEditor() {
  const [cats, setCats] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.get("/menu").then((r) => setCats(r.data.categories));
  }, []);
  if (!cats) return null;

  const save = async () => {
    const bad = cats.some((c) => !c.name.trim() || c.items.some((i) => !i.name.trim()));
    if (bad) return toast.error("Every category and item needs a name");
    setBusy(true);
    try {
      const { data } = await api.put("/menu", { categories: cats });
      setCats(data.categories);
      toast.success("Menu saved");
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="menu-editor">
      <p className="text-sm text-slate-500">Guests see this under the Menu tab on your booking page. Hidden items (eye icon) stay saved but aren't shown.</p>
      {cats.length === 0 && <div className="rounded-2xl border border-dashed border-[#120092]/25 bg-white p-8 text-center text-sm text-slate-500" data-testid="menu-editor-empty">No menu yet. Start by adding a category like "Starters" or "Cocktails".</div>}
      {cats.map((c, ci) => (
        <CategoryCard key={c.id || `new-${ci}`} cat={c} ci={ci} count={cats.length}
          onChange={(v) => setCats(cats.map((x, j) => (j === ci ? v : x)))}
          onMove={(d) => setCats(move(cats, ci, d))}
          onDelete={() => setCats(cats.filter((_, j) => j !== ci))} />
      ))}
      <div className="sticky bottom-4 flex flex-wrap gap-2 rounded-2xl border border-border bg-white/90 p-3 backdrop-blur-md card-shadow">
        <button onClick={() => setCats([...cats, { name: "", description: "", items: [] }])} className={btnGhost} data-testid="menu-add-category"><Plus className="h-4 w-4" /> Add category</button>
        <button onClick={save} disabled={busy} className={btnPrimary} data-testid="menu-save-btn">{busy ? "Saving…" : "Save menu"}</button>
        <a href="/?view=menu" target="_blank" rel="noreferrer" className={`${btnGhost} ml-auto`} data-testid="menu-preview-link"><ExternalLink className="h-4 w-4" /> Preview</a>
      </div>
    </div>
  );
}
