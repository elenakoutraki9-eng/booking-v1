import { useEffect, useState } from "react";
import { Leaf, Sprout, WheatOff, Flame, Star, UtensilsCrossed } from "lucide-react";
import { api, eur } from "../lib/api";

export const TAGS = {
  vegetarian: { label: "Vegetarian", icon: Leaf, cls: "bg-emerald-50 text-emerald-700" },
  vegan: { label: "Vegan", icon: Sprout, cls: "bg-lime-50 text-lime-700" },
  gluten_free: { label: "Gluten-free", icon: WheatOff, cls: "bg-amber-50 text-amber-700" },
  spicy: { label: "Spicy", icon: Flame, cls: "bg-rose-50 text-rose-700" },
  signature: { label: "Signature", icon: Star, cls: "bg-[#120092]/[0.07] text-[#120092]" },
};

const Tag = ({ t }) => {
  const { label, icon: Icon, cls } = TAGS[t];
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}><Icon className="h-3 w-3" />{label}</span>;
};

function Item({ i }) {
  return (
    <li className="py-4" data-testid={`menu-item-${i.id}`}>
      <div className="flex items-baseline gap-3">
        <span className="font-semibold text-slate-900">{i.name}</span>
        <span className="flex-1 translate-y-[-3px] border-b border-dotted border-slate-300" />
        {i.price != null && <span className="font-display font-semibold text-[#120092]" data-testid={`menu-price-${i.id}`}>{eur(i.price)}</span>}
      </div>
      {i.description && <p className="mt-1 text-sm text-slate-500">{i.description}</p>}
      {i.tags?.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{i.tags.map((t) => <Tag key={t} t={t} />)}</div>}
    </li>
  );
}

export function MenuView() {
  const [cats, setCats] = useState(null);
  useEffect(() => {
    api.get("/public/menu").then((r) => setCats(r.data.categories)).catch(() => setCats([]));
  }, []);

  if (cats === null) return <div className="space-y-3">{[1, 2, 3, 4].map((k) => <div key={k} className="h-12 animate-pulse rounded-xl bg-slate-100" />)}</div>;
  if (cats.length === 0)
    return (
      <div className="py-14 text-center" data-testid="menu-empty">
        <UtensilsCrossed className="mx-auto h-8 w-8 text-[#120092]" />
        <p className="mt-3 font-semibold">Our menu is coming soon</p>
        <p className="mt-1 text-sm text-slate-500">Check back shortly, or book a table and ask our team.</p>
      </div>
    );

  return (
    <div data-testid="menu-view">
      {cats.length > 1 && (
        <div className="sticky top-0 z-10 -mx-1 mb-4 flex gap-2 overflow-x-auto bg-white/90 px-1 py-2 backdrop-blur-md">
          {cats.map((c) => (
            <a key={c.id} href={`#menu-${c.id}`} data-testid={`menu-jump-${c.id}`} className="whitespace-nowrap rounded-full border border-border px-3.5 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:border-[#120092]/40 hover:text-[#120092]">{c.name}</a>
          ))}
        </div>
      )}
      <div className="space-y-10">
        {cats.map((c) => (
          <section key={c.id} id={`menu-${c.id}`} className="scroll-mt-16" data-testid={`menu-category-${c.id}`}>
            <h3 className="font-display text-2xl font-bold">{c.name}</h3>
            {c.description && <p className="mt-1 text-sm text-slate-500">{c.description}</p>}
            <ul className="mt-2 divide-y divide-border">{c.items.map((i) => <Item key={i.id} i={i} />)}</ul>
          </section>
        ))}
      </div>
    </div>
  );
}
