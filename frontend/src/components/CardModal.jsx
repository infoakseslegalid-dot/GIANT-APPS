import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  X, AlignLeft, Tags, Clock, Users, Building2, CheckSquare, Paperclip,
  MessageSquare, Link2, Hand, CheckCircle2, Archive, ArchiveRestore, Trash2, Flag, Send, Plus, Download, Activity,
} from "lucide-react";
import { api, errMsg, PRIORITIES, fmtDateTime, LABEL_COLORS, API } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Avatar } from "./common";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

function SectionTitle({ icon, children }) {
  return (
    <div className="flex items-center gap-2 text-[#44546F] mb-2">
      {icon}
      <h3 className="text-xs font-bold uppercase tracking-wider">{children}</h3>
    </div>
  );
}

function ActionChip({ icon, label, onClick, testid, color = "default", disabled }) {
  const styles = {
    default: "bg-[#091E420F] hover:bg-[#091E4224] text-[#172B4D]",
    green: "bg-[#22A06B] hover:bg-[#1D8A5C] text-white",
    blue: "bg-[#0c66e4] hover:bg-[#0052cc] text-white",
    red: "bg-[#FFECE8] hover:bg-[#FFD5CC] text-[#CA3521]",
  };
  return (
    <button
      data-testid={testid}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors active:scale-95 disabled:opacity-50 ${styles[color]}`}
    >
      {icon} {label}
    </button>
  );
}

export default function CardModal({ itemId, onClose }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [comment, setComment] = useState("");
  const [showActivityDetail, setShowActivityDetail] = useState(true);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState(LABEL_COLORS[0]);
  const [newChecklistTitle, setNewChecklistTitle] = useState("");
  const [addingChecklist, setAddingChecklist] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data, refetch } = useQuery({
    queryKey: ["work-item", itemId],
    queryFn: () => api.get(`/work-items/${itemId}`).then((r) => r.data),
  });
  const { data: users } = useQuery({ queryKey: ["users"], queryFn: () => api.get("/users").then((r) => r.data) });
  const { data: divisions } = useQuery({ queryKey: ["divisions"], queryFn: () => api.get("/divisions").then((r) => r.data) });
  const { data: allBoards } = useQuery({ queryKey: ["boards"], queryFn: () => api.get("/boards").then((r) => r.data) });

  if (!data) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-start pt-16" onClick={onClose}>
        <div className="bg-[#f4f5f7] w-full max-w-4xl rounded-xl p-10 text-center text-[#44546F]">Memuat...</div>
      </div>
    );
  }

  const { item, comments, attachments, activities, board_labels, list_name, board_name, mirror_boards } = data;
  const invalidate = () => {
    refetch();
    qc.invalidateQueries({ queryKey: ["board", item.board_id] });
    qc.invalidateQueries({ queryKey: ["my-work"] });
    qc.invalidateQueries({ queryKey: ["all-work"] });
    qc.invalidateQueries({ queryKey: ["stats"] });
    qc.invalidateQueries({ queryKey: ["bank-data"] });
    qc.invalidateQueries({ queryKey: ["global-hari"] });
    qc.invalidateQueries({ queryKey: ["global-skor"] });
  };
  const run = async (fn, successMsg) => {
    try {
      const r = await fn();
      if (r?.data?.warning) toast.warning(r.data.warning);
      if (successMsg) toast.success(successMsg);
      invalidate();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const isSupervisorUp = ["super_admin", "admin", "supervisor"].includes(user?.role);
  const isAdmin = ["super_admin", "admin"].includes(user?.role);
  const isMember = (item.member_ids || []).includes(user?.id);
  const clTotal = (item.checklists || []).reduce((a, c) => a + c.items.length, 0);
  const clDone = (item.checklists || []).reduce((a, c) => a + c.items.filter((i) => i.done).length, 0);
  const progress = clTotal ? Math.round((clDone / clTotal) * 100) : 0;
  const usersById = Object.fromEntries((users || []).map((u) => [u.id, u]));
  const members = (item.member_ids || []).map((id) => usersById[id]).filter(Boolean);
  const mirrorCandidates = (allBoards || []).filter(
    (b) => b.id !== item.board_id && !(item.mirror_board_ids || []).includes(b.id)
  );

  const saveField = (field, value) => run(() => api.patch(`/work-items/${itemId}`, { [field]: value }));

  const toggleLabel = (labelId) => {
    const ids = item.label_ids || [];
    const next = ids.includes(labelId) ? ids.filter((x) => x !== labelId) : [...ids, labelId];
    run(() => api.patch(`/work-items/${itemId}`, { label_ids: next }));
  };

  const toggleMember = (uid) => {
    const isIn = (item.member_ids || []).includes(uid);
    run(() => api.post(`/work-items/${itemId}/assign`, isIn ? { remove_user_ids: [uid] } : { add_user_ids: [uid] }));
  };

  const toggleDivision = (did) => {
    const isIn = (item.division_ids || []).includes(did);
    run(() => api.post(`/work-items/${itemId}/assign`, isIn ? { remove_division_ids: [did] } : { add_division_ids: [did] }), "Divisi diperbarui");
  };

  const uploadFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      await api.post(`/work-items/${itemId}/attachments`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success("Lampiran diunggah");
      invalidate();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const renderCommentText = (text) =>
    text.split(/(@[\w\.]+)/g).map((part, i) =>
      part.startsWith("@") ? (
        <span key={i} className="text-[#0C66E4] font-semibold bg-[#E9F2FF] rounded px-0.5">{part}</span>
      ) : (
        <span key={i}>{part}</span>
      )
    );

  const feed = [
    ...(comments || []).map((c) => ({ kind: "comment", at: c.created_at, data: c })),
    ...(showActivityDetail ? (activities || []).map((a) => ({ kind: "activity", at: a.created_at, data: a })) : []),
  ].sort((a, b) => (a.at < b.at ? 1 : -1));

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-start pt-8 overflow-y-auto fade-enter"
      onClick={onClose}
      data-testid="card-modal-overlay"
    >
      <div
        className="bg-[#f4f5f7] w-full max-w-5xl rounded-xl shadow-2xl relative mb-16 text-[#172B4D] modal-enter"
        onClick={(e) => e.stopPropagation()}
        data-testid="card-modal"
      >
        <button aria-label="Tutup" data-testid="card-modal-close" onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-[#091E4224] text-[#44546F] z-10">
          <X size={18} />
        </button>

        <div className="px-6 pt-5 pb-4 border-b border-[#DFE1E6]">
          <input
            data-testid="card-title-input"
            defaultValue={item.title}
            key={item.id + item.title}
            onBlur={(e) => e.target.value.trim() && e.target.value !== item.title && saveField("title", e.target.value.trim())}
            className="w-full bg-transparent font-heading text-xl font-bold text-[#172B4D] outline-none rounded px-1 -ml-1 focus:bg-white focus:ring-2 focus:ring-[#0C66E4]"
          />
          <p className="text-xs text-[#44546F] mt-1 px-1">
            di list <span className="font-semibold underline">{list_name}</span> · board <span className="font-semibold">{board_name}</span>
            {item.hari_stage ? <> · <span className="font-semibold text-[#E56910]">Proses HARI {item.hari_stage}</span></> : null}
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {!isMember && item.status !== "done" && (
              <ActionChip testid="claim-button" icon={<Hand size={13} />} label="Ambil Pekerjaan" color="green"
                onClick={() => run(() => api.post(`/work-items/${itemId}/claim`), "Anda menjadi PIC pekerjaan ini")} />
            )}
            {isMember && item.status !== "done" && (
              <ActionChip testid="release-button" icon={<X size={13} />} label="Lepas"
                onClick={() => run(() => api.post(`/work-items/${itemId}/release`), "Pekerjaan dilepas")} />
            )}
            {item.status === "active" && (
              <ActionChip testid="submit-done-button" icon={<Send size={13} />} label={item.needs_approval ? "Ajukan Penyelesaian" : "Tandai Selesai"} color="blue"
                onClick={() => run(() => api.post(`/work-items/${itemId}/submit`), item.needs_approval ? "Diajukan untuk persetujuan" : "Pekerjaan selesai")} />
            )}
            {item.status === "submitted" && isSupervisorUp && (
              <ActionChip testid="approve-button" icon={<CheckCircle2 size={13} />} label="Setujui & Selesaikan" color="green"
                onClick={() => run(() => api.post(`/work-items/${itemId}/approve`), "Pekerjaan disetujui")} />
            )}
            {item.status === "submitted" && !isSupervisorUp && (
              <span className="text-xs bg-[#F4F0FF] text-[#5E4DB2] rounded-lg px-3 py-1.5 font-semibold" data-testid="waiting-approval-note">
                Menunggu persetujuan supervisor/admin
              </span>
            )}
            {item.status === "done" && (
              <ActionChip testid="reopen-button" icon={<ArchiveRestore size={13} />} label="Buka Kembali"
                onClick={() => run(() => api.post(`/work-items/${itemId}/reopen`), "Pekerjaan dibuka kembali")} />
            )}
            <Popover>
              <PopoverTrigger asChild>
                <button data-testid="mirror-button" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#091E420F] hover:bg-[#091E4224] text-[#172B4D] transition-colors active:scale-95">
                  <Link2 size={13} /> Mirror ke Board
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-72 bg-white shadow-lg" align="start">
                <p className="text-xs font-bold uppercase tracking-wider text-[#8590A2] mb-2">Mirror ke board lain</p>
                <div className="max-h-48 overflow-y-auto minimal-scrollbar space-y-1">
                  {mirrorCandidates.map((b) => (
                    <button
                      key={b.id}
                      data-testid={`mirror-to-${b.id}`}
                      onClick={() => run(() => api.post(`/work-items/${itemId}/mirror`, { board_id: b.id }), `Di-mirror ke ${b.name}`)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#F1F2F4] text-left"
                    >
                      <span className="w-4 h-4 rounded shrink-0" style={{ backgroundColor: b.background }} />
                      <span className="text-sm">{b.name}</span>
                    </button>
                  ))}
                  {mirrorCandidates.length === 0 && <p className="text-xs text-[#8590A2]">Tidak ada board lain yang tersedia.</p>}
                </div>
                {(mirror_boards || []).length > 0 && (
                  <div className="border-t mt-2 pt-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-[#8590A2] mb-1">Ter-mirror di:</p>
                    {mirror_boards.map((b) => (
                      <div key={b.id} className="flex items-center justify-between px-2 py-1" data-testid={`mirrored-at-${b.id}`}>
                        <span className="text-sm text-[#172B4D]">{b.name}</span>
                        <button
                          data-testid={`unmirror-${b.id}`}
                          onClick={() => run(() => api.post(`/work-items/${itemId}/unmirror`, { board_id: b.id }), "Mirror dihapus")}
                          className="text-xs text-[#CA3521] hover:underline"
                        >
                          Hapus dari board
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </PopoverContent>
            </Popover>
            {!item.archived ? (
              <ActionChip testid="archive-button" icon={<Archive size={13} />} label="Arsipkan"
                onClick={() => run(() => api.post(`/work-items/${itemId}/archive`), "Diarsipkan")} />
            ) : (
              <ActionChip testid="unarchive-button" icon={<ArchiveRestore size={13} />} label="Kembalikan"
                onClick={() => run(() => api.post(`/work-items/${itemId}/unarchive`), "Dikembalikan")} />
            )}
            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#091E420F] text-xs font-semibold cursor-pointer" data-testid="needs-approval-toggle">
              <input
                type="checkbox"
                checked={!!item.needs_approval}
                onChange={(e) => saveField("needs_approval", e.target.checked)}
                className="w-3.5 h-3.5 accent-[#0C66E4]"
              />
              Butuh approval
            </label>
            {isAdmin && (
              <ActionChip testid="delete-item-button" icon={<Trash2 size={13} />} label="Hapus" color="red"
                onClick={() => {
                  if (window.confirm("Hapus pekerjaan ini secara permanen?")) {
                    run(async () => {
                      await api.delete(`/work-items/${itemId}`);
                      onClose();
                    }, "Pekerjaan dihapus");
                  }
                }} />
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-5 gap-0">
          <div className="md:col-span-3 p-6 space-y-6 md:border-r border-[#DFE1E6]">
            <div>
              <SectionTitle icon={<Users size={14} />}>PIC / Penanggung Jawab</SectionTitle>
              <div className="flex flex-wrap items-center gap-2" data-testid="card-pic-list">
                {members.map((m) => (
                  <span key={m.id} className="inline-flex items-center gap-1.5 bg-white border border-[#DFE1E6] rounded-full pl-1 pr-3 py-1" data-testid={`card-pic-${m.id}`}>
                    <Avatar name={m.name} color={m.avatar_color} size="h-6 w-6 text-[10px]" />
                    <span className="text-xs font-semibold text-[#172B4D]">{m.name}</span>
                  </span>
                ))}
                {members.length === 0 && (
                  <span className="text-xs bg-[#E3FCEF] text-[#216E4E] border border-[#22A06B] px-2.5 py-1.5 rounded-full font-semibold" data-testid="card-no-pic-label">
                    Belum ada PIC — terbuka untuk diambil
                  </span>
                )}
                <Popover>
                  <PopoverTrigger asChild>
                    <button data-testid="card-add-member-button" aria-label="Tambah anggota" className="h-7 w-7 rounded-full bg-[#091E420F] hover:bg-[#091E4224] flex items-center justify-center text-[#44546F] transition-colors">
                      <Plus size={14} />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 bg-white shadow-lg max-h-64 overflow-y-auto minimal-scrollbar" align="start">
                    <p className="text-xs font-bold uppercase tracking-wider text-[#8590A2] mb-2">Tugaskan PIC</p>
                    {(users || []).map((u) => (
                      <button
                        key={u.id}
                        data-testid={`assign-user-${u.id}`}
                        onClick={() => toggleMember(u.id)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#F1F2F4] text-left"
                      >
                        <Avatar name={u.name} color={u.avatar_color} size="h-6 w-6 text-[10px]" />
                        <span className="text-sm flex-1">{u.name}</span>
                        {(item.member_ids || []).includes(u.id) && <CheckCircle2 size={14} className="text-[#22A06B]" />}
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div>
              <SectionTitle icon={<Building2 size={14} />}>Divisi yang Di-assign</SectionTitle>
              <div className="flex items-center gap-1.5 flex-wrap">
                {(item.division_names || []).map((d) => (
                  <span key={d.id} className="text-xs font-semibold text-white px-2 py-1 rounded" style={{ backgroundColor: d.color }}>{d.name}</span>
                ))}
                <Popover>
                  <PopoverTrigger asChild>
                    <button data-testid="card-add-division-button" aria-label="Tambah divisi" className="h-7 w-7 rounded-full bg-[#091E420F] hover:bg-[#091E4224] flex items-center justify-center text-[#44546F]">
                      <Plus size={13} />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 bg-white shadow-lg" align="start">
                    <p className="text-xs font-bold uppercase tracking-wider text-[#8590A2] mb-2">Assign ke Divisi</p>
                    {(divisions || []).map((d) => (
                      <button
                        key={d.id}
                        data-testid={`assign-division-${d.id}`}
                        onClick={() => toggleDivision(d.id)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#F1F2F4] text-left"
                      >
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                        <span className="text-sm flex-1">{d.name}</span>
                        {(item.division_ids || []).includes(d.id) && <CheckCircle2 size={14} className="text-[#22A06B]" />}
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div>
              <SectionTitle icon={<Tags size={14} />}>Label</SectionTitle>
              <div className="flex items-center gap-1.5 flex-wrap">
                {(board_labels || []).filter((l) => (item.label_ids || []).includes(l.id)).map((l) => (
                  <span key={l.id} className="text-xs font-semibold text-white px-2 py-1 rounded" style={{ backgroundColor: l.color }}>{l.name}</span>
                ))}
                <Popover>
                  <PopoverTrigger asChild>
                    <button data-testid="card-edit-labels-button" aria-label="Edit label" className="h-7 w-7 rounded-full bg-[#091E420F] hover:bg-[#091E4224] flex items-center justify-center text-[#44546F]">
                      <Plus size={13} />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 bg-white shadow-lg" align="start">
                    <p className="text-xs font-bold uppercase tracking-wider text-[#8590A2] mb-2">Label Board</p>
                    <div className="max-h-48 overflow-y-auto minimal-scrollbar space-y-1">
                      {(board_labels || []).map((l) => (
                        <button key={l.id} data-testid={`toggle-label-${l.id}`} onClick={() => toggleLabel(l.id)} className="w-full flex items-center gap-2">
                          <span className="flex-1 h-7 rounded text-left text-xs font-semibold text-white px-2 flex items-center hover:opacity-85 transition-opacity" style={{ backgroundColor: l.color }}>
                            {l.name}
                          </span>
                          {(item.label_ids || []).includes(l.id) && <CheckCircle2 size={14} className="text-[#22A06B]" />}
                        </button>
                      ))}
                    </div>
                    <div className="border-t mt-3 pt-3">
                      <p className="text-xs font-bold uppercase tracking-wider text-[#8590A2] mb-2">Label Baru</p>
                      <input
                        data-testid="new-label-name-input"
                        value={newLabelName}
                        onChange={(e) => setNewLabelName(e.target.value)}
                        placeholder="Nama label"
                        className="w-full h-8 rounded border border-[#DFE1E6] px-2 text-sm outline-none focus:ring-2 focus:ring-[#0C66E4]"
                      />
                      <div className="flex flex-wrap gap-1 mt-2">
                        {LABEL_COLORS.map((c) => (
                          <button key={c} aria-label={`Warna ${c}`} data-testid={`label-color-${c.replace("#", "")}`} onClick={() => setNewLabelColor(c)}
                            className={`w-6 h-6 rounded ${newLabelColor === c ? "ring-2 ring-offset-1 ring-[#172B4D]" : ""}`} style={{ backgroundColor: c }} />
                        ))}
                      </div>
                      <button
                        data-testid="create-label-button"
                        onClick={() => {
                          if (!newLabelName.trim()) return;
                          run(async () => {
                            const r = await api.post(`/boards/${item.board_id}/labels`, { name: newLabelName.trim(), color: newLabelColor });
                            await api.patch(`/work-items/${itemId}`, { label_ids: [...(item.label_ids || []), r.data.id] });
                          }, "Label dibuat");
                          setNewLabelName("");
                        }}
                        className="mt-2 w-full h-8 rounded bg-[#0c66e4] hover:bg-[#0052cc] text-white text-sm font-semibold transition-colors"
                      >
                        Buat Label
                      </button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              <div>
                <SectionTitle icon={<Clock size={14} />}>Tenggat</SectionTitle>
                <input
                  data-testid="card-due-date-input"
                  type="date"
                  value={item.due_date || ""}
                  onChange={(e) => saveField("due_date", e.target.value || null)}
                  className="h-9 rounded-lg border border-[#DFE1E6] px-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[#0C66E4]"
                />
              </div>
              <div>
                <SectionTitle icon={<Flag size={14} />}>Prioritas</SectionTitle>
                <select
                  data-testid="card-priority-select"
                  value={item.priority || "none"}
                  onChange={(e) => saveField("priority", e.target.value)}
                  className="h-9 rounded-lg border border-[#DFE1E6] px-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[#0C66E4]"
                >
                  {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <SectionTitle icon={<Building2 size={14} />}>Nama Klien</SectionTitle>
                <input
                  data-testid="card-client-input"
                  key={"c" + item.id}
                  defaultValue={item.client_name || ""}
                  onBlur={(e) => e.target.value !== item.client_name && saveField("client_name", e.target.value.trim())}
                  placeholder="mis: PT ABC"
                  className="h-9 rounded-lg border border-[#DFE1E6] px-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[#0C66E4]"
                />
              </div>
            </div>

            <div>
              <SectionTitle icon={<AlignLeft size={14} />}>Deskripsi</SectionTitle>
              <textarea
                data-testid="card-description-input"
                key={"d" + item.id}
                defaultValue={item.description || ""}
                onBlur={(e) => e.target.value !== item.description && saveField("description", e.target.value)}
                placeholder="Tambahkan deskripsi yang lebih detail..."
                rows={4}
                className="w-full rounded-lg border border-[#DFE1E6] bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-[#0C66E4] resize-y"
              />
            </div>

            <div>
              <SectionTitle icon={<CheckSquare size={14} />}>Checklist {clTotal > 0 && `· ${progress}%`}</SectionTitle>
              {clTotal > 0 && (
                <div className="h-2 rounded-full bg-[#DFE1E6] mb-3 overflow-hidden" data-testid="checklist-progress-bar">
                  <div className={`h-full rounded-full transition-all ${progress === 100 ? "bg-[#22A06B]" : "bg-[#0C66E4]"}`} style={{ width: `${progress}%` }} />
                </div>
              )}
              {(item.checklists || []).map((cl) => (
                <div key={cl.id} className="mb-4" data-testid={`checklist-${cl.id}`}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold">{cl.title}</p>
                    <button data-testid={`delete-checklist-${cl.id}`} onClick={() => run(() => api.delete(`/work-items/${itemId}/checklists/${cl.id}`))} className="text-xs text-[#CA3521] hover:underline">
                      Hapus
                    </button>
                  </div>
                  {cl.items.map((sub) => (
                    <div key={sub.id} className="flex items-center gap-2 py-1 group" data-testid={`checklist-item-${sub.id}`}>
                      <input
                        type="checkbox"
                        data-testid={`checklist-toggle-${sub.id}`}
                        checked={sub.done}
                        onChange={(e) => run(() => api.patch(`/work-items/${itemId}/checklists/${cl.id}/items/${sub.id}`, { done: e.target.checked }))}
                        className="w-4 h-4 accent-[#0C66E4] cursor-pointer"
                      />
                      <span className={`text-sm flex-1 ${sub.done ? "line-through text-[#8590A2]" : ""}`}>{sub.text}</span>
                      <button aria-label="Hapus item" data-testid={`checklist-item-delete-${sub.id}`}
                        onClick={() => run(() => api.delete(`/work-items/${itemId}/checklists/${cl.id}/items/${sub.id}`))}
                        className="opacity-0 group-hover:opacity-100 text-[#CA3521] p-0.5">
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                  <AddChecklistItem testid={cl.id} onAdd={(text) => run(() => api.post(`/work-items/${itemId}/checklists/${cl.id}/items`, { text }))} />
                </div>
              ))}
              {addingChecklist ? (
                <div className="flex items-center gap-2 mt-2">
                  <input
                    data-testid="new-checklist-title-input"
                    autoFocus
                    value={newChecklistTitle}
                    onChange={(e) => setNewChecklistTitle(e.target.value)}
                    placeholder="Judul checklist"
                    className="h-9 flex-1 rounded-lg border border-[#DFE1E6] px-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[#0C66E4]"
                  />
                  <button
                    data-testid="create-checklist-button"
                    onClick={() => {
                      if (!newChecklistTitle.trim()) return;
                      run(() => api.post(`/work-items/${itemId}/checklists`, { title: newChecklistTitle.trim() }), "Checklist dibuat");
                      setNewChecklistTitle("");
                      setAddingChecklist(false);
                    }}
                    className="h-9 px-3 rounded-lg bg-[#0c66e4] text-white text-sm font-semibold"
                  >
                    Tambah
                  </button>
                  <button aria-label="Batal" onClick={() => setAddingChecklist(false)} className="p-1.5 text-[#44546F]"><X size={16} /></button>
                </div>
              ) : (
                <button data-testid="add-checklist-button" onClick={() => setAddingChecklist(true)} className="text-sm text-[#0C66E4] hover:underline font-medium">
                  + Tambah checklist
                </button>
              )}
            </div>

            <div>
              <SectionTitle icon={<Paperclip size={14} />}>Lampiran</SectionTitle>
              <div className="space-y-2">
                {(attachments || []).map((a) => (
                  <div key={a.id} className="flex items-center gap-3 bg-white rounded-lg border border-[#DFE1E6] px-3 py-2" data-testid={`attachment-${a.id}`}>
                    <Paperclip size={14} className="text-[#44546F] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{a.original_filename}</p>
                      <p className="text-[11px] text-[#8590A2]">{a.uploaded_by_name} · {(a.size / 1024).toFixed(0)} KB · {fmtDateTime(a.created_at)}</p>
                    </div>
                    <a data-testid={`attachment-download-${a.id}`} href={`${API}/attachments/${a.id}/download`} target="_blank" rel="noreferrer"
                      className="p-1.5 rounded hover:bg-[#F1F2F4] text-[#0C66E4]" aria-label="Unduh">
                      <Download size={15} />
                    </a>
                    {(a.uploaded_by === user?.id || isAdmin) && (
                      <button aria-label="Hapus lampiran" data-testid={`attachment-delete-${a.id}`} onClick={() => run(() => api.delete(`/attachments/${a.id}`))} className="p-1.5 rounded hover:bg-[#FFECE8] text-[#CA3521]">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                ))}
                <label
                  data-testid="attachment-upload-label"
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#091E420F] hover:bg-[#091E4224] text-sm font-medium cursor-pointer transition-colors ${uploading ? "opacity-50 pointer-events-none" : ""}`}
                >
                  <Paperclip size={14} /> {uploading ? "Mengunggah..." : "Unggah lampiran"}
                  <input data-testid="attachment-upload-input" type="file" className="hidden" onChange={uploadFile} disabled={uploading} />
                </label>
              </div>
            </div>
          </div>

          <div className="md:col-span-2 p-6 bg-white/60 md:rounded-r-xl flex flex-col" data-testid="card-activity-rail">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-[#44546F]">
                <MessageSquare size={14} />
                <h3 className="text-xs font-bold uppercase tracking-wider">Komentar & Aktivitas</h3>
              </div>
              <label className="flex items-center gap-1.5 text-[11px] text-[#44546F] cursor-pointer">
                <input
                  type="checkbox"
                  data-testid="toggle-activity-details"
                  checked={showActivityDetail}
                  onChange={(e) => setShowActivityDetail(e.target.checked)}
                  className="w-3.5 h-3.5 accent-[#0C66E4]"
                />
                Detail aktivitas
              </label>
            </div>
            <div className="flex gap-2 mb-4">
              <Avatar name={user?.name} color={user?.avatar_color} size="h-8 w-8 text-xs" />
              <div className="flex-1">
                <textarea
                  data-testid="comment-input"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Tulis komentar... gunakan @nama untuk mention"
                  rows={2}
                  className="w-full rounded-lg border border-[#DFE1E6] bg-white p-2.5 text-sm outline-none focus:ring-2 focus:ring-[#0C66E4] resize-none"
                />
                <button
                  data-testid="comment-submit-button"
                  disabled={!comment.trim()}
                  onClick={() => {
                    run(() => api.post(`/work-items/${itemId}/comments`, { text: comment }), "Komentar ditambahkan");
                    setComment("");
                  }}
                  className="mt-1.5 h-8 px-3 rounded bg-[#0c66e4] hover:bg-[#0052cc] text-white text-sm font-semibold disabled:opacity-40 transition-colors active:scale-95"
                >
                  Kirim
                </button>
              </div>
            </div>
            <div className="space-y-3 flex-1 overflow-y-auto minimal-scrollbar max-h-[520px]" data-testid="card-feed">
              {feed.length === 0 && <p className="text-sm text-[#8590A2]">Belum ada komentar atau aktivitas.</p>}
              {feed.map((entry) =>
                entry.kind === "comment" ? (
                  <div key={"c" + entry.data.id} className="flex gap-2" data-testid={`comment-${entry.data.id}`}>
                    <Avatar name={entry.data.user_name} color={entry.data.avatar_color} size="h-7 w-7 text-[10px]" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-[#44546F]">
                        <span className="font-semibold text-[#172B4D]">{entry.data.user_name}</span> · {fmtDateTime(entry.data.created_at)}
                      </p>
                      <div className="bg-white rounded-lg border border-[#DFE1E6] px-3 py-2 mt-1 text-sm leading-relaxed break-words">
                        {renderCommentText(entry.data.text)}
                      </div>
                    </div>
                    {(entry.data.user_id === user?.id || isAdmin) && (
                      <button aria-label="Hapus komentar" data-testid={`comment-delete-${entry.data.id}`} onClick={() => run(() => api.delete(`/comments/${entry.data.id}`))} className="self-start p-1 text-[#CA3521] opacity-60 hover:opacity-100">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                ) : (
                  <div key={"a" + entry.data.id} className="flex gap-2 items-start" data-testid={`activity-${entry.data.id}`}>
                    <div className="w-6 h-6 rounded-full bg-[#091E420F] flex items-center justify-center shrink-0 mt-0.5">
                      <Activity size={11} className="text-[#44546F]" />
                    </div>
                    <p className="text-xs text-[#44546F]">
                      <span className="font-semibold text-[#172B4D]">{entry.data.user_name}</span> {entry.data.action}
                      <span className="block text-[10px] text-[#8590A2]">{fmtDateTime(entry.data.created_at)}</span>
                    </p>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddChecklistItem({ onAdd, testid }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  if (!open)
    return (
      <button data-testid={`add-checklist-item-open-${testid}`} onClick={() => setOpen(true)} className="text-xs text-[#0C66E4] hover:underline mt-1">
        + Tambah item
      </button>
    );
  return (
    <div className="flex items-center gap-2 mt-1">
      <input
        data-testid={`add-checklist-item-input-${testid}`}
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && text.trim()) { onAdd(text.trim()); setText(""); setOpen(false); }
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder="Item checklist"
        className="h-8 flex-1 rounded border border-[#DFE1E6] px-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[#0C66E4]"
      />
      <button
        data-testid={`add-checklist-item-submit-${testid}`}
        onClick={() => { if (text.trim()) { onAdd(text.trim()); setText(""); setOpen(false); } }}
        className="h-8 px-2.5 rounded bg-[#0c66e4] text-white text-xs font-semibold"
      >
        Tambah
      </button>
    </div>
  );
}
