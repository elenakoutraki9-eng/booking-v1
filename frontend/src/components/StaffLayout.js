import { useEffect, useState } from "react";
import { NavLink, Outlet, Link } from "react-router-dom";
import { LayoutDashboard, CalendarDays, Grid3x3, Users, Settings, LogOut, ExternalLink } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";

const NAV = [
  { to: "/staff", label: "Today", icon: LayoutDashboard, end: true, id: "nav-dashboard" },
  { to: "/staff/reservations", label: "Reservations", icon: CalendarDays, id: "nav-reservations" },
  { to: "/staff/floor", label: "Floor plan", icon: Grid3x3, id: "nav-floor" },
  { to: "/staff/guests", label: "Guests", icon: Users, id: "nav-guests" },
  { to: "/staff/settings", label: "Settings", icon: Settings, id: "nav-settings" },
];

export default function StaffLayout() {
  const { user, logout } = useAuth();
  const [name, setName] = useState("");

  useEffect(() => {
    api.get("/public/info").then((r) => setName(r.data.name)).catch(() => {});
  }, []);

  const linkCls = ({ isActive }) =>
    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors duration-200 ${isActive ? "bg-[#26201C] text-[#D4A359]" : "text-[#B0A59A] hover:bg-[#1C1714] hover:text-[#F7F4EF]"}`;

  return (
    <div className="min-h-screen bg-[#120E0D] lg:flex">
      <aside className="sticky top-0 z-40 border-b border-[#332B25] bg-[#120E0D]/95 backdrop-blur-md lg:h-screen lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between px-5 py-4 lg:block lg:px-6 lg:py-8">
          <div>
            <div className="font-serif-d text-2xl leading-none" data-testid="staff-brand-name">{name}</div>
            <div className="mt-1 hidden font-mono text-[10px] uppercase tracking-[0.3em] text-[#786E65] lg:block">Back office</div>
          </div>
          <button onClick={logout} data-testid="logout-btn-mobile" className="text-[#786E65] hover:text-[#D4A359] lg:hidden"><LogOut className="h-5 w-5" /></button>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:px-4">
          {NAV.map(({ to, label, icon: Icon, end, id }) => (
            <NavLink key={to} to={to} end={end} className={linkCls} data-testid={id}>
              <Icon className="h-4 w-4 shrink-0" /><span className="whitespace-nowrap">{label}</span>
            </NavLink>
          ))}
          <Link to="/" target="_blank" data-testid="nav-public-site" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[#786E65] hover:text-[#F7F4EF]">
            <ExternalLink className="h-4 w-4 shrink-0" /><span className="whitespace-nowrap">Booking page</span>
          </Link>
        </nav>
        <div className="absolute bottom-0 hidden w-full border-t border-[#332B25] p-5 lg:block">
          <div className="truncate text-sm" data-testid="current-user-name">{user?.name}</div>
          <div className="truncate text-xs text-[#786E65]">{user?.email}</div>
          <button onClick={logout} data-testid="logout-btn" className="mt-3 flex items-center gap-2 text-xs text-[#786E65] hover:text-[#D4A359]">
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-8 sm:px-6 lg:px-12 lg:py-10">
        <Outlet />
      </main>
    </div>
  );
}

export function PageHeader({ eyebrow, title, children }) {
  return (
    <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#D4A359]">{eyebrow}</div>
        <h1 className="mt-2 font-serif-d text-4xl font-medium sm:text-5xl">{title}</h1>
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}
