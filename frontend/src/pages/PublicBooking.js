import { useEffect, useState } from "react";
import { MapPin, Phone, Mail, Clock, Check, ArrowRight, ArrowLeft, CalendarDays, Minus, Plus, UtensilsCrossed } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { MenuView } from "../components/MenuView";
import { PushSlider } from "../components/PushSlider";
import { toast } from "sonner";
import { api, formatApiError, toDateStr, prettyDate } from "../lib/api";
import { useSite } from "../context/SiteContext";
import { btnPrimary, btnGhost, card } from "../lib/status";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Calendar } from "../components/ui/calendar";

const Label = ({ children }) => <div className="mb-2 text-sm font-semibold text-slate-800">{children}</div>;
const chip = (on) => `rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors duration-200 ${on ? "border-[#120092] bg-[#120092] text-white" : "border-border bg-white text-slate-600 hover:border-[#120092]/40 hover:text-[#120092]"}`;

function DateTrigger({ value, open, onToggle }) {
  return (
    <button type="button" onClick={onToggle} aria-expanded={open} data-testid="booking-date-input" className={`flex h-12 w-full items-center gap-2 rounded-xl border bg-white px-3 text-left text-sm font-medium transition-colors hover:border-[#120092]/40 sm:gap-3 sm:px-4 ${open ? "border-[#120092]" : "border-input"}`}>
      <CalendarDays className="h-4 w-4 shrink-0 text-[#120092]" /><span className="truncate whitespace-nowrap">{prettyDate(value)}</span>
    </button>
  );
}

function InlineCalendar({ value, open, onPick }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (!open) return null;
  return (
    <div data-testid="booking-calendar">
      <div className="flex justify-center rounded-2xl border border-border bg-white">
        <Calendar mode="single" fixedWeeks selected={new Date(`${value}T12:00:00`)} defaultMonth={new Date(`${value}T12:00:00`)} disabled={{ before: today }}
          onSelect={(d) => d && onPick(toDateStr(d))} />
      </div>
    </div>
  );
}

const STEPS = ["Date & guests", "Time", "Your details"];

