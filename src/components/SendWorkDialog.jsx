import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { X, Send } from "lucide-react";
import { api, errMsg, PRIORITIES } from "../lib/api";
import { Avatar } from "./common";

const inputCls = "h-9 w-full rounded-lg border border-[#DFE1E6] px-3 text-sm text-[#172B4D] bg-white outline-none focus:ring-2 focus:ring-[#0C66E4]";

export default function SendWorkDialog({ item, onClose, onDone }) {
  const [divisionId, setDivisionId] = useState("");
  const [listId, setListId] = useState("");
  const [mode, setMode] = useState("division");
  const [memberIds, setMemberIds] = useState([]);
  const [note, setNote] = useState("");
  const [showExtra, setShowExtra] = useState(false);
  const [priority, setPriority] = useState("none");
  const [dueDate, setDueDate] = useState("");
  const [sending, setSending] = useState(false);

  const { data: divisions } = useQuery({ queryKey: ["divisions"], queryFn: () => api.get("/divisions").then((r) => r.data) });
  const { data: divData } = useQuery({
    queryKey: ["bank-data", divisionId],
    queryFn: () => api.get(`/bank-data/${divisionId}`).then((r) => r.data),
    enabled: !!divisionId,
  });

  const boards = divData?.boards || [];
  const lists = boards[0]?.lists || [];
  const workload = divData?.workload || [];
  const selectedDivision = (divisions || []).find((d) => d.id === divisionId);

  const pickDivision = (id) => {
    setDivisionId(id);
    setMemberIds([]);
    setListId("");
  };

  const toggleMember = (uid) => {
    setMemberIds((m) => (m.includes(uid) ? m.filter((x) => x !== uid) : [...m, uid]));
  };

  const submit = async () => {
    if (!divisionId) {
      toast.error("Pilih divisi tujuan terlebih dahulu");
      return;
    }
    setSending(true);
    try {
      await api.post(`/work-items/${item.id}/send-to-division`, {
        target_division_id: divisionId,
        target_list_id: listId || null,
        assign_to_user_id: mode === "user" && memberIds.length > 0 ? memberIds[0] : null,
        note,
        priority: priority !== "none" ? priority : null,
        due_date: dueDate || null,
      });
      toast.success(`Pekerjaan dikirim ke Bank Data ${selectedDivision?.name || ""}`);
      onDone?.();
      onClose();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex justify-center items-start pt-16 overflow-y-auto fade-enter" onClick={onClose} data-testid="send-work-dialog">
      <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl p-6 mb-16 modal-enter" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-heading text-lg font-bold text-[#172B4D]">Kirim / Mirror Pekerjaan</h2>
          <button aria-label="Tutup" data-testid="send-work-close" onClick={onClose} className="p-1.5 rounded hover:bg-[#F1F2F4] text-[#44546F]">
            <X size={18} />
          </button>
        </div>
        <div className="bg-[#F4F5F7] rounded-lg px-3 py-2 mb-4">
          <p className="text-sm font-semibold text-[#172B4D]">{item.title}</p>
          {item.client_name && <p className="text-xs text-[#44546F]">{item.client_name}</p>}
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-[#44546F]">Catatan untuk penerima</label>
            <textarea
              data-testid="send-note-input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="mis: Draft akta sudah selesai, mohon dilanjutkan ke notaris."
              className="w-full rounded-lg border border-[#DFE1E6] px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[#0C66E4] resize-none"
            />
            <p className="text-[11px] text-[#8590A2] mt-1">Dikirim sebagai komentar pertama di kartu penerima — bukan mengubah deskripsi.</p>
          </div>

          <div className="border-t border-[#DFE1E6] pt-3">
            <p className="text-xs font-bold uppercase tracking-wider text-[#8590A2] mb-2">Kirim ke</p>
            <label className="text-xs font-semibold text-[#44546F]">Divisi Tujuan *</label>
            <select data-testid="send-division-select" value={divisionId} onChange={(e) => pickDivision(e.target.value)} className={inputCls}>
              <option value="">Pilih divisi...</option>
              {(divisions || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            {divisionId && lists.length > 0 && (
              <div className="mt-2">
                <label className="text-xs font-semibold text-[#44546F]">Masuk ke list</label>
                <select data-testid="send-list-select" value={listId} onChange={(e) => setListId(e.target.value)} className={inputCls}>
                  <option value="">(tetap di posisi saat ini)</option>
                  {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
            )}
          </div>

          {divisionId && (
            <div className="border-t border-[#DFE1E6] pt-3">
              <p className="text-xs font-bold uppercase tracking-wider text-[#8590A2] mb-2">Penanggung Jawab</p>
              <label className="flex items-start gap-2 cursor-pointer mb-1.5" data-testid="send-mode-division">
                <input type="radio" checked={mode === "division"} onChange={() => setMode("division")} className="mt-1 accent-[#0C66E4]" />
                <span className="text-sm text-[#172B4D]">Biarkan anggota divisi mengambil sendiri
                  <span className="block text-[11px] text-[#8590A2]">Masuk Bank Data sebagai "Menunggu Diambil"</span>
                </span>
              </label>
              <label className="flex items-start gap-2 cursor-pointer" data-testid="send-mode-user">
                <input type="radio" checked={mode === "user"} onChange={() => setMode("user")} className="mt-1 accent-[#0C66E4]" />
                <span className="text-sm text-[#172B4D]">Berikan langsung kepada user tertentu</span>
              </label>
              {mode === "user" && (
                <div className="mt-2 max-h-36 overflow-y-auto minimal-scrollbar space-y-1 border border-[#DFE1E6] rounded-lg p-2">
                  {workload.map((w) => (
                    <label key={w.user.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#F1F2F4] cursor-pointer" data-testid={`send-user-${w.user.id}`}>
                      <input type="checkbox" checked={memberIds.includes(w.user.id)} onChange={() => toggleMember(w.user.id)} className="w-4 h-4 accent-[#0C66E4]" />
                      <Avatar name={w.user.name} color={w.user.avatar_color} size="h-6 w-6 text-[10px]" />
                      <span className="text-sm text-[#172B4D] flex-1">{w.user.name}</span>
                      <span className="text-[10px] text-[#8590A2]">{w.total} pekerjaan</span>
                    </label>
                  ))}
                  {workload.length === 0 && <p className="text-xs text-[#8590A2] px-1">Belum ada anggota di divisi ini.</p>}
                </div>
              )}
            </div>
          )}

          <div>
            <button data-testid="send-extra-toggle" onClick={() => setShowExtra(!showExtra)} className="text-xs text-[#0C66E4] hover:underline font-semibold">
              {showExtra ? "▾" : "▸"} Opsi Tambahan
            </button>
            {showExtra && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <label className="text-xs font-semibold text-[#44546F]">Prioritas</label>
                  <select data-testid="send-priority-select" value={priority} onChange={(e) => setPriority(e.target.value)} className={inputCls}>
                    {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#44546F]">Tenggat</label>
                  <input data-testid="send-due-input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} />
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <button data-testid="send-cancel-button" onClick={onClose} className="flex-1 h-10 rounded-lg bg-[#091E420F] hover:bg-[#091E4224] text-[#172B4D] text-sm font-semibold transition-colors">
              Batal
            </button>
            <button
              data-testid="send-submit-button"
              onClick={submit}
              disabled={sending || !divisionId}
              className="flex-1 h-10 rounded-lg bg-[#0c66e4] hover:bg-[#0052cc] text-white text-sm font-semibold transition-colors active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Send size={14} /> {sending ? "Mengirim..." : "Kirim Pekerjaan"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
