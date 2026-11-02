import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

const spring = { type: "spring", stiffness: 210, damping: 30, mass: 0.9 };

export function PageStack({ pageKey, order, children }) {
  const [pages, setPages] = useState([{ key: pageKey, el: children, dir: 1, leaving: false, first: true }]);
  const prevOrder = useRef(order);

  useEffect(() => {
    setPages((ps) => {
      const top = ps[ps.length - 1];
      if (top.key === pageKey) return ps.map((p) => (p.key === pageKey ? { ...p, el: children } : p));
      const dir = order >= prevOrder.current ? 1 : -1;
      prevOrder.current = order;
      return [...ps.filter((p) => !p.leaving).map((p) => ({ ...p, leaving: true, dir })), { key: pageKey, el: children, dir, leaving: false }];
    });
  }, [pageKey, order, children]);

  useEffect(() => {
    if (!pages.some((p) => p.leaving)) return;
    const t = setTimeout(() => setPages((ps) => ps.filter((p) => !p.leaving)), 650);
    return () => clearTimeout(t);
  }, [pages]);

  return (
    <div className="relative">
      {pages.map((p) => (
        <motion.div
          key={p.key}
          data-testid={p.leaving ? undefined : "page-transition"}
          initial={p.first ? false : { y: p.dir * 140, opacity: 0, scale: 0.98 }}
          animate={p.leaving ? { y: p.dir * -140, opacity: 0, scale: 0.98 } : { y: 0, opacity: 1, scale: 1 }}
          transition={spring}
          className={p.leaving ? "pointer-events-none absolute inset-x-0 top-0" : ""}
          aria-hidden={p.leaving || undefined}
        >
          {p.el}
        </motion.div>
      ))}
    </div>
  );
}
