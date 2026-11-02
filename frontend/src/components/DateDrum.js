import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion, animate, useMotionValue, useTransform } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toDateStr, prettyDate } from "../lib/api";

export const shiftDate = (d, n) => { const x = new Date(`${d}T12:00:00`); x.setDate(x.getDate() + n); return toDateStr(x); };
const daysBetween = (a, b) => Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / 86400000);

const STEP = 15;
const WINDOW = 7;
const spring = { type: "spring", stiffness: 170, damping: 24, mass: 0.9 };

function useWidth(ref) {
  const [w, setW] = useState(800);
  useLayoutEffect(() => {
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

function DrumChip({ i, base, idx, rotation, w, radius, count, onPick }) {
  const d = shiftDate(base, i);
  const active = i === idx;
  const today = d === toDateStr(new Date());
  const rel = useTransform(rotation, (r) => i * STEP + r);
  const opacity = useTransform(rel, (a) => Math.max(0, Math.cos((a * Math.PI) / 180)) ** 1.2);
  const pointerEvents = useTransform(rel, (a) => (Math.abs(a) > 75 ? "none" : "auto"));
  return (
    <motion.button
      onClick={() => onPick(d)}
      data-testid={`date-chip-${d}`}
      style={{ width: w, marginLeft: -w / 2, opacity, pointerEvents, transform: `rotateY(${i * STEP}deg) translateZ(${radius}px)`, backfaceVisibility: "hidden" }}
      className={`absolute top-1 h-[52px] rounded-xl border text-center transition-[background-color,border-color,color,box-shadow] duration-300 ${active ? "border-[#120092] bg-[#120092] text-white brand-shadow" : "border-border bg-white text-slate-700 hover:border-[#120092]/40"}`}
    >
      <span className="block truncate px-1 text-xs font-semibold">{prettyDate(d)}</span>
      <span className={`mt-0.5 block text-[11px] ${active ? "text-white/70" : "text-slate-400"}`}>{count || 0} covers</span>
      {today && <span className={`absolute right-2 top-1.5 h-1.5 w-1.5 rounded-full ${active ? "bg-white" : "bg-[#120092]"}`} />}
    </motion.button>
  );
}

export function DateDrum({ date, onChange, counts }) {
  const box = useRef(null);
  const width = useWidth(box);
  const [base, setBase] = useState(date);
  const rotation = useMotionValue(0);
  const lock = useRef(0);
  const idx = daysBetween(base, date);
  const w = Math.min(170, Math.max(84, width / 6.2));
  const radius = (w / 2 + 6) / Math.tan(((STEP / 2) * Math.PI) / 180);

  useEffect(() => {
    if (Math.abs(idx) > 40) {
      setBase(date);
      rotation.set(0);
      return;
    }
    const target = -idx * STEP;
    if (Math.abs(target - rotation.get()) > STEP * 7) rotation.set(target);
    else animate(rotation, target, spring);
  }, [idx, date, rotation]);

  const go = (n) => onChange(shiftDate(date, n));
  const onWheel = (e) => {
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (Math.abs(delta) < 12 || Date.now() - lock.current < 220) return;
    lock.current = Date.now();
    go(delta > 0 ? 1 : -1);
  };
  const onPan = (_, info) => rotation.set(-idx * STEP + (info.offset.x / w) * STEP);
  const onPanEnd = (_, info) => {
    const n = Math.round(-info.offset.x / w);
    if (n) go(n);
    else animate(rotation, -idx * STEP, spring);
  };

  const navBtn = "rounded-xl border border-border bg-white p-2.5 transition-colors hover:border-[#120092]/40 hover:text-[#120092]";
  return (
    <>
      <motion.button whileTap={{ scale: 0.88 }} onClick={() => go(-1)} data-testid="date-prev-btn" className={navBtn}><ChevronLeft className="h-4 w-4" /></motion.button>
      <motion.div
        ref={box}
        onWheel={onWheel}
        onPan={onPan}
        onPanEnd={onPanEnd}
        data-testid="date-wheel"
        className="relative h-[60px] flex-1 cursor-grab touch-pan-y select-none overflow-hidden active:cursor-grabbing"
        style={{ perspective: 2000, WebkitMaskImage: "linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)", maskImage: "linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)" }}
      >
        <motion.div className="absolute left-1/2 top-0 h-full" style={{ transformStyle: "preserve-3d", z: -radius, rotateY: rotation }}>
          {Array.from({ length: WINDOW * 2 + 1 }, (_, k) => idx - WINDOW + k).map((i) => (
            <DrumChip key={i} i={i} base={base} idx={idx} rotation={rotation} w={w} radius={radius} count={counts[shiftDate(base, i)]} onPick={onChange} />
          ))}
        </motion.div>
      </motion.div>
      <motion.button whileTap={{ scale: 0.88 }} onClick={() => go(1)} data-testid="date-next-btn" className={navBtn}><ChevronRight className="h-4 w-4" /></motion.button>
    </>
  );
}
