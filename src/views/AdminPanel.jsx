import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UserPlus, Trash2, Pencil, Activity, ListChecks, Plus, ShieldCheck, RefreshCw } from "lucide-react";
import { api, errMsg, ROLE_LABELS, fmtDateTime } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Avatar } from "../components/common";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";

const inputCls = "h-9 w-full rounded-lg border border-[#DFE1E6] px-3 text-sm text-[#172B4D] bg-white outline-none focus:ring-2 focus:ring-[#0C66E4]";
const btnPrimary = "h-9 px-4 rounded-lg bg-[#0c66e4] hover:bg-[#0052cc] text-white text-sm font-semibold transition-colors active:scale-95";
const DIV_COLORS = ["#0C66E4", "#E56910", "#22A06B", "#9F8FEF", "#E774BB", "#CA3521", "#F5CD47"];
const BG_COLORS = ["#0079bf", "#519839", "#D29034", "#B04632", "#89609E", "#CD5A91", "#4BBF6B", "#00AECC"];
const LIST_COLORS = ["#F1F2F4", "#E9F2FF", "#E3FCEF", "#FFF7D6", "#FFEDEB", "#EAE6FF", "#FCE8F3", "#DFE1E6"];

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
  const { data: archivedBoards } = useQuery({ queryKey: ["boards-archived"], queryFn: () => api.get("/boards-archived").then((r) => r.data) });
  const [name, setName] = useState("");
  const [divisionId, setDivisionId] = useState("");
  const [bg, setBg] = useState(BG_COLORS[0]);
  const [template, setTemplate] = useState("");

  const create = async (e) => {
    e.preventDefault();
    try {
      await api.post("/boards", { name, division_id: divisionId || null, background: bg, template: template || null });
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
    qc.invalidateQueries({ queryKey: ["boards-archived"] });
    toast.success("Board diarsipkan");
  };

  const reopen = async (id) => {
    await api.post(`/boards/${id}/unarchive`);
    qc.invalidateQueries({ queryKey: ["boards"] });
    qc.invalidateQueries({ queryKey: ["boards-archived"] });
    toast.success("Board dibuka kembali");
  };

  const copyBoard = async (id, boardName) => {
    const newName = window.prompt("Nama board salinan:", `${boardName} (salinan)`);
    if (!newName) return;
    const withCards = window.confirm("Sertakan semua kartu? (OK = ya, Batal = hanya list & label)");
    try {
      await api.post(`/boards/${id}/copy`, { name: newName, with_cards: withCards });
      qc.invalidateQueries({ queryKey: ["boards"] });
      toast.success("Board disalin");
    } catch (err) {
      toast.error(errMsg(err));
    }
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
          <select data-testid="board-template-select" value={template} onChange={(e) => setTemplate(e.target.value)} className={`${inputCls} w-52`}>
            <option value="">Tanpa template</option>
            <option value="skor">Template SKOR 1-7 (CS)</option>
          </select>
          <button data-testid="board-create-button" type="submit" className={btnPrimary}>Buat Board</button>
        </div>
      </form>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
        {(boards || []).map((b) => (
          <div key={b.id} className="rounded-xl p-4 text-white shadow-sm" style={{ backgroundColor: b.background }} data-testid={`admin-board-card-${b.id}`}>
            <p className="font-heading font-bold">{b.name}</p>
            <p className="text-xs opacity-80 mt-1">{b.division_name || "Tanpa divisi"} · {b.card_count} kartu</p>
            <div className="flex justify-end gap-1.5 mt-2">
              <button data-testid={`board-copy-${b.id}`} onClick={() => copyBoard(b.id, b.name)} className="text-xs bg-white/20 hover:bg-white/30 rounded px-2 py-1 font-semibold transition-colors">
                Salin
              </button>
              <button data-testid={`board-archive-${b.id}`} onClick={() => archive(b.id)} className="text-xs bg-white/20 hover:bg-white/30 rounded px-2 py-1 font-semibold transition-colors">
                Arsipkan
              </button>
            </div>
          </div>
        ))}
      </div>
      {(archivedBoards || []).length > 0 && (
        <div className="bg-white rounded-xl border border-[#DFE1E6] shadow-sm p-5" data-testid="archived-boards-section">
          <h3 className="font-heading font-bold text-[#172B4D] mb-3">Board Diarsipkan</h3>
          <div className="space-y-2">
            {archivedBoards.map((b) => (
              <div key={b.id} className="flex items-center justify-between bg-[#F4F5F7] rounded-lg px-3 py-2" data-testid={`archived-board-${b.id}`}>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded" style={{ backgroundColor: b.background }} />
                  <span className="text-sm font-medium text-[#172B4D]">{b.name}</span>
                </div>
                <button data-testid={`board-reopen-${b.id}`} onClick={() => reopen(b.id)} className="text-xs text-[#0C66E4] hover:underline font-semibold">
                  Buka Kembali
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
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

// ── Alur & Syarat List ──────────────────────────────────────────────
function ListRow({ list, idx, nextName }) {
  const qc = useQueryClient();
  const [reqText, setReqText] = useState((list.entryRequirements || []).join("\n"));
  const [color, setColor] = useState(list.color || "#F1F2F4");
  const [dirty, setDirty] = useState(false);

  const save = async () => {
    const reqs = reqText.split("\n").map((s) => s.trim()).filter(Boolean);
    try {
      await api.patch(`/lists/${list.id}`, { color, entryRequirements: reqs });
      toast.success(`List "${list.name}" disimpan`);
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["board-full"] });
      qc.invalidateQueries({ queryKey: ["board"] });
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <div className="rounded-xl border border-[#DFE1E6] bg-white p-4" data-testid={`flow-list-${list.id}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#F1F2F4] text-xs font-bold text-[#5E6C84]">{idx + 1}</span>
        <span className="h-4 w-4 rounded shrink-0 border border-[#DFE1E6]" style={{ backgroundColor: color }} />
        <span className="font-semibold text-[#172B4D]">{list.name}</span>
      </div>

      <div className="mb-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-[#8590A2] mb-1.5">Warna list</p>
        <div className="flex flex-wrap gap-1.5">
          {LIST_COLORS.map((c) => (
            <button key={c} type="button" onClick={() => { setColor(c); setDirty(true); }}
              className={`h-7 w-7 rounded ${color === c ? "ring-2 ring-[#0C66E4] ring-offset-1" : "border border-[#DFE1E6]"}`}
              style={{ backgroundColor: c }} />
          ))}
        </div>
      </div>

      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-[#8590A2] mb-1">
          Syarat pindah kartu KE list ini
        </p>
        <p className="text-[11px] text-[#8590A2] mb-1.5">
          Satu syarat per baris. Kartu tidak bisa dipindah ke <b>{list.name}</b>{nextName ? "" : ""} sebelum item checklist dengan teks berikut tercentang (supervisor bisa paksa).
        </p>
        <textarea
          value={reqText}
          onChange={(e) => { setReqText(e.target.value); setDirty(true); }}
          rows={3}
          placeholder={"mis:\nSK Kemenkumham\nPembayaran DP/Lunas"}
          className="w-full rounded-lg border border-[#DFE1E6] px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[#0C66E4] resize-y font-mono"
        />
      </div>

      {dirty && (
        <button type="button" onClick={save} className={`${btnPrimary} mt-3`}>Simpan</button>
      )}
    </div>
  );
}

function FlowTab() {
  const { data: boards } = useQuery({ queryKey: ["boards"], queryFn: () => api.get("/boards").then((r) => r.data) });
  const [boardId, setBoardId] = useState("");
  const activeBoardId = boardId || (boards || [])[0]?.id;
  const { data: full } = useQuery({
    queryKey: ["board-full", activeBoardId],
    queryFn: () => api.get(`/boards/${activeBoardId}/full`).then((r) => r.data),
    enabled: !!activeBoardId,
  });
  const lists = (full?.lists || []).slice().sort((a, b) => a.position - b.position);

  return (
    <div className="space-y-4" data-testid="admin-flow-tab">
      <div className="bg-white rounded-xl border border-[#DFE1E6] shadow-sm p-5">
        <h3 className="font-heading font-bold text-[#172B4D] mb-1">Alur & Syarat Pindah List</h3>
        <p className="text-sm text-[#44546F] mb-3">
          Pilih board. List dibaca <b>kiri → kanan</b> sesuai urutan. Atur warna & syarat naik ke tiap tahap.
        </p>
        <select value={activeBoardId || ""} onChange={(e) => setBoardId(e.target.value)} className={`${inputCls} max-w-sm`} data-testid="flow-board-select">
          {(boards || []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      {lists.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {lists.map((l, i) => (
            <ListRow key={l.id} list={l} idx={i} nextName={lists[i + 1]?.name} />
          ))}
        </div>
      )}
    </div>
  );
}

function ChecklistTemplateRow({ tpl }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(tpl.name);
  const [itemsText, setItemsText] = useState((tpl.items || []).join("\n"));
  const [busy, setBusy] = useState(false);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["checklist-templates"] });

  const save = async () => {
    if (!name.trim()) return toast.error("Nama template wajib diisi");
    setBusy(true);
    try {
      await api.patch(`/checklist-templates/${tpl.id}`, {
        name: name.trim(),
        items: itemsText.split("\n").map((s) => s.trim()).filter(Boolean),
      });
      toast.success("Template disimpan");
      setEditing(false);
      invalidate();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!confirm(`Hapus template "${tpl.name}"?`)) return;
    try {
      await api.delete(`/checklist-templates/${tpl.id}`);
      toast.success("Template dihapus");
      invalidate();
    } catch (e) { toast.error(errMsg(e)); }
  };

  if (!editing) {
    return (
      <div className="rounded-lg border border-[#DFE1E6] bg-white p-4" data-testid={`tpl-row-${tpl.id}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-sm text-[#172B4D]">{tpl.name}</p>
            <p className="text-xs text-[#8590A2]">{(tpl.items || []).length} item</p>
          </div>
          <div className="flex gap-1 shrink-0">
            <button onClick={() => setEditing(true)} className="p-1.5 rounded hover:bg-[#F1F2F4] text-[#44546F]" title="Ubah"><Pencil size={14} /></button>
            <button onClick={remove} className="p-1.5 rounded hover:bg-[#FFEDEB] text-[#CA3521]" title="Hapus"><Trash2 size={14} /></button>
          </div>
        </div>
        {(tpl.items || []).length > 0 && (
          <ul className="mt-2 space-y-0.5">
            {tpl.items.map((it, i) => (
              <li key={i} className="text-xs text-[#44546F] flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-[3px] border border-[#B3BAC5]" /> {it}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border-2 border-[#0C66E4] bg-white p-4">
      <label className="text-xs font-semibold text-[#44546F]">Nama template</label>
      <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
      <label className="text-xs font-semibold text-[#44546F] mt-2 block">Item (satu per baris)</label>
      <textarea
        value={itemsText}
        onChange={(e) => setItemsText(e.target.value)}
        rows={6}
        className="w-full rounded-lg border border-[#DFE1E6] px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[#0C66E4] resize-y"
      />
      <div className="flex gap-2 mt-2">
        <button onClick={save} disabled={busy} className={btnPrimary}>{busy ? "Menyimpan..." : "Simpan"}</button>
        <button onClick={() => { setEditing(false); setName(tpl.name); setItemsText((tpl.items || []).join("\n")); }} className="h-9 px-4 rounded-lg border border-[#DFE1E6] text-sm text-[#44546F] hover:bg-[#F1F2F4]">Batal</button>
      </div>
    </div>
  );
}

function ChecklistTemplatesTab() {
  const qc = useQueryClient();
  const { data: templates } = useQuery({
    queryKey: ["checklist-templates"],
    queryFn: () => api.get("/checklist-templates").then((r) => r.data),
  });
  const [name, setName] = useState("");
  const [itemsText, setItemsText] = useState("");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!name.trim()) return toast.error("Nama template wajib diisi");
    setBusy(true);
    try {
      await api.post("/checklist-templates", {
        name: name.trim(),
        items: itemsText.split("\n").map((s) => s.trim()).filter(Boolean),
      });
      toast.success("Template dibuat");
      setName(""); setItemsText("");
      qc.invalidateQueries({ queryKey: ["checklist-templates"] });
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4" data-testid="admin-checklist-templates-tab">
      <div className="bg-white rounded-xl border border-[#DFE1E6] shadow-sm p-5">
        <h3 className="font-heading font-bold text-[#172B4D] mb-1 flex items-center gap-2">
          <ListChecks size={16} /> Template Checklist
        </h3>
        <p className="text-sm text-[#44546F] mb-3">
          Template dipakai ulang saat menambah checklist di kartu. Isi item akan disalin ke kartu.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-[#44546F]">Nama template baru</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="mis: Dokumen Pendirian PT" className={inputCls} data-testid="tpl-new-name" />
          </div>
          <div className="sm:row-span-2">
            <label className="text-xs font-semibold text-[#44546F]">Item (satu per baris)</label>
            <textarea
              value={itemsText}
              onChange={(e) => setItemsText(e.target.value)}
              rows={5}
              placeholder={"Akta\nSK Kemenkumham\nNPWP\nNIB"}
              className="w-full rounded-lg border border-[#DFE1E6] px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[#0C66E4] resize-y"
              data-testid="tpl-new-items"
            />
          </div>
          <div>
            <button onClick={create} disabled={busy} className={`${btnPrimary} flex items-center gap-1.5`} data-testid="tpl-new-submit">
              <Plus size={14} /> {busy ? "Membuat..." : "Buat Template"}
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {(templates || []).map((t) => <ChecklistTemplateRow key={t.id} tpl={t} />)}
        {templates && templates.length === 0 && (
          <p className="text-sm text-[#8590A2] col-span-full">Belum ada template. Buat satu di atas.</p>
        )}
      </div>
    </div>
  );
}

function PermissionsTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["permissions"],
    queryFn: () => api.get("/permissions").then((r) => r.data),
  });
  const [savingCell, setSavingCell] = useState(null);
  const [syncing, setSyncing] = useState(false);

  const roles = data?.roles || [];
  const perms = data?.permissions || [];
  const categories = [...new Set(perms.map((p) => p.category))];

  const toggle = async (perm, role, next) => {
    if (role === "super_admin") return;
    setSavingCell(`${perm.key}:${role}`);
    try {
      const r = await api.patch("/permissions", { role, key: perm.key, allowed: next });
      qc.setQueryData(["permissions"], r.data.matrix);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setSavingCell(null);
    }
  };

  const setRoleAll = async (perm, roleList, value) => {
    try {
      const changes = roleList.filter((r) => r !== "super_admin").map((role) => ({ role, key: perm.key, allowed: value }));
      const r = await api.patch("/permissions", { changes });
      qc.setQueryData(["permissions"], r.data.matrix);
    } catch (e) { toast.error(errMsg(e)); }
  };

  const sync = async () => {
    setSyncing(true);
    try {
      const r = await api.post("/permissions/sync");
      qc.setQueryData(["permissions"], r.data.matrix);
      toast.success(`Sinkron: ${r.data.permissions} izin, ${r.data.newRows} baris baru`);
    } catch (e) { toast.error(errMsg(e)); } finally { setSyncing(false); }
  };

  if (isLoading) return <p className="text-sm text-[#8590A2] p-4">Memuat matriks...</p>;

  return (
    <div className="space-y-4" data-testid="admin-permissions-tab">
      <div className="bg-white rounded-xl border border-[#DFE1E6] shadow-sm p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-heading font-bold text-[#172B4D] mb-1 flex items-center gap-2">
              <ShieldCheck size={16} /> Hak Akses per Peran
            </h3>
            <p className="text-sm text-[#44546F]">
              Centang aksi yang boleh dilakukan tiap peran. <b>Super Admin</b> selalu penuh.
              Cek kepemilikan lama (PIC / divisi / owner) tetap berlaku di atas matriks ini.
              Daftar <b>Tabel Database</b> ikut otomatis saat ada model baru.
            </p>
          </div>
          <button onClick={sync} disabled={syncing} className={`${btnPrimary} flex items-center gap-1.5 shrink-0`}>
            <RefreshCw size={14} className={syncing ? "animate-spin" : ""} /> Sinkronkan
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#DFE1E6] shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="sticky top-0 bg-[#F7F8F9] border-b border-[#DFE1E6]">
            <tr>
              <th className="text-left font-semibold text-[#44546F] px-4 py-2.5 w-[40%]">Aksi</th>
              {roles.map((role) => (
                <th key={role} className="text-center font-semibold text-[#44546F] px-2 py-2.5 whitespace-nowrap">
                  {ROLE_LABELS[role] || role}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categories.flatMap((cat) => [
                <tr key={`cat-${cat}`} className="bg-[#FAFBFC]">
                  <td colSpan={roles.length + 1} className="px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[#8590A2]">{cat}</td>
                </tr>,
                ...perms.filter((p) => p.category === cat).map((perm) => (
                  <tr key={perm.key} className="border-b border-[#F1F2F4] hover:bg-[#F7F8F9]">
                    <td className="px-4 py-2 text-[#172B4D]">
                      <div className="flex items-center gap-2">
                        <span>{perm.label}</span>
                        <button
                          title="Aktifkan semua peran"
                          onClick={() => setRoleAll(perm, roles, true)}
                          className="text-[10px] text-[#0C66E4] hover:underline"
                        >semua</button>
                        <button
                          title="Matikan semua peran"
                          onClick={() => setRoleAll(perm, roles, false)}
                          className="text-[10px] text-[#8590A2] hover:underline"
                        >nihil</button>
                      </div>
                      <code className="text-[10px] text-[#8590A2]">{perm.key}</code>
                    </td>
                    {roles.map((role) => {
                      const on = !!perm.allow[role];
                      const isSuper = role === "super_admin";
                      const busy = savingCell === `${perm.key}:${role}`;
                      return (
                        <td key={role} className="text-center px-2 py-2">
                          <input
                            type="checkbox"
                            checked={on}
                            disabled={isSuper || busy}
                            onChange={(e) => toggle(perm, role, e.target.checked)}
                            className="w-4 h-4 accent-[#0C66E4] disabled:opacity-40"
                            data-testid={`perm-${perm.key}-${role}`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                )),
            ])}
          </tbody>
        </table>
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
          {isAdmin && <TabsTrigger value="flow" data-testid="tab-trigger-flow">Alur & Syarat List</TabsTrigger>}
          {isAdmin && <TabsTrigger value="checklist-templates" data-testid="tab-trigger-checklist-templates">Template Checklist</TabsTrigger>}
          {isAdmin && <TabsTrigger value="permissions" data-testid="tab-trigger-permissions">Hak Akses</TabsTrigger>}
          <TabsTrigger value="activity" data-testid="tab-trigger-activity">Log Aktivitas</TabsTrigger>
        </TabsList>
        {isAdmin && (
          <>
            <TabsContent value="users" className="mt-4"><UsersTab divisions={divisions} /></TabsContent>
            <TabsContent value="divisions" className="mt-4"><DivisionsTab divisions={divisions} /></TabsContent>
            <TabsContent value="boards" className="mt-4"><BoardsTab divisions={divisions} /></TabsContent>
            <TabsContent value="flow" className="mt-4"><FlowTab /></TabsContent>
            <TabsContent value="checklist-templates" className="mt-4"><ChecklistTemplatesTab /></TabsContent>
            <TabsContent value="permissions" className="mt-4"><PermissionsTab /></TabsContent>
          </>
        )}
        <TabsContent value="activity" className="mt-4"><ActivityTab /></TabsContent>
      </Tabs>
    </div>
  );
}
