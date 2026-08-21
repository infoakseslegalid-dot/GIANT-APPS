import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Database, Plus, Hand, X } from "lucide-react";
import { api, errMsg, fmtDate } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Avatar, StatusBadge, PriorityFlag } from "../components/common";
import CardModal from "../components/CardModal";

const abbr = (name) => {
  const m = (name || "").match(/SKOR\s*(\d)/i);
  if (m) return "S" + m[1];
  return (name || "?").split(" ")[0].slice(0, 8).toUpperCase();
};

const inputCls = "h-9 w-full rounded-lg border border-[#DFE1E6] px-3 text-sm text-[#172B4D] bg-white outline-none focus:ring-2 focus:ring-[#0C66E4]";

export default function BankData() {
  const { divisionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [openItem, setOpenItem] = useState(null);
  const [form, setForm] = useState({ title: "", client_name: "", description: "", board_id: "", list_id: "", member_ids: [] });

  const { data: divisions } = useQuery({ queryKey: ["divisions"], queryFn: () => api.get("/divisions").then((r) => r.data) });
  const activeDivId = divisionId || (divisions || [])[0]?.id;
  const { data, isLoading } = useQuery({
    queryKey: ["bank-data", activeDivId],
    queryFn: () => api.get(`/bank-data/${activeDivId}`).then((r) => r.data),
    enabled: !!activeDivId,
  });

  const division = data?.division;
  const items = data?.items || [];
  const boards = data?.boards || [];
  const workload = data?.workload || [];
  const selectedBoard = boards.find((b) => b.id === form.board_id) || boards[0];
  const isDivisionMember = user?.division_id === activeDivId;

  const openCreate = () => {
    const b = boards[0];
    setForm({ title: "", client_name: "", description: "", board_id: b?.id || "", list_id: b?.lists?.[0]?.id || "", member_ids: [] });
    setShowCreate(true);
  };

  const createItem = async () => {
    if (!form.title.trim()) {
      toast.error("Judul pekerjaan wajib diisi");
      return;
    }
    if (!form.board_id || !form.list_id) {
      toast.error("Pilih board dan list tujuan");
      return;
    }
    try {
      await api.post("/work-items", {
        board_id: form.board_id,
        list_id: form.list_id,
        title: form.title.trim(),
        client_name: form.client_name.trim(),
        description: form.description.trim(),
        division_ids: [activeDivId],
        member_ids: form.member_ids,
      });
      toast.success("Pekerjaan ditambahkan ke bank data");
      setShowCreate(false);
      qc.invalidateQueries({ queryKey: ["bank-data", activeDivId] });
      qc.invalidateQueries({ queryKey: ["boards"] });
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const claim = async (itemId) => {
    try {
      await api.post(`/work-items/${itemId}/claim`);
      toast.success("Anda menjadi PIC pekerjaan ini");
      qc.invalidateQueries({ queryKey: ["bank-data", activeDivId] });
      qc.invalidateQueries({ queryKey: ["my-work"] });
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const toggleAssignUser = (uid) => {
    setForm((f) => ({
      ...f,
      member_ids: f.member_ids.includes(uid) ? f.member_ids.filter((x) => x !== uid) : [...f.member_ids, uid],
    }));
  };

  return (
    <div className="p-6 max-w-7xl mx-auto" data-testid="bank-data-page">
      <div className="mb-5">
        <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-[#172B4D] flex items-center gap-2">
          <Database size={24} className="text-[#0C66E4]" /> Bank Data Pekerjaan
        </h1>
        <p className="text-sm text-[#44546F] mt-1">Semua pekerjaan divisi — klaim pekerjaan atau tambahkan & assign pekerjaan baru.</p>
      </div>

      <div className="flex flex-wrap gap-2 mb-5" data-testid="bank-data-division-tabs">
        {(divisions || []).map((d) => (
          <button
            key={d.id}
            data-testid={`bankdata-tab-${d.id}`}
            onClick={() => navigate(`/bank-data/${d.id}`)}
            className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-colors active:scale-95 ${
              d.id === activeDivId ? "text-white" : "bg-white text-[#44546F] border border-[#DFE1E6] hover:bg-[#F1F2F4]"
            }`}
            style={d.id === activeDivId ? { backgroundColor: d.color } : {}}
          >
            {d.name}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-sm text-[#44546F]">Memuat...</p>}

      {data && (
        <>
          <div className="bg-white rounded-xl border border-[#DFE1E6] shadow-sm mb-5 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#DFE1E6]">
              <h2 className="font-heading font-bold text-[#172B4D]" data-testid="bank-data-title">
                Bank Data — {division?.name}
                <span className="ml-2 text-xs font-normal text-[#8590A2]">{items.length} pekerjaan aktif</span>
              </h2>
              <button
                data-testid="bank-data-add-button"
                onClick={openCreate}
                className="h-9 px-4 rounded-lg bg-[#0c66e4] hover:bg-[#0052cc] text-white text-sm font-semibold flex items-center gap-1.5 transition-colors active:scale-95"
              >
                <Plus size={15} /> Tambah Pekerjaan
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="bank-data-table">
                <thead>
                  <tr className="border-b border-[#DFE1E6] text-left bg-[#F8F9FA]">
                    <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#8590A2] w-12">No</th>
                    <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#8590A2]">Pekerjaan</th>
                    <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#8590A2]">List</th>
                    <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#8590A2]">PIC</th>
                    <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#8590A2]">Tenggat</th>
                    <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#8590A2]">Status</th>
                    <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#8590A2]">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const isPic = (item.member_ids || []).includes(user?.id);
                    const canClaim = isDivisionMember && !isPic && item.status !== "done";
                    return (
                      <tr key={item.id} className="border-b border-[#F1F2F4] hover:bg-[#F8F9FA] transition-colors" data-testid={`bankdata-row-${item.id}`}>
                        <td className="px-4 py-2.5 text-[#8590A2]">{idx + 1}</td>
                        <td className="px-4 py-2.5 max-w-[300px]">
                          <button onClick={() => setOpenItem(item.id)} className="text-left" data-testid={`bankdata-open-${item.id}`}>
                            <p className="font-medium text-[#172B4D] hover:text-[#0C66E4] line-clamp-2">{item.title}</p>
                            {item.client_name && <p className="text-xs text-[#44546F]">{item.client_name}</p>}
                          </button>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-[#F1F2F4] text-[#44546F]">{item.list_name}</span>
                          {item.board_name && <p className="text-[10px] text-[#8590A2] mt-0.5">{item.board_name}</p>}
                        </td>
                        <td className="px-4 py-2.5">
                          {(item.member_ids || []).length === 0 ? (
                            <span className="text-[11px] font-semibold text-[#216E4E] bg-[#E3FCEF] border border-[#22A06B] px-1.5 py-0.5 rounded">Terbuka</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {(item.member_ids || []).map((id) => (
                                <PicName key={id} userId={id} />
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-[#44546F]">{item.due_date ? fmtDate(item.due_date) : "—"}</td>
                        <td className="px-4 py-2.5"><StatusBadge status={item.status} /></td>
                        <td className="px-4 py-2.5">
                          {canClaim ? (
                            <button
                              data-testid={`bankdata-claim-${item.id}`}
                              onClick={() => claim(item.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#22A06B] hover:bg-[#1D8A5C] text-white text-xs font-semibold transition-colors active:scale-95"
                            >
                              <Hand size={12} /> Klaim
                            </button>
                          ) : isPic ? (
                            <span className="text-[11px] font-semibold text-[#0C66E4]">PIC Anda</span>
                          ) : (
                            <span className="text-[11px] text-[#8590A2]">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {items.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-[#8590A2]">Belum ada pekerjaan di divisi ini.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#DFE1E6] shadow-sm p-5" data-testid="bank-data-workload">
            <h2 className="font-heading font-bold text-[#172B4D] mb-4">Assign — Beban Kerja Anggota {division?.name}</h2>
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-start pt-20 overflow-y-auto fade-enter" onClick={() => setShowCreate(false)} data-testid="bankdata-create-modal">
          <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl p-6 mb-16 modal-enter" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading text-lg font-bold text-[#172B4D]">Tambah Pekerjaan — {division?.name}</h2>
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
                <label className="text-xs font-semibold text-[#44546F]">Jenis Pekerjaan / Catatan</label>
                <textarea data-testid="bankdata-form-description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="mis: Pendirian PT + NPWP" className="w-full rounded-lg border border-[#DFE1E6] px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[#0C66E4] resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-[#44546F]">Board Tujuan</label>
                  <select
                    data-testid="bankdata-form-board"
                    value={form.board_id}
                    onChange={(e) => {
                      const b = boards.find((x) => x.id === e.target.value);
                      setForm({ ...form, board_id: e.target.value, list_id: b?.lists?.[0]?.id || "" });
                    }}
                    className={inputCls}
                  >
                    {boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#44546F]">List Awal</label>
                  <select data-testid="bankdata-form-list" value={form.list_id} onChange={(e) => setForm({ ...form, list_id: e.target.value })} className={inputCls}>
                    {(selectedBoard?.lists || []).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="rounded-lg border border-[#DFE1E6] p-3">
                <p className="text-xs font-semibold text-[#44546F] mb-2">
                  Assign ke: <span className="text-white px-1.5 py-0.5 rounded" style={{ backgroundColor: division?.color }}>{division?.name}</span>
                  <span className="text-[#8590A2] font-normal"> (otomatis — pekerjaan tetap tampil di bank data divisi ini)</span>
                </p>
                <p className="text-xs font-semibold text-[#44546F] mb-1.5">PIC langsung (opsional — bisa juga divisi saja):</p>
                <div className="max-h-36 overflow-y-auto minimal-scrollbar space-y-1">
                  {workload.map((w) => (
                    <label key={w.user.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#F1F2F4] cursor-pointer" data-testid={`bankdata-assign-${w.user.id}`}>
                      <input
                        type="checkbox"
                        checked={form.member_ids.includes(w.user.id)}
                        onChange={() => toggleAssignUser(w.user.id)}
                        className="w-4 h-4 accent-[#0C66E4]"
                      />
                      <Avatar name={w.user.name} color={w.user.avatar_color} size="h-6 w-6 text-[10px]" />
                      <span className="text-sm text-[#172B4D] flex-1">{w.user.name}</span>
                      <span className="text-[10px] text-[#8590A2]">{w.total} pekerjaan</span>
                    </label>
                  ))}
                  {workload.length === 0 && <p className="text-xs text-[#8590A2]">Belum ada anggota divisi.</p>}
                </div>
              </div>
              <button data-testid="bankdata-create-submit" onClick={createItem} className="w-full h-10 rounded-lg bg-[#0c66e4] hover:bg-[#0052cc] text-white text-sm font-semibold transition-colors active:scale-95">
                Simpan ke Bank Data
              </button>
            </div>
          </div>
        </div>
      )}

      {openItem && <CardModal itemId={openItem} onClose={() => setOpenItem(null)} />}
    </div>
  );
}

function PicName({ userId }) {
  const { data: users } = useQuery({ queryKey: ["users"], queryFn: () => api.get("/users").then((r) => r.data) });
  const u = (users || []).find((x) => x.id === userId);
  if (!u) return null;
  return (
    <span className="inline-flex items-center gap-1 bg-[#F1F2F4] rounded-full pl-0.5 pr-2 py-0.5">
      <Avatar name={u.name} color={u.avatar_color} size="h-5 w-5 text-[9px]" />
      <span className="text-[11px] font-medium text-[#172B4D]">{u.name}</span>
    </span>
  );
}
