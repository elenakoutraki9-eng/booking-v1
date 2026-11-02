import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Crown, AlertTriangle, ArrowRight, CalendarCheck, Users, Armchair, Hourglass, Euro } from "lucide-react";
import { api, eur, toDateStr, prettyDate } from "../lib/api";
import { TABLE_STATUS, ResBadge, card } from "../lib/status";
import { PageHeader } from "../components/StaffLayout";
import { ReservationActions } from "./Reservations";

const Stat = ({ label, value, id, icon: Icon, highlight }) => (
  <div className={`rounded-2xl border p-5 ${highlight ? "border-[#120092] bg-[#120092] text-white brand-shadow" : "border-border bg-white card-shadow"}`} data-testid={id}>
    <div className="flex items-center justify-between">
      <span className={`text-sm font-medium ${highlight ? "text-white/70" : "text-slate-500"}`}>{label}</span>
      <Icon className={`h-4 w-4 ${highlight ? "text-white/70" : "text-[#120092]"}`} />
    </div>
    <div className="mt-3 font-display text-3xl font-bold">{value}</div>
  </div>
);

export default function Dashboard() {
  const today = toDateStr(new Date());
  const [stats, setStats] = useState(null);
  const [res, setRes] = useState([]);

  const load = useCallback(async () => {
    const [s, r] = await Promise.all([api.get("/dashboard"), api.get("/reservations", { params: { date: today } })]);
    setStats(s.data);
    setRes(r.data);
  }, [today]);

  useEffect(() => {
    load();
  }, [load]);

  const upcoming = res.filter((r) => ["pending", "confirmed", "seated"].includes(r.status));
  const occ = stats?.total_tables ? Math.round(((stats.tables.seated || 0) / stats.total_tables) * 100) : 0;

  return (
    <div>
      <PageHeader eyebrow={prettyDate(today)} title="Today's service" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Stat label="Bookings" value={stats?.bookings ?? "–"} id="stat-bookings" icon={CalendarCheck} highlight />
        <Stat label="Covers" value={stats?.covers ?? "–"} id="stat-covers" icon={Users} />
        <Stat label="Seated now" value={stats?.seated_covers ?? "–"} id="stat-seated" icon={Armchair} />
        <Stat label="To confirm" value={stats?.pending_total ?? "–"} id="stat-pending" icon={Hourglass} />
        <Stat label="Revenue logged" value={eur(stats?.revenue)} id="stat-revenue" icon={Euro} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        <div className={`${card} lg:col-span-8`}>
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="font-display text-lg font-semibold">Upcoming today</h2>
            <Link to="/staff/reservations" data-testid="dashboard-all-res-link" className="flex items-center gap-1 text-sm font-medium text-[#120092] hover:underline">All reservations <ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>
          {upcoming.length === 0 && <p className="px-5 py-14 text-center text-sm text-slate-400" data-testid="dashboard-empty">Nothing on the books yet for today.</p>}
          <ul className="divide-y divide-border">
            {upcoming.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-4 px-5 py-4" data-testid={`dashboard-res-${r.id}`}>
                <span className="rounded-lg bg-[#120092]/[0.06] px-2 py-1 font-mono text-sm font-medium text-[#120092]">{r.time}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 truncate">
                    {r.vip && <Crown className="h-3.5 w-3.5 text-[#120092]" />}
                    <span className="truncate font-semibold">{r.guest_name}</span>
                    <span className="text-sm text-slate-400">· {r.party_size}p {r.table_name ? `· ${r.table_name}` : ""}</span>
                  </div>
                  {r.allergies && <div className="mt-1 flex items-center gap-1 text-xs font-medium text-rose-600"><AlertTriangle className="h-3 w-3" />{r.allergies}</div>}
                </div>
                <ResBadge status={r.status} />
                <ReservationActions r={r} onChange={load} />
              </li>
            ))}
          </ul>
        </div>
        <div className={`${card} p-5 lg:col-span-4`}>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Floor status</h2>
            <Link to="/staff/floor" data-testid="dashboard-floor-link" className="text-sm font-medium text-[#120092] hover:underline">Open floor</Link>
          </div>
          <div className="mt-6 flex items-end gap-2">
            <span className="font-display text-5xl font-bold text-[#120092]">{occ}%</span>
            <span className="mb-1.5 text-sm text-slate-500">occupied</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-[#120092] transition-all" style={{ width: `${occ}%` }} />
          </div>
          <div className="mt-6 space-y-3">
            {Object.entries(TABLE_STATUS).map(([k, s]) => (
              <div key={k} className="flex items-center gap-3" data-testid={`floor-count-${k}`}>
                <span className={`h-2.5 w-2.5 rounded-full ${s.dot}`} />
                <span className="flex-1 text-sm text-slate-600">{s.label}</span>
                <span className="font-display text-lg font-semibold">{stats?.tables?.[k] ?? 0}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
