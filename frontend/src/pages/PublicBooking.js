import { useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, Phone, Mail, Clock, Check, ArrowRight, CalendarDays, Minus, Plus, Sparkles, Star } from "lucide-react";
import { toast } from "sonner";
import { api, assetUrl, formatApiError, toDateStr, prettyDate } from "../lib/api";
import { useSite } from "../context/SiteContext";
import { btnPrimary, btnGhost, card, eyebrow } from "../lib/status";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Calendar } from "../components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";

const Label = ({ children }) => <div className="mb-2 text-sm font-semibold text-slate-800">{children}</div>;
const chip = (on) => `rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors duration-200 ${on ? "border-[#120092] bg-[#120092] text-white" : "border-border bg-white text-slate-600 hover:border-[#120092]/40 hover:text-[#120092]"}`;

function DatePick({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger data-testid="booking-date-input" className="flex h-12 w-full items-center gap-3 rounded-xl border border-input bg-white px-4 text-left text-sm font-medium hover:border-[#120092]/40">
        <CalendarDays className="h-4 w-4 text-[#120092]" />{prettyDate(value)}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={new Date(`${value}T12:00:00`)} disabled={{ before: today }}
          onSelect={(d) => { if (d) { onChange(toDateStr(d)); setOpen(false); } }} initialFocus />
      </PopoverContent>
    </Popover>
  );
}

