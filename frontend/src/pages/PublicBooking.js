import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, Phone, Mail, Clock, Users, CalendarDays, Check, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiError, toDateStr, prettyDate } from "../lib/api";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";

const Label = ({ children }) => (
  <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.25em] text-[#D4A359]/90">{children}</div>
);

function BookingForm({ info, onDone }) {
  const [f, setF] = useState({ date: toDateStr(new Date()), time: "", party_size: 2, zone: "", name: "", email: "", phone: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const today = toDateStr(new Date());
  const nowHM = new Date().toTimeString().slice(0, 5);
  const slots = (info?.slots || []).filter((s) => f.date !== today || s > nowHM);

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
        <div>
          <Label>Date</Label>
          <Input type="date" min={today} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value, time: "" })} required data-testid="booking-date-input" className="h-12 bg-[#120E0D] [color-scheme:dark]" />
        </div>
        <div>
          <Label>Guests</Label>
          <div className="flex h-12 items-center rounded-md border border-input bg-[#120E0D]">
            <button type="button" data-testid="booking-guests-minus" onClick={() => setF({ ...f, party_size: Math.max(1, f.party_size - 1) })} className="h-full w-12 text-xl text-[#B0A59A] transition-colors hover:text-[#D4A359]">−</button>
            <span data-testid="booking-guests-value" className="flex-1 text-center font-outfit text-lg">{f.party_size}</span>
            <button type="button" data-testid="booking-guests-plus" onClick={() => setF({ ...f, party_size: Math.min(info?.max_party_online || 8, f.party_size + 1) })} className="h-full w-12 text-xl text-[#B0A59A] transition-colors hover:text-[#D4A359]">+</button>
          </div>
        </div>
      </div>

      <div>
        <Label>Time</Label>
        {slots.length === 0 ? (
          <p className="text-sm text-[#786E65]" data-testid="booking-no-slots">No more times available today — please choose another date.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {slots.map((s) => (
              <button key={s} type="button" data-testid={`booking-slot-${s.replace(":", "")}`} onClick={() => setF({ ...f, time: s })}
                className={`rounded-full border px-3.5 py-1.5 font-mono text-xs transition-colors duration-200 ${f.time === s ? "border-[#D4A359] bg-[#D4A359] text-[#120E0D]" : "border-[#332B25] text-[#B0A59A] hover:border-[#D4A359]/60 hover:text-[#F7F4EF]"}`}>
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <Label>Seating preference</Label>
        <div className="flex flex-wrap gap-2">
          {["", ...(info?.zones || [])].map((z) => (
            <button key={z || "any"} type="button" data-testid={`booking-zone-${(z || "any").replace(" ", "-").toLowerCase()}`} onClick={() => setF({ ...f, zone: z })}
              className={`rounded-lg border px-4 py-2 text-sm transition-colors duration-200 ${f.zone === z ? "border-[#D4A359] text-[#D4A359]" : "border-[#332B25] text-[#B0A59A] hover:text-[#F7F4EF]"}`}>
              {z || "No preference"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label>Full name</Label>
          <Input value={f.name} onChange={set("name")} required data-testid="booking-name-input" className="h-12 bg-[#120E0D]" />
        </div>
        <div>
          <Label>Email</Label>
          <Input type="email" value={f.email} onChange={set("email")} required data-testid="booking-email-input" className="h-12 bg-[#120E0D]" />
        </div>
        <div>
          <Label>Phone</Label>
          <Input type="tel" value={f.phone} onChange={set("phone")} required minLength={5} data-testid="booking-phone-input" className="h-12 bg-[#120E0D]" />
        </div>
        <div className="sm:col-span-2">
          <Label>Allergies, occasion or special requests</Label>
          <Textarea value={f.notes} onChange={set("notes")} rows={3} data-testid="booking-notes-input" className="bg-[#120E0D]" placeholder="e.g. nut allergy, anniversary, high chair" />
        </div>
      </div>

      <button type="submit" disabled={busy} data-testid="booking-submit-btn"
        className="group flex w-full items-center justify-center gap-3 rounded-full bg-[#D4A359] py-4 font-outfit text-sm font-semibold uppercase tracking-[0.2em] text-[#120E0D] transition-colors duration-200 hover:bg-[#E5B86C] disabled:opacity-60">
        {busy ? "Sending…" : "Request reservation"}
        <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
      </button>
      {info && f.party_size >= info.max_party_online && (
        <p className="text-xs text-[#786E65]">Larger party? Call us on {info.phone}.</p>
      )}
    </form>
  );
}

function Confirmation({ data, onReset }) {
  return (
    <div className="rise space-y-6 py-6 text-center" data-testid="booking-confirmation">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[#D4A359] text-[#D4A359]">
        <Check className="h-7 w-7" />
      </div>
      <h3 className="font-serif-d text-4xl">Thank you, {data.name.split(" ")[0]}</h3>
      <p className="text-[#B0A59A]">
        Your request for <span className="text-[#F7F4EF]">{data.party_size} guests</span> on{" "}
        <span className="text-[#F7F4EF]">{prettyDate(data.date)} at {data.time}</span> has been received. We'll confirm shortly.
      </p>
      <div className="inline-block rounded-xl border border-[#332B25] px-8 py-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#786E65]">Booking reference</div>
        <div className="mt-1 font-mono text-2xl tracking-[0.3em] text-[#D4A359]" data-testid="booking-reference">{data.ref}</div>
      </div>
      <div>
        <button onClick={onReset} data-testid="booking-new-btn" className="text-sm text-[#B0A59A] underline-offset-4 hover:text-[#D4A359] hover:underline">Make another reservation</button>
      </div>
    </div>
  );
}

export default function PublicBooking() {
  const [info, setInfo] = useState(null);
  const [done, setDone] = useState(null);

  useEffect(() => {
    api.get("/public/info").then((r) => setInfo(r.data)).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-[#120E0D]">
      <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-6 py-6 lg:px-12">
        <div className="font-serif-d text-2xl tracking-wide" data-testid="public-brand-name">{info?.name || " "}</div>
        <div className="flex items-center gap-6">
          <a href="#book" data-testid="nav-book-link" className="font-mono text-[11px] uppercase tracking-[0.25em] text-[#F7F4EF]/80 hover:text-[#D4A359]">Reserve</a>
          <Link to="/staff" data-testid="nav-staff-link" className="font-mono text-[11px] uppercase tracking-[0.25em] text-[#F7F4EF]/50 hover:text-[#D4A359]">Staff</Link>
        </div>
      </header>

      <section className="grain relative flex min-h-[92vh] items-end overflow-hidden">
        <img src="/images/hero.jpg" alt="Dining room" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#120E0D] via-[#120E0D]/60 to-[#120E0D]/30" />
        <div className="relative z-10 max-w-4xl px-6 pb-20 lg:px-12">
          <div className="rise mb-6 font-mono text-xs uppercase tracking-[0.35em] text-[#D4A359]">{info?.tagline}</div>
          <h1 className="rise d1 font-serif-d text-5xl font-medium leading-[0.95] tracking-tight sm:text-6xl lg:text-8xl">{info?.name}</h1>
          <p className="rise d2 mt-6 max-w-xl text-base text-[#B0A59A] md:text-lg">{info?.description}</p>
          <a href="#book" data-testid="hero-reserve-btn" className="rise d3 mt-10 inline-flex items-center gap-3 rounded-full bg-[#D4A359] px-8 py-4 font-outfit text-sm font-semibold uppercase tracking-[0.2em] text-[#120E0D] transition-colors hover:bg-[#E5B86C]">
            Reserve a table <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </section>

      <section id="book" className="mx-auto grid max-w-7xl gap-16 px-6 py-24 lg:grid-cols-12 lg:px-12">
        <div className="lg:col-span-5">
          <div className="font-mono text-xs uppercase tracking-[0.3em] text-[#D4A359]">Reservations</div>
          <h2 className="mt-4 font-serif-d text-4xl leading-tight sm:text-5xl">An evening, held for you.</h2>
          <p className="mt-6 text-[#B0A59A]">Choose your date, time and party size. Our team reviews every request and confirms by email or phone.</p>
          <div className="mt-12 space-y-5 text-sm">
            {[[Clock, info?.hours, "info-hours"], [MapPin, info?.address, "info-address"], [Phone, info?.phone, "info-phone"], [Mail, info?.email, "info-email"]].map(([Icon, v, id]) => (
              <div key={id} className="flex items-start gap-4" data-testid={id}>
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#D4A359]" />
                <span className="text-[#B0A59A]">{v}</span>
              </div>
            ))}
          </div>
          <div className="mt-12 hidden grid-cols-2 gap-4 lg:grid">
            <img src="/images/dish.jpg" alt="Signature dish" className="h-56 w-full rounded-xl object-cover" />
            <img src="/images/bar.jpg" alt="Cocktail bar" className="mt-10 h-56 w-full rounded-xl object-cover" />
          </div>
        </div>
        <div className="lg:col-span-7">
          <div className="rounded-2xl border border-[#332B25] bg-[#1C1714] p-6 sm:p-10">
            <div className="mb-8 flex items-center gap-3 text-[#786E65]">
              <CalendarDays className="h-4 w-4" /><span className="font-mono text-[10px] uppercase tracking-[0.3em]">Book a table</span>
              <Users className="ml-auto h-4 w-4" />
            </div>
            {done ? <Confirmation data={done} onReset={() => setDone(null)} /> : <BookingForm info={info} onDone={setDone} />}
          </div>
        </div>
      </section>

      <footer className="border-t border-[#332B25] px-6 py-10 lg:px-12">
        <div className="flex flex-col justify-between gap-4 text-xs text-[#786E65] sm:flex-row">
          <span className="font-serif-d text-lg text-[#B0A59A]">{info?.name}</span>
          <span>© {new Date().getFullYear()} · {info?.address}</span>
        </div>
      </footer>
    </div>
  );
}
