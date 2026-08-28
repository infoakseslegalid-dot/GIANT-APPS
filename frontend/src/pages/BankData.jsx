import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Database, Plus, Hand, X, Lock, CheckCircle2, Swords } from "lucide-react";
import { api, errMsg, fmtDate, PRIORITIES } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Avatar, StatusBadge } from "../components/common";
import CardModal from "../components/CardModal";

const abbr = (name) => {
  const m = (name || "").match(/SKOR\s*(\d)/i);
  if (m) return "S" + m[1];
  return (name || "?").split(" ")[0].slice(0, 8).toUpperCase();
};

const inputCls = "h-9 w-full rounded-lg border border-[#DFE1E6] px-3 text-sm text-[#172B4D] bg-white outline-none focus:ring-2 focus:ring-[#0C66E4]";

function umurInfo(iso) {
  if (!iso) return { text: "-", cls: "text-[#8590A2]" };
  const mins = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  let text;
  if (mins < 60) text = `${mins} mnt`;
  else if (mins < 1440) text = `${Math.floor(mins / 60)} jam ${mins % 60} mnt`;
  else text = `${Math.floor(mins / 1440)} hari ${Math.floor((mins % 1440) / 60)} jam`;
  const cls = mins < 120 ? "text-[#216E4E]" : mins < 480 ? "text-[#946F00]" : "text-[#CA3521]";
  const dot = mins < 120 ? "🟢" : mins < 480 ? "🟡" : "🔴";
  return { text: `${dot} ${text}`, cls };
}

