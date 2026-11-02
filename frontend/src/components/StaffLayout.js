import { NavLink, Outlet, Link } from "react-router-dom";
import { LayoutDashboard, CalendarDays, Grid3x3, Users, Settings, LogOut, ExternalLink } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useSite } from "../context/SiteContext";

const NAV = [
  { to: "/staff", label: "Today", icon: LayoutDashboard, end: true, id: "nav-dashboard" },
  { to: "/staff/reservations", label: "Reservations", icon: CalendarDays, id: "nav-reservations" },
  { to: "/staff/floor", label: "Floor plan", icon: Grid3x3, id: "nav-floor" },
  { to: "/staff/guests", label: "Guests", icon: Users, id: "nav-guests" },
  { to: "/staff/settings", label: "Settings", icon: Settings, id: "nav-settings" },
];

export default function StaffLayout() {
  const { user, logout } = useAuth();
  const name = useSite().info?.name || "";

  const linkCls = ({ isActive }) =>
    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-200 ${isActive ? "bg-[#120092] text-white brand-shadow" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`;

  return (
    <div className="min-h-screen bg-[#F8F8FC] lg:flex">
      <aside className="sticky top-0 z-40 border-b border-border bg-white/90 backdrop-blur-xl lg:h-screen lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between px-5 py-4 lg:px-6 lg:py-7">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#120092] font-display text-lg font-bold text-white">{name?.[0]}</span>
            <div>
              <div className="font-display text-lg font-semibold leading-none" data-testid="staff-brand-name">{name}</div>
              <div className="mt-1 hidden text-[11px] font-medium text-slate-400 lg:block">Back office</div>
            </div>
          </div>
          <button onClick={logout} data-testid="logout-btn-mobile" className="text-slate-400 hover:text-[#120092] lg:hidden"><LogOut className="h-5 w-5" /></button>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:px-4">
          {NAV.map(({ to, label, icon: Icon, end, id }) => (
            <NavLink key={to} to={to} end={end} className={linkCls} data-testid={id}>
              <Icon className="h-4 w-4 shrink-0" /><span className="whitespace-nowrap">{label}</span>
            </NavLink>
          ))}
          <Link to="/" target="_blank" data-testid="nav-public-site" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 hover:text-[#120092]">
            <ExternalLink className="h-4 w-4 shrink-0" /><span className="whitespace-nowrap">Booking page</span>
          </Link>
        </nav>
        <div className="absolute bottom-0 hidden w-full border-t border-border p-4 lg:block">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#120092]/10 text-sm font-semibold text-[#120092]">{(user?.name || "U")[0]}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold" data-testid="current-user-name">{user?.name}</div>
              <div className="truncate text-xs text-slate-400">{user?.email}</div>
            </div>
            <button onClick={logout} data-testid="logout-btn" title="Sign out" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-[#120092]"><LogOut className="h-4 w-4" /></button>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
        <Outlet />
      </main>
    </div>
  );
}

export function PageHeader({ eyebrow, title, children }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#120092]">{eyebrow}</div>
        <h1 className="mt-1.5 font-display text-4xl font-bold sm:text-5xl">{title}</h1>
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}
