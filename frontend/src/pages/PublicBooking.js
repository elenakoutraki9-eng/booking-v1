import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, Phone, Mail, Clock, Check, ArrowRight, CalendarDays, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiError, toDateStr, prettyDate } from "../lib/api";
import { useSite } from "../context/SiteContext";
import { btnPrimary, btnGhost, card } from "../lib/status";
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
  const [avail, setAvail] = useState(null);
  const [reload, setReload] = useState(0);
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
      if (err?.response?.status === 409) setReload((n) => n + 1);
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
        <Label>Time <span className="ml-1 text-xs font-medium text-slate-400">available for {f.party_size} {f.party_size === 1 ? "guest" : "guests"}</span></Label>
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
      <div>
        <Label>Seating preference</Label>
        <div className="flex flex-wrap gap-2">
          {["", ...(info?.zones || [])].map((z) => (
            <button key={z || "any"} type="button" data-testid={`booking-zone-${(z || "any").replace(/\s+/g, "-").toLowerCase()}`} onClick={() => setF({ ...f, zone: z })} className={chip(f.zone === z)}>{z || "No preference"}</button>
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

function RestaurantInfo({ info }) {
  const facts = [[Clock, info?.hours, "info-hours"], [MapPin, info?.address, "info-address"], [Phone, info?.phone, "info-phone"], [Mail, info?.email, "info-email"]];
  return (
    <aside className="rise lg:sticky lg:top-12 lg:col-span-4 lg:self-start" data-testid="restaurant-info">
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

  return (
    <div className="hero-glow min-h-screen bg-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-10 lg:grid-cols-12 lg:gap-14 lg:px-10 lg:py-16">
        <RestaurantInfo info={info} />
        <main className="rise d1 lg:col-span-8" id="book">
          <div className={`${card} p-6 sm:p-10`}>
            {!done && (
              <div className="mb-8">
                <h2 className="font-display text-3xl font-bold sm:text-4xl" data-testid="booking-title">{info?.booking_title || "Book a table"}</h2>
                {info?.booking_text && <p className="mt-2 text-sm text-slate-500">{info.booking_text}</p>}
              </div>
            )}
            {done ? <Confirmation data={done} onReset={() => setDone(null)} /> : <BookingForm info={info} onDone={setDone} />}
          </div>
        </main>
      </div>
    </div>
  );
}
