import { useEffect, useRef, useState, useCallback } from "react";
import { Plus, Move, Check } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiError } from "../lib/api";
import { TABLE_STATUS, ZONES } from "../lib/status";
import { PageHeader } from "../components/StaffLayout";
import { TablePanel, TableFormDialog } from "../components/TablePanel";

const SIZE = { round: "h-20 w-20 rounded-full", square: "h-20 w-20 rounded-xl", rect: "h-20 w-36 rounded-xl" };

function minutesSince(iso) {
  return iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000)) : 0;
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
      className={`absolute flex flex-col items-center justify-center border-2 transition-[box-shadow,transform] duration-200 ${SIZE[t.shape]} ${s.cls} ${selected ? "scale-105 ring-2 ring-[#D4A359] ring-offset-2 ring-offset-[#16110f]" : "hover:scale-105"} ${t.status === "seated" ? "pulse-seated" : ""} ${editMode ? "cursor-move" : "cursor-pointer"}`}
    >
      <span className="font-outfit text-base font-semibold text-[#F7F4EF]">{t.name}</span>
      <span className="font-mono text-[10px] opacity-80">{t.capacity}p</span>
      {t.status === "seated" && <span className="font-mono text-[10px]" data-testid={`floor-timer-${t.name}`}>{minutesSince(t.seated_at)}m</span>}
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

  return (
    <div>
      <PageHeader eyebrow="Live" title="Floor plan">
        <button onClick={() => setEditMode(!editMode)} data-testid="floor-edit-toggle"
          className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors ${editMode ? "border-[#D4A359] bg-[#D4A359] text-[#120E0D]" : "border-[#332B25] text-[#B0A59A] hover:text-[#F7F4EF]"}`}>
          {editMode ? <><Check className="h-4 w-4" /> Done arranging</> : <><Move className="h-4 w-4" /> Arrange tables</>}
        </button>
        <button onClick={() => setAdding(true)} data-testid="floor-add-table-btn" className="flex items-center gap-2 rounded-full bg-[#D4A359] px-4 py-2 text-sm font-semibold text-[#120E0D] hover:bg-[#E5B86C]">
          <Plus className="h-4 w-4" /> Add table
        </button>
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {["all", ...ZONES].map((z) => (
          <button key={z} onClick={() => setZone(z)} data-testid={`floor-zone-${z.replace(" ", "-").toLowerCase()}`}
            className={`rounded-full border px-3 py-1 text-xs ${zone === z ? "border-[#D4A359] text-[#D4A359]" : "border-[#332B25] text-[#786E65] hover:text-[#F7F4EF]"}`}>{z === "all" ? "All zones" : z}</button>
        ))}
        <div className="ml-auto flex flex-wrap gap-4">
          {Object.entries(TABLE_STATUS).map(([k, s]) => (
            <span key={k} className="flex items-center gap-1.5 text-xs text-[#B0A59A]"><span className={`h-2 w-2 rounded-full ${s.dot}`} />{s.label}</span>
          ))}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-12">
        <div className="overflow-x-auto rounded-xl border border-[#332B25] xl:col-span-8">
          <div ref={ref} className="floor-grid relative h-[560px] min-w-[640px]" data-testid="floor-canvas">
            {editMode && <div className="absolute left-3 top-3 z-10 rounded-md bg-[#D4A359]/15 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-[#D4A359]">Drag tables to rearrange</div>}
            {shown.map((t) => (
              <TableNode key={t.id} t={t} selected={t.id === selectedId} editMode={editMode} onSelect={(x) => setSelectedId(x.id)} onDragEnd={onDragEnd} containerRef={ref} />
            ))}
          </div>
        </div>
        <div className="xl:col-span-4">
          <TablePanel table={selected} onChange={load} onDeleted={() => { setSelectedId(null); load(); }} />
        </div>
      </div>
      <TableFormDialog open={adding} onOpenChange={setAdding} onSaved={load} />
    </div>
  );
}