function BookingForm({ info, onDone }) {
  const [f, setF] = useState({ date: toDateStr(new Date()), time: "", party_size: 2, zone: "", name: "", email: "", phone: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const [avail, setAvail] = useState(null);
  const [reload, setReload] = useState(0);
  const [step, setStep] = useState(0);
  const [calOpen, setCalOpen] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const max = info?.max_party_online || 8;
  const slots = (avail || []).filter((s) => s.available).map((s) => s.time);

  useEffect(() => {
    let alive = true;
    setAvail(null);
    api.get("/public/availability", { params: { date: f.date, party_size: f.party_size, zone: f.zone || undefined } })
      .then(({ data }) => {
        if (!alive) return;
        setAvail(data.slots);
        setF((cur) => (cur.time && !data.slots.some((s) => s.time === cur.time && s.available) ? { ...cur, time: "" } : cur));
      })
      .catch(() => alive && setAvail([]));
    return () => { alive = false; };
  }, [f.date, f.party_size, f.zone, reload]);

  const submit = async (e) => {
    e.preventDefault();
    if (!f.time) return toast.error("Please pick a time");
    setBusy(true);
    try {
      const { data } = await api.post("/public/reservations", { ...f, party_size: Number(f.party_size) });
      onDone(data);
    } catch (err) {
      toast.error(formatApiError(err));
      if (err?.response?.status === 409) { setReload((n) => n + 1); go(1); }
    } finally {
      setBusy(false);
    }
  };

  const stepOk = [true, !!f.time, true];
  const go = (n) => setStep(n);
  const onFormSubmit = (e) => {
    if (step < 2) {
      e.preventDefault();
      if (step === 1 && !f.time) return toast.error("Please pick a time");
      return go(step + 1);
    }
    submit(e);
  };
  const guestsLabel = `${f.party_size} ${f.party_size === 1 ? "guest" : "guests"}`;

  return (
    <form onSubmit={onFormSubmit} data-testid="booking-form">
      <div className="mb-6 grid grid-cols-3 gap-2" data-testid="booking-steps">
        {STEPS.map((label, i) => (
          <button key={label} type="button" aria-label={`Step ${i + 1}: ${label}`} title={label} disabled={i > step && !stepOk.slice(0, i).every(Boolean)} onClick={() => (i < step || stepOk.slice(0, i).every(Boolean)) && go(i)} data-testid={`booking-step-${i}`} className="py-1 text-left disabled:cursor-not-allowed">
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-[#120092] transition-[width] duration-200 ease-out" style={{ width: i <= step ? "100%" : "0%" }} />
            </div>
          </button>
        ))}
      </div>
      <div key={step} className="space-y-7" data-testid={`booking-slide-${step}`}>
      {step === 0 && (<>
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Date</Label><DateTrigger value={f.date} open={calOpen} onToggle={() => setCalOpen(!calOpen)} /></div>
        <div>
          <Label>Guests</Label>
          <div className="flex h-12 items-center rounded-xl border border-input bg-white">
            <button type="button" data-testid="booking-guests-minus" onClick={() => setF({ ...f, party_size: Math.max(1, f.party_size - 1) })} className="flex h-full w-12 items-center justify-center text-slate-500 hover:text-[#120092]"><Minus className="h-4 w-4" /></button>
            <span data-testid="booking-guests-value" className="flex-1 text-center font-display text-lg font-semibold">{f.party_size}</span>
            <button type="button" data-testid="booking-guests-plus" onClick={() => setF({ ...f, party_size: Math.min(max, f.party_size + 1) })} className="flex h-full w-12 items-center justify-center text-slate-500 hover:text-[#120092]"><Plus className="h-4 w-4" /></button>
          </div>
        </div>
      </div>
      <InlineCalendar value={f.date} open={calOpen} onPick={(date) => { setF({ ...f, date, time: "" }); setCalOpen(false); }} />
      <div>
        <Label>Seating preference</Label>
        <div className="flex flex-wrap gap-2">
          {["", ...(info?.zones || [])].map((z) => (
            <button key={z || "any"} type="button" data-testid={`booking-zone-${(z || "any").replace(/\s+/g, "-").toLowerCase()}`} onClick={() => setF({ ...f, zone: z })} className={chip(f.zone === z)}>{z || "No preference"}</button>
          ))}
        </div>
      </div>
      {info && f.party_size >= max && <p className="text-xs text-slate-500">Larger party? Call us on {info.phone}.</p>}
      </>)}
      {step === 1 && (
      <div>
        <Label>Time <span className="ml-1 text-xs font-medium text-slate-400">{prettyDate(f.date)} · {guestsLabel}{f.zone ? ` · ${f.zone}` : ""}</span></Label>
        {avail === null ? (
          <div className="flex flex-wrap gap-2" data-testid="booking-slots-loading">
            {Array.from({ length: 8 }, (_, i) => <span key={i} className="h-8 w-[60px] animate-pulse rounded-full bg-slate-100" />)}
          </div>
        ) : slots.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500" data-testid="booking-no-slots">
            {avail.length === 0 ? "No more times available on this date. Please choose another date." : `Fully booked for ${f.party_size} ${f.party_size === 1 ? "guest" : "guests"}${f.zone ? ` in ${f.zone}` : ""} on this date. Try another date${f.zone ? ", another area" : ""} or call us.`}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2" data-testid="booking-slots">
            {slots.map((s) => (
              <button key={s} type="button" data-testid={`booking-slot-${s.replace(":", "")}`} onClick={() => setF({ ...f, time: s })} className={chip(f.time === s)}>{s}</button>
            ))}
          </div>
        )}
      </div>
      )}
      {step === 2 && (<>
      <div className="flex items-center justify-between rounded-xl bg-[#120092]/[0.05] px-4 py-3 text-sm" data-testid="booking-summary">
        <span className="font-semibold text-[#120092]">{prettyDate(f.date)} · {f.time} · {guestsLabel}</span>
        <button type="button" onClick={() => go(0)} className="text-xs font-semibold text-slate-500 hover:text-[#120092]" data-testid="booking-summary-edit">Change</button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><Label>Full name</Label><Input value={f.name} onChange={set("name")} required data-testid="booking-name-input" className="h-12 rounded-xl" /></div>
        <div><Label>Email</Label><Input type="email" value={f.email} onChange={set("email")} required data-testid="booking-email-input" className="h-12 rounded-xl" /></div>
        <div><Label>Phone</Label><Input type="tel" value={f.phone} onChange={set("phone")} required minLength={5} data-testid="booking-phone-input" className="h-12 rounded-xl" /></div>
        <div className="sm:col-span-2"><Label>Allergies, occasion or requests</Label><Textarea value={f.notes} onChange={set("notes")} rows={3} data-testid="booking-notes-input" className="rounded-xl" placeholder="e.g. nut allergy, anniversary, high chair" /></div>
      </div>
      </>)}
      </div>
      <div className="mt-8 flex gap-3">
        {step > 0 && <button type="button" onClick={() => go(step - 1)} data-testid="booking-back-btn" className={`${btnGhost} px-6 py-4`}><ArrowLeft className="h-4 w-4" /> Back</button>}
        {step < 2 ? (
          <button type="submit" disabled={step === 1 && !f.time} data-testid="booking-next-btn" className={`${btnPrimary} brand-shadow group flex-1 py-4 text-base`}>
            {step === 0 ? "Choose a time" : "Your details"}<ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
          </button>
        ) : (
          <button type="submit" disabled={busy} data-testid="booking-submit-btn" className={`${btnPrimary} brand-shadow group flex-1 py-4 text-base`}>
            {busy ? "Sending…" : "Request reservation"}<ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
          </button>
        )}
      </div>
    </form>
  );
}

function Confirmation({ data, onReset }) {
  return (
    <div className="rise space-y-6 py-8 text-center" data-testid="booking-confirmation">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#120092] text-white brand-shadow"><Check className="h-8 w-8" /></div>
      <h3 className="font-display text-4xl font-semibold">You're on the list, {data.name.split(" ")[0]}.</h3>
      <p className="mx-auto max-w-md text-slate-600">
        Request for <b className="text-slate-900">{data.party_size} guests</b> on <b className="text-slate-900">{prettyDate(data.date)} at {data.time}</b> received. We'll confirm shortly.
      </p>
      <div className="inline-block rounded-2xl border border-dashed border-[#120092]/40 bg-[#120092]/[0.04] px-8 py-4">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Booking reference</div>
        <div className="mt-1 font-mono text-2xl font-medium tracking-[0.3em] text-[#120092]" data-testid="booking-reference">{data.ref}</div>
      </div>
      <div><button onClick={onReset} data-testid="booking-new-btn" className={btnGhost}>Make another reservation</button></div>
    </div>
  );
}

function RestaurantInfo({ info }) {
  const facts = [[Clock, info?.hours, "info-hours"], [MapPin, info?.address, "info-address"], [Phone, info?.phone, "info-phone"], [Mail, info?.email, "info-email"]];
  return (
    <aside className="rise order-2 lg:order-1 lg:sticky lg:top-12 lg:col-span-4 lg:self-start" data-testid="restaurant-info">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#120092] font-display text-xl font-bold text-white brand-shadow">{info?.name?.[0]}</span>
        <div>
          <h1 className="font-display text-3xl font-bold leading-none" data-testid="public-brand-name">{info?.name}</h1>
          {info?.tagline && <p className="mt-1 text-sm font-semibold text-[#120092]">{info.tagline}</p>}
        </div>
      </div>
      {info?.description && <p className="mt-6 text-slate-600">{info.description}</p>}
      <ul className="mt-8 space-y-4">
        {facts.filter(([, v]) => v).map(([Icon, v, id]) => (
          <li key={id} className="flex items-start gap-3 text-sm" data-testid={id}>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#120092]/[0.07] text-[#120092]"><Icon className="h-4 w-4" /></span>
            <span className="pt-1.5 text-slate-700">{v}</span>
          </li>
        ))}
      </ul>
      <Link to="/staff" data-testid="nav-staff-link" className="mt-10 inline-block text-xs font-medium text-slate-400 hover:text-[#120092]">Staff login</Link>
    </aside>
  );
}

export default function PublicBooking() {
  const { info } = useSite();
  const [done, setDone] = useState(null);
  const [params, setParams] = useSearchParams();
  const view = params.get("view") === "menu" ? "menu" : "book";
  const pick = (v) => setParams(v === "menu" ? { view: "menu" } : {}, { replace: true });

  return (
    <div className="hero-glow min-h-screen bg-white">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-6 py-10 lg:grid-cols-12 lg:gap-14 lg:px-10 lg:py-16">
        <RestaurantInfo info={info} />
        <main className="rise d1 order-1 min-w-0 lg:order-2 lg:col-span-8" id="book">
          <div className="mb-4 flex rounded-full border border-border bg-white p-1 card-shadow" data-testid="public-view-tabs">
            {[["book", "Book a table", CalendarDays], ["menu", "Menu", UtensilsCrossed]].map(([id, label, Icon]) => (
              <button key={id} onClick={() => pick(id)} data-testid={`public-tab-${id}`}
                className={`relative flex flex-1 items-center justify-center gap-2 rounded-full py-2.5 text-sm font-semibold transition-colors duration-300 ${view === id ? "text-white" : "text-slate-500 hover:text-slate-900"}`}>
                {view === id && (
                  <motion.span layoutId="public-tab-pill" transition={{ type: "spring", stiffness: 520, damping: 26, mass: 0.8 }} className="absolute inset-0 rounded-full bg-[#120092] brand-shadow">
                    <motion.span key={view} initial={{ scaleX: 1.12, scaleY: 0.82 }} animate={{ scaleX: 1, scaleY: 1 }} transition={{ type: "spring", stiffness: 380, damping: 12 }} className="absolute inset-0 rounded-full bg-[#120092]" />
                  </motion.span>
                )}
                <motion.span className="relative" animate={view === id ? { rotate: [0, -14, 10, 0], scale: [1, 1.25, 1] } : { rotate: 0, scale: 1 }} transition={{ duration: 0.5, ease: "easeOut" }}><Icon className="h-4 w-4" /></motion.span>
                <motion.span className="relative" whileTap={{ scale: 0.94 }}>{label}</motion.span>
              </button>
            ))}
          </div>
          <PushSlider index={view === "menu" ? 1 : 0} onSwipe={(i) => pick(i === 1 ? "menu" : "book")}>
            {[
              <div key="book" className={`${card} p-6 sm:p-10`} data-testid="pane-book">
                {!done && (
                  <div className="mb-8">
                    <h2 className="font-display text-3xl font-bold sm:text-4xl" data-testid="booking-title">{info?.booking_title || "Book a table"}</h2>
                    {info?.booking_text && <p className="mt-2 text-sm text-slate-500">{info.booking_text}</p>}
                  </div>
                )}
                {done ? <Confirmation data={done} onReset={() => setDone(null)} /> : <BookingForm info={info} onDone={setDone} />}
              </div>,
              <div key="menu" className={`${card} p-6 sm:p-10`} data-testid="pane-menu">
                <h2 className="mb-6 font-display text-3xl font-bold sm:text-4xl" data-testid="menu-title">Menu</h2>
                <MenuView />
                <button onClick={() => pick("book")} className={`${btnPrimary} mt-8 w-full py-3.5`} data-testid="menu-book-btn">Book a table <ArrowRight className="h-4 w-4" /></button>
              </div>,
            ]}
          </PushSlider>
        </main>
      </div>
    </div>
  );
}
