import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { api, formatApiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useSite } from "../context/SiteContext";
import { btnPrimary, btnGhost, card } from "../lib/status";
import { PageHeader } from "../components/StaffLayout";
import { TodayLayoutEditor, ZonesEditor, BookingPageEditor } from "../components/SettingsEditors";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";

const L = ({ children }) => <div className="mb-1.5 text-xs font-semibold text-slate-500">{children}</div>;
const Card = ({ title, children }) => (
  <section className={`${card} p-6`}>
    <h2 className="mb-5 font-display text-xl font-bold">{title}</h2>{children}
  </section>
);

const GENERAL_KEYS = ["name", "address", "hours", "phone", "email", "slot_start", "slot_end", "slot_interval", "max_party_online"];

function RestaurantInfo({ s0, isAdmin, onSaved }) {
  const { refresh } = useSite();
  const [s, setS] = useState(() => Object.fromEntries(GENERAL_KEYS.map((k) => [k, s0[k]])));
  const f = (k, type = "text") => ({ type, value: s[k] ?? "", disabled: !isAdmin, onChange: (e) => setS({ ...s, [k]: type === "number" ? Number(e.target.value) : e.target.value }), "data-testid": `settings-${k}` });
  const save = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.put("/settings", s);
      onSaved(data);
      refresh();
      toast.success("Settings saved");
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };
  return (
    <Card title="Restaurant details & booking rules">
      <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><L>Name</L><Input {...f("name")} required /></div>
        <div><L>Address</L><Input {...f("address")} /></div>
        <div><L>Opening hours</L><Input {...f("hours")} /></div>
        <div><L>Phone</L><Input {...f("phone")} /></div>
        <div><L>Email</L><Input {...f("email")} /></div>
        <div><L>First booking time</L><Input {...f("slot_start", "time")} required /></div>
        <div><L>Last booking time</L><Input {...f("slot_end", "time")} required /></div>
        <div><L>Slot interval (min)</L><Input {...f("slot_interval", "number")} min={15} max={120} /></div>
        <div><L>Max party size online</L><Input {...f("max_party_online", "number")} min={1} max={50} /></div>
        {isAdmin ? (
          <button type="submit" data-testid="settings-save-btn" className={`${btnPrimary} sm:col-span-2`}>Save settings</button>
        ) : <p className="text-xs text-slate-400 sm:col-span-2">Only the owner can change these.</p>}
      </form>
    </Card>
  );
}

function StaffAccounts() {
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [f, setF] = useState({ name: "", email: "", password: "", role: "staff" });
  const load = useCallback(async () => {
    const { data } = await api.get("/staff");
    setList(data);
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const call = async (fn, msg) => {
    try {
      await fn();
      toast.success(msg);
      load();
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };
  const add = (e) => {
    e.preventDefault();
    call(async () => { await api.post("/staff", f); setF({ name: "", email: "", password: "", role: "staff" }); }, "Staff account created");
  };
  const remove = (u) => window.confirm(`Remove ${u.email}?`) && call(() => api.delete(`/staff/${u.id}`), "Staff account removed");
  return (
    <Card title="Staff accounts">
      <ul className="mb-6 divide-y divide-border" data-testid="staff-list">
        {list.map((u) => (
          <li key={u.id} className="flex items-center gap-3 py-3 text-sm" data-testid={`staff-row-${u.email}`}>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#120092]/10 text-xs font-bold text-[#120092]">{u.name[0]}</span>
            <div className="flex-1"><div className="font-semibold">{u.name}</div><div className="text-xs text-slate-400">{u.email}</div></div>
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${u.role === "admin" ? "bg-[#120092] text-white" : "bg-slate-100 text-slate-600"}`}>{u.role === "admin" ? "Owner" : "Staff"}</span>
            {u.id !== user.id && <button onClick={() => remove(u)} data-testid={`staff-delete-${u.email}`} className="text-slate-400 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>}
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="grid gap-3 sm:grid-cols-2">
        <Input placeholder="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required data-testid="staff-name-input" />
        <Input type="email" placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required data-testid="staff-email-input" />
        <Input type="password" placeholder="Password (min 8)" minLength={8} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required data-testid="staff-password-input" />
        <Select value={f.role} onValueChange={(v) => setF({ ...f, role: v })}>
          <SelectTrigger data-testid="staff-role-select"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="staff">Staff</SelectItem><SelectItem value="admin">Owner</SelectItem></SelectContent>
        </Select>
        <button type="submit" data-testid="staff-add-btn" className={`${btnGhost} sm:col-span-2`}>Add staff member</button>
      </form>
    </Card>
  );
}

function ChangePassword() {
  const [f, setF] = useState({ current_password: "", new_password: "" });
  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/auth/change-password", f);
      toast.success("Password changed");
      setF({ current_password: "", new_password: "" });
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };
  return (
    <Card title="My password">
      <form onSubmit={submit} className="space-y-3">
        <Input type="password" placeholder="Current password" value={f.current_password} onChange={(e) => setF({ ...f, current_password: e.target.value })} required data-testid="pw-current-input" />
        <Input type="password" placeholder="New password (min 8)" minLength={8} value={f.new_password} onChange={(e) => setF({ ...f, new_password: e.target.value })} required data-testid="pw-new-input" />
        <button type="submit" data-testid="pw-save-btn" className={`${btnGhost} w-full`}>Update password</button>
      </form>
    </Card>
  );
}

const TABS = [
  { id: "general", label: "General" },
  { id: "booking", label: "Booking page", admin: true },
  { id: "today", label: "Today layout", admin: true },
  { id: "areas", label: "Seating areas", admin: true },
  { id: "team", label: "Team & password" },
];

export default function Settings() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [params, setParams] = useSearchParams();
  const [s, setS] = useState(null);
  const tabs = TABS.filter((t) => isAdmin || !t.admin);
  const tab = tabs.find((t) => t.id === params.get("tab"))?.id || "general";

  useEffect(() => {
    let alive = true;
    api.get("/settings").then((r) => { if (alive) setS(r.data); });
    return () => { alive = false; };
  }, []);

  return (
    <div>
      <PageHeader eyebrow="Configure" title="Settings" />
      <div className="mb-6 flex gap-1 overflow-x-auto rounded-full border border-border bg-white p-1 sm:inline-flex" data-testid="settings-tabs">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setParams({ tab: t.id })} data-testid={`settings-tab-${t.id}`}
            className={`relative whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-300 ${tab === t.id ? "text-white" : "text-slate-500 hover:text-slate-900"}`}>
            {tab === t.id && <motion.span layoutId="settings-tab-pill" transition={{ type: "spring", stiffness: 400, damping: 32 }} className="absolute inset-0 rounded-full bg-[#120092]" />}
            <span className="relative">{t.label}</span>
          </button>
        ))}
      </div>
      {s && (
        <motion.div key={tab} className="max-w-4xl" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0, transition: { type: "spring", stiffness: 280, damping: 30 } }}>
          {tab === "general" && <RestaurantInfo s0={s} isAdmin={isAdmin} onSaved={setS} />}
          {tab === "booking" && <BookingPageEditor s={s} onSaved={setS} />}
          {tab === "today" && <TodayLayoutEditor s={s} onSaved={setS} />}
          {tab === "areas" && <ZonesEditor s={s} onSaved={setS} />}
          {tab === "team" && (
            <div className="grid gap-6 lg:grid-cols-2">
              {isAdmin && <StaffAccounts />}
              <ChangePassword />
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
