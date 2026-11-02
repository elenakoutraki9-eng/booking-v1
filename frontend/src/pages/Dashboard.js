import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Crown, AlertTriangle, ArrowRight } from "lucide-react";
import { api, eur, toDateStr, prettyDate } from "../lib/api";
import { TABLE_STATUS, ResBadge } from "../lib/status";
import { PageHeader } from "../components/StaffLayout";
import { ReservationActions } from "./Reservations";

const Stat = ({ label, value, id, accent }) => (
  <div className="rounded-xl border border-[#332B25] bg-[#1C1714] p-5" data-testid={id}>
    <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#786E65]">{label}</div>
    <div className={`mt-3 font-outfit text-3xl font-medium ${accent || ""}`}>{value}</div>
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

  return (
    <div>
      <PageHeader eyebrow={prettyDate(today)} title="Tonight's service" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Stat label="Bookings" value={stats?.bookings ?? "–"} id="stat-bookings" />
        <Stat label="Covers" value={stats?.covers ?? "–"} id="stat-covers" />
        <Stat label="Seated now" value={stats?.seated_covers ?? "–"} id="stat-seated" accent="text-amber-300" />
        <Stat label="Awaiting confirmation" value={stats?.pending_total ?? "–"} id="stat-pending" accent="text-yellow-300" />
        <Stat label="Revenue logged" value={eur(stats?.revenue)} id="stat-revenue" accent="text-[#D4A359]" />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-12">
        <div className="rounded-xl border border-[#332B25] bg-[#1C1714] lg:col-span-8">
          <div className="flex items-center justify-between border-b border-[#332B25] px-5 py-4">
            <h2 className="font-outfit text-lg">Upcoming today</h2>
            <Link to="/staff/reservations" data-testid="dashboard-all-res-link" className="flex items-center gap-1 text-xs text-[#B0A59A] hover:text-[#D4A359]">All reservations <ArrowRight className="h-3 w-3" /></Link>
          </div>
          {upcoming.length === 0 && <p className="px-5 py-12 text-center text-sm text-[#786E65]" data-testid="dashboard-empty">Nothing on the books yet for today.</p>}
          <ul className="divide-y divide-[#332B25]">
            {upcoming.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-4 px-5 py-4" data-testid={`dashboard-res-${r.id}`}>
                <span className="w-14 font-mono text-sm text-[#D4A359]">{r.time}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 truncate">
                    {r.vip && <Crown className="h-3.5 w-3.5 text-purple-300" />}
                    <span className="truncate">{r.guest_name}</span>
                    <span className="text-xs text-[#786E65]">· {r.party_size}p {r.table_name ? `· ${r.table_name}` : ""}</span>
                  </div>
                  {r.allergies && <div className="mt-1 flex items-center gap-1 text-xs text-rose-300"><AlertTriangle className="h-3 w-3" />{r.allergies}</div>}
                </div>
                <ResBadge status={r.status} />
                <ReservationActions r={r} onChange={load} />
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-[#332B25] bg-[#1C1714] p-5 lg:col-span-4">
          <div className="flex items-center justify-between">
            <h2 className="font-outfit text-lg">Floor status</h2>
            <Link to="/staff/floor" data-testid="dashboard-floor-link" className="text-xs text-[#B0A59A] hover:text-[#D4A359]">Open floor</Link>
          </div>
          <div className="mt-6 space-y-4">
            {Object.entries(TABLE_STATUS).map(([k, s]) => (
              <div key={k} className="flex items-center gap-3" data-testid={`floor-count-${k}`}>
                <span className={`h-2.5 w-2.5 rounded-full ${s.dot}`} />
                <span className="flex-1 text-sm text-[#B0A59A]">{s.label}</span>
                <span className="font-mono text-lg">{stats?.tables?.[k] ?? 0}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 h-2 overflow-hidden rounded-full bg-[#120E0D]">
            <div className="h-full bg-[#D4A359] transition-all" style={{ width: `${stats?.total_tables ? ((stats.tables.seated || 0) / stats.total_tables) * 100 : 0}%` }} />
          </div>
          <p className="mt-2 text-xs text-[#786E65]">{stats?.tables?.seated || 0} of {stats?.total_tables || 0} tables occupied</p>
        </div>
      </div>
    </div>
  );
}
