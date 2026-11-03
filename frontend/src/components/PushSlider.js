import { useLayoutEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

const spring = { type: "spring", stiffness: 260, damping: 32, mass: 0.9 };

export function PushSlider({ index, children }) {
  const refs = useRef([]);
  const [height, setHeight] = useState("auto");

  useLayoutEffect(() => {
    const el = refs.current[index];
    if (!el) return;
    const ro = new ResizeObserver(() => setHeight(el.offsetHeight));
    ro.observe(el);
    setHeight(el.offsetHeight);
    return () => ro.disconnect();
  }, [index]);

  return (
    <motion.div className="overflow-hidden" animate={{ height }} transition={spring} data-testid="push-slider">
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
  );
}