function BookingForm({ info, onDone }) {
  const [f, setF] = useState({ date: toDateStr(new Date()), time: "", party_size: 2, zone: "", name: "", email: "", phone: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const today = toDateStr(new Date());
  const nowHM = new Date().toTimeString().slice(0, 5);
  const slots = (info?.slots || []).filter((s) => f.date !== today || s > nowHM);
  const max = info?.max_party_online || 8;

  const submit = async (e) => {
    e.preventDefault();
    if (!f.time) return toast.error("Please pick a time");
    setBusy(true);
    try {
      const { data } = await api.post("/public/reservations", { ...f, party_size: Number(f.party_size) });
      onDone(data);
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-7" data-testid="booking-form">
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Date</Label><DatePick value={f.date} onChange={(date) => setF({ ...f, date, time: "" })} /></div>
        <div>
          <Label>Guests</Label>
          <div className="flex h-12 items-center rounded-xl border border-input bg-white">
            <button type="button" data-testid="booking-guests-minus" onClick={() => setF({ ...f, party_size: Math.max(1, f.party_size - 1) })} className="flex h-full w-12 items-center justify-center text-slate-500 hover:text-[#120092]"><Minus className="h-4 w-4" /></button>
            <span data-testid="booking-guests-value" className="flex-1 text-center font-display text-lg font-semibold">{f.party_size}</span>
            <button type="button" data-testid="booking-guests-plus" onClick={() => setF({ ...f, party_size: Math.min(max, f.party_size + 1) })} className="flex h-full w-12 items-center justify-center text-slate-500 hover:text-[#120092]"><Plus className="h-4 w-4" /></button>
          </div>
        </div>
      </div>
      <div>
        <Label>Time</Label>
        {slots.length === 0 ? (
          <p className="text-sm text-slate-500" data-testid="booking-no-slots">No more times available today — please choose another date.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {slots.map((s) => (
              <button key={s} type="button" data-testid={`booking-slot-${s.replace(":", "")}`} onClick={() => setF({ ...f, time: s })} className={chip(f.time === s)}>{s}</button>
            ))}
          </div>
        )}
      </div>
      <div>
        <Label>Seating preference</Label>
        <div className="flex flex-wrap gap-2">
          {["", ...(info?.zones || [])].map((z) => (
            <button key={z || "any"} type="button" data-testid={`booking-zone-${(z || "any").replace(" ", "-").toLowerCase()}`} onClick={() => setF({ ...f, zone: z })} className={chip(f.zone === z)}>{z || "No preference"}</button>
          ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><Label>Full name</Label><Input value={f.name} onChange={set("name")} required data-testid="booking-name-input" className="h-12 rounded-xl" /></div>
        <div><Label>Email</Label><Input type="email" value={f.email} onChange={set("email")} required data-testid="booking-email-input" className="h-12 rounded-xl" /></div>
        <div><Label>Phone</Label><Input type="tel" value={f.phone} onChange={set("phone")} required minLength={5} data-testid="booking-phone-input" className="h-12 rounded-xl" /></div>
        <div className="sm:col-span-2"><Label>Allergies, occasion or requests</Label><Textarea value={f.notes} onChange={set("notes")} rows={3} data-testid="booking-notes-input" className="rounded-xl" placeholder="e.g. nut allergy, anniversary, high chair" /></div>
      </div>
      <button type="submit" disabled={busy} data-testid="booking-submit-btn" className={`${btnPrimary} brand-shadow group w-full py-4 text-base`}>
        {busy ? "Sending…" : "Request reservation"}<ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
      </button>
      {info && f.party_size >= max && <p className="text-xs text-slate-500">Larger party? Call us on {info.phone}.</p>}
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

function Hero({ info }) {
  return (
    <section className="hero-glow relative overflow-hidden">
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-6 pb-24 pt-16 lg:grid-cols-12 lg:px-10 lg:pt-24">
        <div className="lg:col-span-6">
          {info?.hero_badge && (
          <span className="rise inline-flex items-center gap-2 rounded-full border border-[#120092]/15 bg-[#120092]/[0.05] px-3 py-1 text-xs font-semibold text-[#120092]">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {info?.hero_badge}
          </span>
          )}
          <h1 className="rise d1 mt-6 font-display text-5xl font-bold leading-[0.95] sm:text-6xl lg:text-7xl">{info?.name}</h1>
          <p className="rise d2 mt-3 font-display text-2xl font-medium text-[#120092]">{info?.tagline}</p>
          <p className="rise d2 mt-6 max-w-lg text-base text-slate-600 md:text-lg">{info?.description}</p>
          <div className="rise d3 mt-10 flex flex-wrap gap-3">
            <a href="#book" data-testid="hero-reserve-btn" className={`${btnPrimary} brand-shadow px-7 py-3.5`}>{info?.cta_label} <ArrowRight className="h-4 w-4" /></a>
            {info?.show_visit && <a href="#visit" data-testid="hero-visit-btn" className={`${btnGhost} px-6 py-3.5`}>Hours & location</a>}
          </div>
          <div className="rise d4 mt-12 flex items-center gap-3 text-sm text-slate-500"><Clock className="h-4 w-4 text-[#120092]" />{info?.hours}</div>
        </div>
        <div className="relative lg:col-span-6">
          <div className="rise d2 overflow-hidden rounded-[2rem] border border-border card-shadow">
            {info && <img src={assetUrl(info.hero_image) || "/images/hero.jpg"} alt="Restaurant" data-testid="hero-image" className="h-[420px] w-full object-cover lg:h-[520px]" />}
          </div>
          {info?.show_hero_cards && <>
          <div className="float absolute -left-4 bottom-10 hidden rounded-2xl border border-border bg-white/90 p-4 backdrop-blur-xl card-shadow sm:block lg:-left-10">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#120092] text-white"><Check className="h-5 w-5" /></div>
              <div><div className="text-sm font-semibold">Table for 2 · 19:30</div><div className="text-xs text-slate-500">Confirmed in minutes</div></div>
            </div>
          </div>
          <div className="absolute -right-3 top-8 hidden rounded-2xl border border-border bg-white/90 px-4 py-3 backdrop-blur-xl card-shadow sm:block">
            <div className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-[#120092]" /> Seasonal menu</div>
          </div>
          </>}
        </div>
      </div>
    </section>
  );
}

export default function PublicBooking() {
  const { info } = useSite();
  const [done, setDone] = useState(null);

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#120092] font-display text-lg font-bold text-white">{info?.name?.[0]}</span>
            <span className="font-display text-xl font-semibold" data-testid="public-brand-name">{info?.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/staff" data-testid="nav-staff-link" className="hidden px-3 text-sm font-medium text-slate-500 hover:text-[#120092] sm:block">Staff login</Link>
            <a href="#book" data-testid="nav-book-link" className={btnPrimary}>Book a table</a>
          </div>
        </div>
      </header>

      <Hero info={info} />

      <section id="book" className="dot-grid border-y border-border">
        <div className="mx-auto grid max-w-7xl gap-14 px-6 py-24 lg:grid-cols-12 lg:px-10">
          <div className="lg:col-span-5">
            <div className={eyebrow}>Reservations</div>
            <h2 className="mt-3 font-display text-4xl font-bold leading-tight sm:text-5xl" data-testid="booking-title">{info?.booking_title}</h2>
            <p className="mt-5 max-w-md text-slate-600">{info?.booking_text}</p>
            {info?.show_steps && <ol className="mt-10 space-y-4" data-testid="booking-steps">
              {["Choose your date & time", "Tell us who's coming", "Get your booking reference"].map((s, i) => (
                <li key={s} className="flex items-center gap-4">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[#120092]/20 bg-white font-display font-semibold text-[#120092]">{i + 1}</span>
                  <span className="font-medium text-slate-800">{s}</span>
                </li>
              ))}
            </ol>}
            {info?.show_gallery && <div className="mt-12 hidden grid-cols-2 gap-4 lg:grid" data-testid="booking-gallery">
              <img src={assetUrl(info.gallery_1) || "/images/dish.jpg"} alt="Gallery 1" className="h-56 w-full rounded-2xl object-cover card-shadow" />
              <img src={assetUrl(info.gallery_2) || "/images/bar.jpg"} alt="Gallery 2" className="mt-10 h-56 w-full rounded-2xl object-cover card-shadow" />
            </div>}
          </div>
          <div className="lg:col-span-7">
            <div className={`${card} p-6 sm:p-10`}>
              {done ? <Confirmation data={done} onReset={() => setDone(null)} /> : <BookingForm info={info} onDone={setDone} />}
            </div>
          </div>
        </div>
      </section>

      {info?.show_visit && <section id="visit" className="mx-auto max-w-7xl px-6 py-24 lg:px-10" data-testid="visit-section">
        <div className={eyebrow}>Visit us</div>
        <h2 className="mt-3 font-display text-4xl font-bold">{info?.visit_title}</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[[Clock, "Hours", info?.hours, "info-hours"], [MapPin, "Address", info?.address, "info-address"], [Phone, "Phone", info?.phone, "info-phone"], [Mail, "Email", info?.email, "info-email"]].map(([Icon, t, v, id]) => (
            <div key={id} className={`${card} p-6 transition-transform duration-200 hover:-translate-y-1`} data-testid={id}>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#120092]/[0.07] text-[#120092]"><Icon className="h-5 w-5" /></div>
              <div className="mt-5 text-sm font-semibold">{t}</div>
              <div className="mt-1 text-sm text-slate-600">{v}</div>
            </div>
          ))}
        </div>
      </section>}

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-3 px-6 py-8 text-sm text-slate-500 sm:flex-row lg:px-10">
          <span className="flex items-center gap-2 font-display font-semibold text-slate-800"><Star className="h-4 w-4 text-[#120092]" />{info?.name}</span>
          <span>© {new Date().getFullYear()} · {info?.address}</span>
        </div>
      </footer>
    </div>
  );
}
