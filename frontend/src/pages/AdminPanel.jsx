import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UserPlus, Trash2, Pencil, Activity } from "lucide-react";
import { api, errMsg, ROLE_LABELS, fmtDateTime } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Avatar } from "../components/common";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";

const inputCls = "h-9 w-full rounded-lg border border-[#DFE1E6] px-3 text-sm text-[#172B4D] bg-white outline-none focus:ring-2 focus:ring-[#0C66E4]";
const btnPrimary = "h-9 px-4 rounded-lg bg-[#0c66e4] hover:bg-[#0052cc] text-white text-sm font-semibold transition-colors active:scale-95";
const DIV_COLORS = ["#0C66E4", "#E56910", "#22A06B", "#9F8FEF", "#E774BB", "#CA3521", "#F5CD47"];
const BG_COLORS = ["#0079bf", "#519839", "#D29034", "#B04632", "#89609E", "#CD5A91", "#4BBF6B", "#00AECC"];

function UsersTab({ divisions }) {
  const qc = useQueryClient();
  const { data: users } = useQuery({ queryKey: ["users"], queryFn: () => api.get("/users").then((r) => r.data) });
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "staff", division_id: "" });
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({});

  const divName = (id) => (divisions || []).find((d) => d.id === id)?.name || "—";

  const createUser = async (e) => {
    e.preventDefault();
    try {
      await api.post("/users", { ...form, division_id: form.division_id || null });
      toast.success("Pengguna dibuat");
      setForm({ name: "", email: "", password: "", role: "staff", division_id: "" });
      qc.invalidateQueries({ queryKey: ["users"] });
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const saveEdit = async () => {
    try {
      const payload = {};
      if (editForm.role) payload.role = editForm.role;
      if (editForm.division_id !== undefined) payload.division_id = editForm.division_id || null;
      if (editForm.is_active !== undefined) payload.is_active = editForm.is_active;
      if (editForm.password) payload.password = editForm.password;
      await api.patch(`/users/${editing.id}`, payload);
      toast.success("Pengguna diperbarui");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["users"] });
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  return (
    <div className="space-y-6" data-testid="admin-users-tab">
      <form onSubmit={createUser} className="bg-white rounded-xl border border-[#DFE1E6] p-5 shadow-sm">
        <h3 className="font-heading font-bold text-[#172B4D] mb-3 flex items-center gap-2"><UserPlus size={16} /> Tambah Pengguna</h3>
        <div className="grid md:grid-cols-5 gap-2">
          <input data-testid="user-name-input" required placeholder="Nama" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
          <input data-testid="user-email-input" required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} />
          <input data-testid="user-password-input" required type="text" placeholder="Kata sandi" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={inputCls} />
          <select data-testid="user-role-select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={inputCls}>
            {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select data-testid="user-division-select" value={form.division_id} onChange={(e) => setForm({ ...form, division_id: e.target.value })} className={inputCls}>
            <option value="">Tanpa Divisi</option>
            {(divisions || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <button data-testid="user-create-button" type="submit" className={`${btnPrimary} mt-3`}>Buat Pengguna</button>
      </form>

      <div className="bg-white rounded-xl border border-[#DFE1E6] shadow-sm overflow-x-auto">
        <table className="w-full text-sm" data-testid="users-table">
          <thead>
            <tr className="border-b border-[#DFE1E6] text-left">
              <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-[#8590A2]">Nama</th>
              <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-[#8590A2]">Email</th>
              <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-[#8590A2]">Peran</th>
              <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-[#8590A2]">Divisi</th>
              <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-[#8590A2]">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {(users || []).map((u) => (
              <tr key={u.id} className="border-b border-[#F1F2F4]" data-testid={`user-row-${u.id}`}>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <Avatar name={u.name} color={u.avatar_color} size="h-7 w-7 text-[10px]" />
                    <span className="font-medium text-[#172B4D]">{u.name}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-[#44546F]">{u.email}</td>
                <td className="px-4 py-2.5"><span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#E9F2FF] text-[#0C66E4]">{ROLE_LABELS[u.role]}</span></td>
                <td className="px-4 py-2.5 text-[#44546F]">{divName(u.division_id)}</td>
                <td className="px-4 py-2.5">
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${u.is_active ? "bg-[#E3FCEF] text-[#216E4E]" : "bg-[#FFECE8] text-[#CA3521]"}`}>
                    {u.is_active ? "Aktif" : "Nonaktif"}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    data-testid={`user-edit-${u.id}`}
                    onClick={() => { setEditing(u); setEditForm({ role: u.role, division_id: u.division_id || "", is_active: u.is_active, password: "" }); }}
                    className="p-1.5 rounded hover:bg-[#F1F2F4] text-[#44546F]"
                    aria-label="Edit pengguna"
                  >
                    <Pencil size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent className="bg-white" data-testid="user-edit-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading">Edit Pengguna — {editing?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-[#44546F]">Peran</label>
              <select data-testid="edit-user-role-select" value={editForm.role || "staff"} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })} className={inputCls}>
                {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-[#44546F]">Divisi</label>
              <select data-testid="edit-user-division-select" value={editForm.division_id || ""} onChange={(e) => setEditForm({ ...editForm, division_id: e.target.value })} className={inputCls}>
                <option value="">Tanpa Divisi</option>
                {(divisions || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-[#44546F]">Reset Kata Sandi (kosongkan jika tidak diubah)</label>
              <input data-testid="edit-user-password-input" type="text" value={editForm.password || ""} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} className={inputCls} placeholder="Kata sandi baru" />
            </div>
            <label className="flex items-center gap-2 text-sm text-[#172B4D]">
              <input
                data-testid="edit-user-active-toggle"
                type="checkbox"
                checked={!!editForm.is_active}
                onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                className="w-4 h-4 accent-[#0C66E4]"
              />
              Akun aktif
            </label>
            <button data-testid="edit-user-save-button" onClick={saveEdit} className={`${btnPrimary} w-full`}>Simpan Perubahan</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DivisionsTab({ divisions }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [color, setColor] = useState(DIV_COLORS[0]);

  const create = async (e) => {
    e.preventDefault();
    try {
      await api.post("/divisions", { name, color });
      toast.success("Divisi dibuat");
      setName("");
      qc.invalidateQueries({ queryKey: ["divisions"] });
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Hapus divisi ini?")) return;
    try {
      await api.delete(`/divisions/${id}`);
      qc.invalidateQueries({ queryKey: ["divisions"] });
      toast.success("Divisi dihapus");
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  return (
    <div className="space-y-6" data-testid="admin-divisions-tab">
      <form onSubmit={create} className="bg-white rounded-xl border border-[#DFE1E6] p-5 shadow-sm">
        <h3 className="font-heading font-bold text-[#172B4D] mb-3">Tambah Divisi</h3>
        <div className="flex flex-wrap items-center gap-2">
          <input data-testid="division-name-input" required placeholder="Nama divisi" value={name} onChange={(e) => setName(e.target.value)} className={`${inputCls} max-w-xs`} />
          <div className="flex gap-1">
            {DIV_COLORS.map((c) => (
              <button key={c} type="button" aria-label={`Warna ${c}`} data-testid={`division-color-${c.replace("#", "")}`} onClick={() => setColor(c)} className={`w-7 h-7 rounded ${color === c ? "ring-2 ring-offset-1 ring-[#172B4D]" : ""}`} style={{ backgroundColor: c }} />
            ))}
          </div>
          <button data-testid="division-create-button" type="submit" className={btnPrimary}>Buat Divisi</button>
        </div>
      </form>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
        {(divisions || []).map((d) => (
          <div key={d.id} className="bg-white rounded-xl border border-[#DFE1E6] p-4 shadow-sm flex items-center justify-between" data-testid={`division-card-${d.id}`}>
            <div className="flex items-center gap-3">
              <span className="w-4 h-4 rounded-full" style={{ backgroundColor: d.color }} />
              <span className="font-semibold text-[#172B4D]">{d.name}</span>
            </div>
            <button aria-label="Hapus divisi" data-testid={`division-delete-${d.id}`} onClick={() => remove(d.id)} className="p-1.5 rounded hover:bg-[#FFECE8] text-[#CA3521]">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function BoardsTab({ divisions }) {
  const qc = useQueryClient();
  const { data: boards } = useQuery({ queryKey: ["boards"], queryFn: () => api.get("/boards").then((r) => r.data) });
  const [name, setName] = useState("");
  const [divisionId, setDivisionId] = useState("");
  const [bg, setBg] = useState(BG_COLORS[0]);

  const create = async (e) => {
    e.preventDefault();
    try {
      await api.post("/boards", { name, division_id: divisionId || null, background: bg });
      toast.success("Board dibuat");
      setName("");
      qc.invalidateQueries({ queryKey: ["boards"] });
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const archive = async (id) => {
    if (!window.confirm("Arsipkan board ini?")) return;
    await api.delete(`/boards/${id}`);
    qc.invalidateQueries({ queryKey: ["boards"] });
    toast.success("Board diarsipkan");
  };

  return (
    <div className="space-y-6" data-testid="admin-boards-tab">
      <form onSubmit={create} className="bg-white rounded-xl border border-[#DFE1E6] p-5 shadow-sm">
        <h3 className="font-heading font-bold text-[#172B4D] mb-3">Buat Board Baru</h3>
        <div className="flex flex-wrap items-center gap-2">
          <input data-testid="board-name-input" required placeholder="Nama board" value={name} onChange={(e) => setName(e.target.value)} className={`${inputCls} max-w-xs`} />
          <select data-testid="board-division-select" value={divisionId} onChange={(e) => setDivisionId(e.target.value)} className={`${inputCls} w-48`}>
            <option value="">Tanpa Divisi</option>
            {(divisions || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <div className="flex gap-1">
            {BG_COLORS.map((c) => (
              <button key={c} type="button" aria-label={`Latar ${c}`} data-testid={`board-bg-${c.replace("#", "")}`} onClick={() => setBg(c)} className={`w-7 h-7 rounded ${bg === c ? "ring-2 ring-offset-1 ring-[#172B4D]" : ""}`} style={{ backgroundColor: c }} />
            ))}
          </div>
          <button data-testid="board-create-button" type="submit" className={btnPrimary}>Buat Board</button>
        </div>
      </form>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
        {(boards || []).map((b) => (
          <div key={b.id} className="rounded-xl p-4 text-white shadow-sm" style={{ backgroundColor: b.background }} data-testid={`admin-board-card-${b.id}`}>
            <p className="font-heading font-bold">{b.name}</p>
            <p className="text-xs opacity-80 mt-1">{b.division_name || "Tanpa divisi"} · {b.card_count} kartu</p>
            <div className="flex justify-end mt-2">
              <button data-testid={`board-archive-${b.id}`} onClick={() => archive(b.id)} className="text-xs bg-white/20 hover:bg-white/30 rounded px-2 py-1 font-semibold transition-colors">
                Arsipkan
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActivityTab() {
  const { data: activities } = useQuery({ queryKey: ["activities"], queryFn: () => api.get("/activities?limit=80").then((r) => r.data) });
  return (
    <div className="bg-white rounded-xl border border-[#DFE1E6] shadow-sm p-5" data-testid="admin-activity-tab">
      <h3 className="font-heading font-bold text-[#172B4D] mb-4 flex items-center gap-2"><Activity size={16} /> Log Aktivitas Global</h3>
      <div className="space-y-3">
        {(activities || []).map((a) => (
          <div key={a.id} className="flex items-start gap-3 border-b border-[#F1F2F4] pb-2.5 last:border-b-0" data-testid={`activity-row-${a.id}`}>
            <div className="w-7 h-7 rounded-full bg-[#091E420F] flex items-center justify-center shrink-0">
              <Activity size={13} className="text-[#44546F]" />
            </div>
            <div>
              <p className="text-sm text-[#44546F]"><span className="font-semibold text-[#172B4D]">{a.user_name}</span> {a.action}</p>
              <p className="text-[11px] text-[#8590A2]">{fmtDateTime(a.created_at)}</p>
            </div>
          </div>
        ))}
        {(activities || []).length === 0 && <p className="text-sm text-[#8590A2]">Belum ada aktivitas.</p>}
      </div>
    </div>
  );
}

export default function AdminPanel() {
  const { user } = useAuth();
  const { data: divisions } = useQuery({ queryKey: ["divisions"], queryFn: () => api.get("/divisions").then((r) => r.data) });
  const isAdmin = ["super_admin", "admin"].includes(user?.role);
  const isSupervisorUp = ["super_admin", "admin", "supervisor"].includes(user?.role);

  if (!isSupervisorUp) {
    return (
      <div className="p-10 text-center" data-testid="admin-forbidden">
        <p className="text-[#44546F]">Halaman ini hanya untuk supervisor dan admin.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto" data-testid="admin-panel-page">
      <div className="mb-6">
        <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-[#172B4D]">Admin Panel</h1>
        <p className="text-sm text-[#44546F] mt-1">Kelola pengguna, divisi, board, dan pantau aktivitas.</p>
      </div>
      <Tabs defaultValue={isAdmin ? "users" : "activity"}>
        <TabsList className="bg-white border border-[#DFE1E6]" data-testid="admin-tabs">
          {isAdmin && <TabsTrigger value="users" data-testid="tab-trigger-users">Pengguna</TabsTrigger>}
          {isAdmin && <TabsTrigger value="divisions" data-testid="tab-trigger-divisions">Divisi</TabsTrigger>}
          {isAdmin && <TabsTrigger value="boards" data-testid="tab-trigger-boards">Board</TabsTrigger>}
          <TabsTrigger value="activity" data-testid="tab-trigger-activity">Log Aktivitas</TabsTrigger>
        </TabsList>
        {isAdmin && (
          <>
            <TabsContent value="users" className="mt-4"><UsersTab divisions={divisions} /></TabsContent>
            <TabsContent value="divisions" className="mt-4"><DivisionsTab divisions={divisions} /></TabsContent>
            <TabsContent value="boards" className="mt-4"><BoardsTab divisions={divisions} /></TabsContent>
          </>
        )}
        <TabsContent value="activity" className="mt-4"><ActivityTab /></TabsContent>
      </Tabs>
    </div>
  );
}
