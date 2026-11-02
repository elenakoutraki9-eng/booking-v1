import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { api, formatApiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { PageHeader } from "../components/StaffLayout";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";

const L = ({ children }) => <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-[#786E65]">{children}</div>;
const Card = ({ title, children }) => (
  <section className="rounded-xl border border-[#332B25] bg-[#1C1714] p-6">
    <h2 className="mb-5 font-outfit text-lg">{title}</h2>{children}
  </section>
);

function RestaurantInfo({ isAdmin }) {
  const [s, setS] = useState(null);
  useEffect(() => {
    api.get("/settings").then((r) => setS(r.data));
  }, []);
  if (!s) return null;
  const f = (k, type = "text") => ({ type, value: s[k] ?? "", disabled: !isAdmin, onChange: (e) => setS({ ...s, [k]: type === "number" ? Number(e.target.value) : e.target.value }), "data-testid": `settings-${k}` });
  const save = async (e) => {
    e.preventDefault();
    try {
      await api.put("/settings", s);
      toast.success("Settings saved");
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };
  return (
    <Card title="Restaurant & booking page">
      <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <div><L>Name</L><Input {...f("name")} required /></div>
        <div><L>Tagline</L><Input {...f("tagline")} /></div>
        <div className="sm:col-span-2"><L>Description</L><Textarea rows={2} {...f("description")} /></div>
        <div><L>Address</L><Input {...f("address")} /></div>
        <div><L>Opening hours</L><Input {...f("hours")} /></div>
        <div><L>Phone</L><Input {...f("phone")} /></div>
        <div><L>Email</L><Input {...f("email")} /></div>
        <div><L>First booking time</L><Input {...f("slot_start", "time")} className="[color-scheme:dark]" /></div>
        <div><L>Last booking time</L><Input {...f("slot_end", "time")} className="[color-scheme:dark]" /></div>
        <div><L>Slot interval (min)</L><Input {...f("slot_interval", "number")} min={15} max={120} /></div>
        <div><L>Max party size online</L><Input {...f("max_party_online", "number")} min={1} max={50} /></div>
        {isAdmin ? (
          <button type="submit" data-testid="settings-save-btn" className="rounded-full bg-[#D4A359] py-2.5 text-sm font-semibold text-[#120E0D] hover:bg-[#E5B86C] sm:col-span-2">Save settings</button>
        ) : <p className="text-xs text-[#786E65] sm:col-span-2">Only the owner can change these.</p>}
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
  const add = async (e) => {
    e.preventDefault();
    try {
      await api.post("/staff", f);
      toast.success("Staff account created");
      setF({ name: "", email: "", password: "", role: "staff" });
      load();
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };
  const remove = async (u) => {
    if (!window.confirm(`Remove ${u.email}?`)) return;
    await api.delete(`/staff/${u.id}`);
    load();
  };
  return (
    <Card title="Staff accounts">
      <ul className="mb-6 divide-y divide-[#332B25]" data-testid="staff-list">
        {list.map((u) => (
          <li key={u.id} className="flex items-center gap-3 py-3 text-sm" data-testid={`staff-row-${u.email}`}>
            <div className="flex-1"><div>{u.name}</div><div className="text-xs text-[#786E65]">{u.email}</div></div>
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#D4A359]">{u.role === "admin" ? "Owner" : "Staff"}</span>
            {u.id !== user.id && <button onClick={() => remove(u)} data-testid={`staff-delete-${u.email}`} className="text-[#786E65] hover:text-rose-400"><Trash2 className="h-4 w-4" /></button>}
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
        <button type="submit" data-testid="staff-add-btn" className="rounded-full border border-[#D4A359]/60 py-2.5 text-sm text-[#D4A359] hover:bg-[#D4A359]/10 sm:col-span-2">Add staff member</button>
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
        <button type="submit" data-testid="pw-save-btn" className="w-full rounded-full border border-[#332B25] py-2.5 text-sm hover:border-[#D4A359]/60">Update password</button>
      </form>
    </Card>
  );
}

export default function Settings() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  return (
    <div>
      <PageHeader eyebrow="Configure" title="Settings" />
      <div className="grid gap-6 xl:grid-cols-12">
        <div className="xl:col-span-7"><RestaurantInfo isAdmin={isAdmin} /></div>
        <div className="space-y-6 xl:col-span-5">
          {isAdmin && <StaffAccounts />}
          <ChangePassword />
        </div>
      </div>
    </div>
  );
}
