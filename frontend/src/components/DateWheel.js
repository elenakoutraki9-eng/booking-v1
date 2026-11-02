import { forwardRef, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toDateStr, prettyDate } from "../lib/api";

export const shiftDate = (d, n) => { const x = new Date(`${d}T12:00:00`); x.setDate(x.getDate() + n); return toDateStr(x); };

const spring = { type: "spring", stiffness: 420, damping: 34, mass: 0.8 };
const OFFSETS = [-3, -2, -1, 0, 1, 2, 3];

const Chip = forwardRef(function Chip({ d, n, count, onPick }, ref) {
  const active = n === 0;
  const dist = Math.abs(n);
  const today = d === toDateStr(new Date());
  return (
    <motion.button
      ref={ref}
      layout
      onClick={() => onPick(d)}
      data-testid={`date-chip-${d}`}
      initial={{ opacity: 0, scale: 0.85, y: 6 }}
      animate={{ opacity: 1 - dist * 0.14, scale: 1 - dist * 0.035, y: 0 }}
      exit={{ opacity: 0, scale: 0.85, y: -6 }}
      whileHover={{ y: -2, opacity: 1 }}
      whileTap={{ scale: 0.95 }}
      transition={spring}
      className={`${dist > 1 ? "hidden md:block" : ""} relative rounded-xl border px-1 py-2 text-center ${active ? "border-transparent" : "border-border bg-white"}`}
    >
      {active && <motion.span layoutId="date-wheel-active" transition={spring} className="absolute inset-0 rounded-xl bg-[#120092] brand-shadow" />}
      <span className="relative block">
        <span className={`block truncate text-xs font-semibold transition-colors duration-200 ${active ? "text-white" : "text-slate-700"}`}>{prettyDate(d)}</span>
        <span className={`mt-0.5 block text-[11px] transition-colors duration-200 ${active ? "text-white/70" : "text-slate-400"}`}>{count || 0} covers</span>
        {today && <span className={`absolute -top-1 right-1 h-1.5 w-1.5 rounded-full ${active ? "bg-white" : "bg-[#120092]"}`} />}
      </span>
    </motion.button>
  );
});

export function DateWheel({ date, onChange, counts }) {
  const lock = useRef(0);
  const onWheel = (e) => {
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (Math.abs(delta) < 12 || Date.now() - lock.current < 260) return;
    lock.current = Date.now();
    onChange(shiftDate(date, delta > 0 ? 1 : -1));
  };
  const navBtn = "rounded-xl border border-border bg-white p-2.5 transition-colors hover:border-[#120092]/40 hover:text-[#120092]";
  return (
    <>
      <motion.button whileTap={{ scale: 0.9, x: -2 }} onClick={() => onChange(shiftDate(date, -1))} data-testid="date-prev-btn" className={navBtn}><ChevronLeft className="h-4 w-4" /></motion.button>
      <motion.div
        onWheel={onWheel}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.25}
        onDragEnd={(_, info) => { if (Math.abs(info.offset.x) > 50) onChange(shiftDate(date, info.offset.x < 0 ? 1 : -1)); }}
        className="grid flex-1 cursor-grab touch-pan-y select-none grid-cols-3 gap-1.5 active:cursor-grabbing md:grid-cols-7"
        data-testid="date-wheel"
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {OFFSETS.map((n) => {
            const d = shiftDate(date, n);
            return <Chip key={d} d={d} n={n} count={counts[d]} onPick={onChange} />;
          })}
        </AnimatePresence>
      </motion.div>
      <motion.button whileTap={{ scale: 0.9, x: 2 }} onClick={() => onChange(shiftDate(date, 1))} data-testid="date-next-btn" className={navBtn}><ChevronRight className="h-4 w-4" /></motion.button>
    </>
  );
}