export default function BankData() {
  const { divisionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [openItem, setOpenItem] = useState(null);
  const [form, setForm] = useState({ title: "", client_name: "", note: "", targetDivId: "", list_id: "", mode: "division", member_ids: [], priority: "none", due_date: "" });

  const { data: divisions } = useQuery({ queryKey: ["divisions"], queryFn: () => api.get("/divisions").then((r) => r.data) });
  const activeDivId = divisionId || (divisions || [])[0]?.id;
  const { data, isLoading } = useQuery({
    queryKey: ["bank-data", activeDivId],
    queryFn: () => api.get(`/bank-data/${activeDivId}`).then((r) => r.data),
    enabled: !!activeDivId,
  });
  const formDivId = form.targetDivId || activeDivId;
  const { data: formDivData } = useQuery({
    queryKey: ["bank-data", formDivId],
    queryFn: () => api.get(`/bank-data/${formDivId}`).then((r) => r.data),
    enabled: showCreate && !!formDivId,
  });

  const division = data?.division;
  const items = data?.items || [];
  const workload = data?.workload || [];
  const isDivisionMember = user?.division_id === activeDivId;
  const isSupervisorUp = ["super_admin", "admin", "supervisor"].includes(user?.role);

  const isDone = (i) => i.status === "done" || i.status === "SELESAI";
  const waiting = items.filter((i) => (i.member_ids || []).length === 0 && !isDone(i));
  const taken = items.filter((i) => (i.member_ids || []).length > 0 || isDone(i));

  const formBoards = formDivData?.boards || [];
  const formBoard = formBoards[0];
  const formLists = formBoard?.lists || [];
  const formWorkload = formDivData?.workload || [];

  const openCreate = () => {
    setForm({ title: "", client_name: "", note: "", targetDivId: activeDivId, list_id: "", mode: "division", member_ids: [], priority: "none", due_date: "" });
    setShowCreate(true);
  };

  const createItem = async () => {
    if (!form.title.trim()) {
      toast.error("Judul pekerjaan wajib diisi");
      return;
    }
    if (!formBoard) {
      toast.error("Divisi tujuan belum memiliki board");
      return;
    }
    try {
      await api.post("/work-items", {
        board_id: formBoard.id,
        list_id: form.list_id || formLists[0]?.id,
        title: form.title.trim(),
        client_name: form.client_name.trim(),
        description: form.note.trim(),
        division_ids: [formDivId],
        member_ids: form.mode === "user" ? form.member_ids : [],
        priority: form.priority,
        due_date: form.due_date || null,
      });
      toast.success(`Pekerjaan dikirim ke Bank Data ${formDivData?.division?.name || ""}`);
      setShowCreate(false);
      qc.invalidateQueries({ queryKey: ["bank-data"] });
      qc.invalidateQueries({ queryKey: ["boards"] });
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const claim = async (itemId) => {
    try {
      await api.post(`/work-items/${itemId}/claim`);
      toast.success("Anda menjadi PIC pekerjaan ini");
      qc.invalidateQueries({ queryKey: ["bank-data"] });
      qc.invalidateQueries({ queryKey: ["my-work"] });
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const takeover = async (itemId) => {
    if (!window.confirm("Ambil alih pekerjaan ini? PIC saat ini akan diberi notifikasi.")) return;
    try {
      await api.post(`/work-items/${itemId}/takeover`);
      toast.success("Pekerjaan berhasil diambil alih");
      qc.invalidateQueries({ queryKey: ["bank-data"] });
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto" data-testid="bank-data-page">
      <div className="mb-5">
        <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-[#172B4D] flex items-center gap-2">
          <Database size={24} className="text-[#0C66E4]" /> Bank Data Pekerjaan
        </h1>
        <p className="text-sm text-[#44546F] mt-1">Ruang tunggu pekerjaan divisi — ambil pekerjaan, atau kirim pekerjaan baru ke divisi.</p>
      </div>

      <div className="flex flex-wrap gap-2 mb-5" data-testid="bank-data-division-tabs">
        {(divisions || []).map((d) => (
          <button key={d.id} data-testid={`bankdata-tab-${d.id}`} onClick={() => navigate(`/bank-data/${d.id}`)}
            className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-colors active:scale-95 ${
              d.id === activeDivId ? "text-white" : "bg-white text-[#44546F] border border-[#DFE1E6] hover:bg-[#F1F2F4]"
            }`}
            style={d.id === activeDivId ? { backgroundColor: d.color } : {}}>
            {d.name}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-sm text-[#44546F]">Memuat...</p>}

      {data && (
        <>
          <div className="bg-white rounded-xl border border-[#DFE1E6] shadow-sm mb-5 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#DFE1E6] bg-[#FFF8E6]">
              <h2 className="font-heading font-bold text-[#172B4D]" data-testid="bank-data-waiting-title">
                Menunggu Diambil — {division?.name}
                <span className="ml-2 text-xs font-bold text-[#946F00] bg-[#F5CD47]/40 rounded-full px-2 py-0.5">{waiting.length} pekerjaan</span>
              </h2>
              <button data-testid="bank-data-add-button" onClick={openCreate}
                className="h-9 px-4 rounded-lg bg-[#0c66e4] hover:bg-[#0052cc] text-white text-sm font-semibold flex items-center gap-1.5 transition-colors active:scale-95">
                <Plus size={15} /> Tambah Pekerjaan
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="bank-data-waiting-table">
                <thead>
                  <tr className="border-b border-[#DFE1E6] text-left bg-[#F8F9FA]">
                    <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#8590A2] w-12">No</th>
                    <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#8590A2]">Pekerjaan</th>
                    <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#8590A2]">Sumber</th>
                    <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#8590A2]">List</th>
                    <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#8590A2]">Umur</th>
                    <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#8590A2]">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {waiting.map((item, idx) => {
                    const umur = umurInfo(item.distribution_updated_at || item.created_at);
                    return (
                      <tr key={item.id} className="border-b border-[#F1F2F4] hover:bg-[#F8F9FA] transition-colors" data-testid={`bankdata-row-${item.id}`}>
                        <td className="px-4 py-2.5 text-[#8590A2]">{idx + 1}</td>
                        <td className="px-4 py-2.5 max-w-[300px]">
                          <button onClick={() => setOpenItem(item.id)} className="text-left" data-testid={`bankdata-open-${item.id}`}>
                            <p className="font-medium text-[#172B4D] hover:text-[#0C66E4] line-clamp-2">{item.title}</p>
                            {item.client_name && <p className="text-xs text-[#44546F]">{item.client_name}</p>}
                          </button>
                        </td>
                        <td className="px-4 py-2.5 text-[#44546F] text-xs">{item.created_by_name || "—"}</td>
                        <td className="px-4 py-2.5">
                          <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-[#F1F2F4] text-[#44546F]">{item.list_name}</span>
                        </td>
                        <td className={`px-4 py-2.5 text-xs font-semibold ${umur.cls}`} data-testid={`bankdata-umur-${item.id}`}>{umur.text}</td>
                        <td className="px-4 py-2.5">
                          {isDivisionMember ? (
                            <button data-testid={`bankdata-claim-${item.id}`} onClick={() => claim(item.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#22A06B] hover:bg-[#1D8A5C] text-white text-xs font-bold transition-colors active:scale-95">
                              <Hand size={12} /> AMBIL PEKERJAAN
                            </button>
                          ) : (
                            <span className="text-[11px] text-[#8590A2]">Hanya anggota divisi</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {waiting.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-[#8590A2]">Tidak ada pekerjaan yang menunggu — semua sudah ada PIC.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#DFE1E6] shadow-sm mb-5 overflow-hidden">
            <div className="px-5 py-3 border-b border-[#DFE1E6]">
              <h2 className="font-heading font-bold text-[#172B4D]" data-testid="bank-data-taken-title">
                Sedang Dikerjakan / Selesai
                <span className="ml-2 text-xs font-normal text-[#8590A2]">{taken.length} pekerjaan</span>
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="bank-data-taken-table">
                <thead>
                  <tr className="border-b border-[#DFE1E6] text-left bg-[#F8F9FA]">
                    <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#8590A2] w-12">No</th>
                    <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#8590A2]">Pekerjaan</th>
                    <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#8590A2]">Sumber</th>
                    <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#8590A2]">PIC</th>
                    <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#8590A2]">Tenggat</th>
                    <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#8590A2]">Status</th>
                    <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#8590A2]">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {taken.map((item, idx) => (
                    <TakenRow key={item.id} item={item} idx={idx} user={user} isSupervisorUp={isSupervisorUp}
                      onOpen={() => setOpenItem(item.id)} onTakeover={() => takeover(item.id)} />
                  ))}
                  {taken.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-[#8590A2]">Belum ada pekerjaan yang diambil.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#DFE1E6] shadow-sm p-5" data-testid="bank-data-workload">
            <h2 className="font-heading font-bold text-[#172B4D] mb-4">Beban Kerja Anggota {division?.name}</h2>
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
              {workload.map((w) => (
                <div key={w.user.id} className="rounded-xl border border-[#DFE1E6] p-4 hover:shadow-sm transition-shadow" data-testid={`workload-${w.user.id}`}>
                  <div className="flex items-center gap-2.5 mb-2">
                    <Avatar name={w.user.name} color={w.user.avatar_color} size="h-8 w-8 text-xs" />
                    <div>
                      <p className="text-sm font-semibold text-[#172B4D]">{w.user.name}</p>
                      <p className="text-[11px] text-[#8590A2]">Total {w.total} pekerjaan</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(w.by_list).map(([lname, count]) => (
                      <span key={lname} className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#E9F2FF] text-[#0C66E4]" title={lname}>
                        {abbr(lname)}: {count}
                      </span>
                    ))}
                    {Object.keys(w.by_list).length === 0 && <span className="text-[11px] text-[#8590A2]">Tidak ada pekerjaan aktif</span>}
                  </div>
                </div>
              ))}
              {workload.length === 0 && <p className="text-sm text-[#8590A2]">Belum ada anggota di divisi ini.</p>}
            </div>
          </div>
        </>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-start pt-14 overflow-y-auto fade-enter" onClick={() => setShowCreate(false)} data-testid="bankdata-create-modal">
          <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl p-6 mb-16 modal-enter" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading text-lg font-bold text-[#172B4D]">Kirim Pekerjaan ke Bank Data</h2>
              <button aria-label="Tutup" data-testid="bankdata-create-close" onClick={() => setShowCreate(false)} className="p-1.5 rounded hover:bg-[#F1F2F4] text-[#44546F]">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-[#44546F]">Judul Pekerjaan *</label>
                <input data-testid="bankdata-form-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="mis: PT ABC - Pengurusan NIB" className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#44546F]">Nama Client</label>
                <input data-testid="bankdata-form-client" value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} placeholder="mis: PT ABC" className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#44546F]">Catatan</label>
                <textarea data-testid="bankdata-form-note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2} placeholder="mis: Pendirian PT + NPWP" className="w-full rounded-lg border border-[#DFE1E6] px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[#0C66E4] resize-none" />
              </div>
              <div className="border-t border-[#DFE1E6] pt-3">
                <p className="text-xs font-bold uppercase tracking-wider text-[#8590A2] mb-2">Kirim ke</p>
                <label className="text-xs font-semibold text-[#44546F]">Divisi Tujuan</label>
                <select data-testid="bankdata-form-division" value={formDivId || ""} onChange={(e) => setForm({ ...form, targetDivId: e.target.value, list_id: "", member_ids: [] })} className={inputCls}>
                  {(divisions || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                {formLists.length > 0 && (
                  <div className="mt-2">
                    <label className="text-xs font-semibold text-[#44546F]">Masuk ke list</label>
                    <select data-testid="bankdata-form-list" value={form.list_id} onChange={(e) => setForm({ ...form, list_id: e.target.value })} className={inputCls}>
                      {formLists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div className="border-t border-[#DFE1E6] pt-3">
                <p className="text-xs font-bold uppercase tracking-wider text-[#8590A2] mb-2">Penanggung Jawab</p>
                <label className="flex items-start gap-2 cursor-pointer mb-1.5" data-testid="bankdata-mode-division">
                  <input type="radio" checked={form.mode === "division"} onChange={() => setForm({ ...form, mode: "division" })} className="mt-1 accent-[#0C66E4]" />
                  <span className="text-sm text-[#172B4D]">Biarkan anggota divisi mengambil sendiri</span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer" data-testid="bankdata-mode-user">
                  <input type="radio" checked={form.mode === "user"} onChange={() => setForm({ ...form, mode: "user" })} className="mt-1 accent-[#0C66E4]" />
                  <span className="text-sm text-[#172B4D]">Berikan langsung kepada user tertentu</span>
                </label>
                {form.mode === "user" && (
                  <div className="mt-2 max-h-32 overflow-y-auto minimal-scrollbar space-y-1 border border-[#DFE1E6] rounded-lg p-2">
                    {formWorkload.map((w) => (
                      <label key={w.user.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#F1F2F4] cursor-pointer" data-testid={`bankdata-assign-${w.user.id}`}>
                        <input type="checkbox" checked={form.member_ids.includes(w.user.id)}
                          onChange={() => setForm((f) => ({ ...f, member_ids: f.member_ids.includes(w.user.id) ? f.member_ids.filter((x) => x !== w.user.id) : [...f.member_ids, w.user.id] }))}
                          className="w-4 h-4 accent-[#0C66E4]" />
                        <Avatar name={w.user.name} color={w.user.avatar_color} size="h-6 w-6 text-[10px]" />
                        <span className="text-sm text-[#172B4D] flex-1">{w.user.name}</span>
                        <span className="text-[10px] text-[#8590A2]">{w.total} pekerjaan</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-[#44546F]">Prioritas (opsional)</label>
                  <select data-testid="bankdata-form-priority" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className={inputCls}>
                    {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#44546F]">Tenggat (opsional)</label>
                  <input data-testid="bankdata-form-due" type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className={inputCls} />
                </div>
              </div>
              <button data-testid="bankdata-create-submit" onClick={createItem} className="w-full h-10 rounded-lg bg-[#0c66e4] hover:bg-[#0052cc] text-white text-sm font-semibold transition-colors active:scale-95">
                Kirim Pekerjaan
              </button>
            </div>
          </div>
        </div>
      )}

      {openItem && <CardModal itemId={openItem} onClose={() => setOpenItem(null)} />}
    </div>
  );
}

function TakenRow({ item, idx, user, isSupervisorUp, onOpen, onTakeover }) {
  const { data: users } = useQuery({ queryKey: ["users"], queryFn: () => api.get("/users").then((r) => r.data) });
  const usersById = Object.fromEntries((users || []).map((u) => [u.id, u]));
  const isMine = (item.member_ids || []).includes(user?.id);
  const firstPic = usersById[(item.member_ids || [])[0]];
  return (
    <tr className="border-b border-[#F1F2F4] hover:bg-[#F8F9FA] transition-colors" data-testid={`bankdata-taken-row-${item.id}`}>
      <td className="px-4 py-2.5 text-[#8590A2]">{idx + 1}</td>
      <td className="px-4 py-2.5 max-w-[280px]">
        <button onClick={onOpen} className="text-left" data-testid={`bankdata-open-${item.id}`}>
          <p className="font-medium text-[#172B4D] hover:text-[#0C66E4] line-clamp-2">{item.title}</p>
          {item.client_name && <p className="text-xs text-[#44546F]">{item.client_name}</p>}
        </button>
      </td>
      <td className="px-4 py-2.5 text-[#44546F] text-xs">{item.created_by_name || "—"}</td>
      <td className="px-4 py-2.5">
        <div className="flex flex-wrap gap-1">
          {(item.member_ids || []).map((id) => {
            const u = usersById[id];
            return u ? (
              <span key={id} className="inline-flex items-center gap-1 bg-[#F1F2F4] rounded-full pl-0.5 pr-2 py-0.5">
                <Avatar name={u.name} color={u.avatar_color} size="h-5 w-5 text-[9px]" />
                <span className="text-[11px] font-medium text-[#172B4D]">{u.name}</span>
              </span>
            ) : null;
          })}
        </div>
      </td>
      <td className="px-4 py-2.5 text-[#44546F]">{item.due_date ? fmtDate(item.due_date) : "—"}</td>
      <td className="px-4 py-2.5"><StatusBadge status={item.status} /></td>
      <td className="px-4 py-2.5">
        {isMine ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#216E4E]"><CheckCircle2 size={12} /> Pekerjaan Anda</span>
        ) : isSupervisorUp && item.status !== "done" && item.status !== "SELESAI" ? (
          <button data-testid={`bankdata-takeover-${item.id}`} onClick={onTakeover}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FFF8E6] border border-[#F5CD47] text-[#946F00] text-xs font-bold hover:bg-[#F5CD47]/40 transition-colors active:scale-95">
            <Swords size={12} /> Ambil Alih
          </button>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] text-[#8590A2]"><Lock size={11} /> {firstPic ? `Dikerjakan ${firstPic.name}` : "—"}</span>
        )}
      </td>
    </tr>
  );
}
