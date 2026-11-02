import { useEffect, useRef, useState, useCallback } from "react";
import { Plus, Move, Check } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiError } from "../lib/api";
import { TABLE_STATUS, btnPrimary, btnGhost } from "../lib/status";
import { useZones } from "../context/SiteContext";
import { PageHeader } from "../components/StaffLayout";
import { TablePanel, TableFormDialog } from "../components/TablePanel";
import { Sheet, SheetContent, SheetTitle } from "../components/ui/sheet";

const SIZE = { round: "h-20 w-20 rounded-full", square: "h-20 w-20 rounded-2xl", rect: "h-20 w-36 rounded-2xl" };

function minutesSince(iso) {
  return iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000)) : 0;
}

function useIsWide() {
  const [wide, setWide] = useState(window.innerWidth >= 1280);
  useEffect(() => {
    const on = () => setWide(window.innerWidth >= 1280);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return wide;
}

function TableNode({ t, selected, editMode, onSelect, onDragEnd, containerRef }) {
  const s = TABLE_STATUS[t.status];
  const [pos, setPos] = useState({ x: t.x, y: t.y });
  const drag = useRef(null);

  useEffect(() => {
    setPos({ x: t.x, y: t.y });
  }, [t.x, t.y]);

  const down = (e) => {
    if (!editMode) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y, moved: false };
  };
  const move = (e) => {
    if (!drag.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const nx = drag.current.ox + ((e.clientX - drag.current.sx) / rect.width) * 100;
    const ny = drag.current.oy + ((e.clientY - drag.current.sy) / rect.height) * 100;
    drag.current.moved = true;
    setPos({ x: Math.min(92, Math.max(0, nx)), y: Math.min(88, Math.max(0, ny)) });
  };
  const up = () => {
    if (drag.current?.moved) onDragEnd(t, pos);
    drag.current = null;
  };

  return (
    <button
      data-testid={`floor-table-${t.name}`}
      onClick={() => !editMode && onSelect(t)}
      onPointerDown={down} onPointerMove={move} onPointerUp={up}
      style={{ left: `${pos.x}%`, top: `${pos.y}%`, touchAction: editMode ? "none" : "auto" }}
      className={`absolute flex flex-col items-center justify-center border-2 bg-white shadow-sm transition-[box-shadow,transform] duration-200 ${SIZE[t.shape]} ${s.cls} ${selected ? "scale-105 ring-4 ring-[#120092]/25 ring-offset-2" : "hover:scale-105 hover:shadow-md"} ${t.status === "seated" ? "pulse-seated" : ""} ${editMode ? "cursor-move" : "cursor-pointer"}`}
    >
      <span className="font-display text-base font-bold text-slate-900">{t.name}</span>
      <span className="text-[11px] font-medium opacity-80">{t.capacity} seats</span>
      {t.status === "seated" && <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-amber-500 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white" data-testid={`floor-timer-${t.name}`}>{minutesSince(t.seated_at)}m</span>}
    </button>
  );
}

export default function FloorPlan() {
  const [tables, setTables] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [zone, setZone] = useState("all");
  const [adding, setAdding] = useState(false);
  const [, tick] = useState(0);
  const ref = useRef(null);
  const wide = useIsWide();
  const zones = useZones();

  const load = useCallback(async () => {
    const { data } = await api.get("/tables");
    setTables(data);
  }, []);

  useEffect(() => {
    load();
    const i = setInterval(() => { tick((n) => n + 1); load(); }, 30000);
    return () => clearInterval(i);
  }, [load]);

  const onDragEnd = async (t, pos) => {
    setTables((ts) => ts.map((x) => (x.id === t.id ? { ...x, ...pos } : x)));
    try {
      await api.patch(`/tables/${t.id}`, pos);
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const shown = tables.filter((t) => zone === "all" || t.zone === zone);
  const selected = tables.find((t) => t.id === selectedId);
  const panel = <TablePanel table={selected} onChange={load} onDeleted={() => { setSelectedId(null); load(); }} />;

  return (
    <div>
      <PageHeader eyebrow="Live" title="Floor plan">
        <button onClick={() => setEditMode(!editMode)} data-testid="floor-edit-toggle" className={editMode ? btnPrimary : btnGhost}>
          {editMode ? <><Check className="h-4 w-4" /> Done arranging</> : <><Move className="h-4 w-4" /> Arrange tables</>}
        </button>
        <button onClick={() => setAdding(true)} data-testid="floor-add-table-btn" className={`${btnPrimary} brand-shadow`}><Plus className="h-4 w-4" /> Add table</button>
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-full border border-border bg-white p-1">
          {["all", ...zones].map((z) => (
            <button key={z} onClick={() => setZone(z)} data-testid={`floor-zone-${z.replace(/\s+/g, "-").toLowerCase()}`}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${zone === z ? "bg-[#120092] text-white" : "text-slate-500 hover:text-slate-900"}`}>{z === "all" ? "All" : z}</button>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap gap-4">
          {Object.entries(TABLE_STATUS).map(([k, s]) => (
            <span key={k} className="flex items-center gap-1.5 text-xs font-medium text-slate-600"><span className={`h-2 w-2 rounded-full ${s.dot}`} />{s.label}</span>
          ))}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-12">
        <div className="overflow-x-auto rounded-2xl border border-border card-shadow xl:col-span-8">
          <div ref={ref} className="dot-grid relative h-[560px] min-w-[640px]" data-testid="floor-canvas">
            {editMode && <div className="absolute left-3 top-3 z-10 rounded-full bg-[#120092] px-3 py-1 text-xs font-semibold text-white">Drag tables to rearrange</div>}
            {shown.map((t) => (
              <TableNode key={t.id} t={t} selected={t.id === selectedId} editMode={editMode} onSelect={(x) => setSelectedId(x.id)} onDragEnd={onDragEnd} containerRef={ref} />
            ))}
          </div>
        </div>
        {wide && <div className="xl:col-span-4">{panel}</div>}
      </div>
      {!wide && (
        <Sheet open={!!selected} onOpenChange={(o) => !o && setSelectedId(null)}>
          <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-3xl bg-[#F8F8FC] p-4" data-testid="table-sheet">
            <SheetTitle className="sr-only">Table details</SheetTitle>
            {panel}
          </SheetContent>
        </Sheet>
      )}
      <TableFormDialog open={adding} onOpenChange={setAdding} onSaved={load} />
    </div>
  );
}
