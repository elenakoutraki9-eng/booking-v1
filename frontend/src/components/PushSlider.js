import { useLayoutEffect, useRef, useState } from "react";
import { motion, animate, useMotionValue } from "framer-motion";

const spring = { type: "spring", stiffness: 260, damping: 32, mass: 0.9 };

export function PushSlider({ index, onSwipe, children }) {
  const refs = useRef([]);
  const [height, setHeight] = useState("auto");
  const panX = useMotionValue(0);
  const touch = useRef(false);

  const onPanStart = (e) => { touch.current = e.pointerType !== "mouse"; };
  const onPan = (_, info) => {
    if (!touch.current) return;
    const edge = (index === 0 && info.offset.x > 0) || (index === children.length - 1 && info.offset.x < 0);
    panX.set(info.offset.x * (edge ? 0.15 : 0.45));
  };
  const onPanEnd = (_, info) => {
    if (!touch.current) return;
    animate(panX, 0, spring);
    const dx = info.offset.x;
    if (Math.abs(dx) < 60 && Math.abs(info.velocity.x) < 450) return;
    const next = index + (dx < 0 ? 1 : -1);
    if (next >= 0 && next < children.length) onSwipe(next);
  };

  useLayoutEffect(() => {
    const el = refs.current[index];
    if (!el) return;
    const ro = new ResizeObserver(() => setHeight(el.offsetHeight));
    ro.observe(el);
    setHeight(el.offsetHeight);
    return () => ro.disconnect();
  }, [index]);

  return (
    <motion.div className="touch-pan-y overflow-hidden" animate={{ height }} transition={spring} onPanStart={onPanStart} onPan={onPan} onPanEnd={onPanEnd} data-testid="push-slider">
      <motion.div style={{ x: panX }}>
      <motion.div className="flex items-start" animate={{ x: `${-index * 100}%` }} transition={spring}>
        {children.map((child, i) => (
          <motion.div
            key={i}
            ref={(el) => { refs.current[i] = el; }}
            className="w-full shrink-0 px-1 pb-1"
            animate={{ opacity: i === index ? 1 : 0.35, scale: i === index ? 1 : 0.94 }}
            transition={spring}
            inert={i !== index ? true : undefined}
            aria-hidden={i !== index}
          >
            {child}
          </motion.div>
        ))}
      </motion.div>
      </motion.div>
    </motion.div>
  );
}
