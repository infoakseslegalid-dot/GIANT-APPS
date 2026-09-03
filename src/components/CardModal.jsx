import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  X, AlignLeft, Tags, Clock, Users, Building2, CheckSquare, Paperclip,
  MessageSquare, Hand, CheckCircle2, Archive, ArchiveRestore, Trash2, Flag, Send, Plus, Download, Activity,
  Eye, Copy, ChevronUp, ChevronDown, ArrowRightToLine, Link as LinkIcon, Image as ImageIcon, Pencil, CalendarPlus, ArrowRight, Tag,
  Circle, CircleCheck, MoreHorizontal, Zap, Bot, UserPlus, Share2, LayoutTemplate, Frame, SquareCheck, Smile,
  Type, Bold, Italic, List, FileText, ExternalLink,
} from "lucide-react";
import { api, errMsg, PRIORITIES, fmtDateTime, fmtDate, LABEL_COLORS, API } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Avatar } from "./common";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "./ui/dropdown-menu";
import SendWorkDialog from "./SendWorkDialog";

const EMOJIS = ["👍", "❤️", "😂", "✅"];

function SectionTitle({ icon, children }) {
  return (
    <div className="flex items-center gap-2 text-[#44546F] mb-2">
      {icon}
      <h3 className="text-xs font-bold uppercase tracking-wider">{children}</h3>
    </div>
  );
}

function ActionChip({ icon, label, onClick, testid, color = "default", disabled, active }) {
  const styles = {
    default: active ? "bg-[#0C66E4] text-white" : "bg-[#091E420F] hover:bg-[#091E4224] text-[#172B4D]",
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
  const [composing, setComposing] = useState(false);
  const [showActivityDetail, setShowActivityDetail] = useState(true);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState(LABEL_COLORS[0]);
  const [newChecklistTitle, setNewChecklistTitle] = useState("");
  const [addingChecklist, setAddingChecklist] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState(null);
  const [editingComment, setEditingComment] = useState(null);
  const [editingDesc, setEditingDesc] = useState(false);
  const [desc, setDesc] = useState("");
  const [editText, setEditText] = useState("");
  const [cfName, setCfName] = useState("");
  const [cfValue, setCfValue] = useState("");
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkName, setLinkName] = useState("");
  // ── Baru ────────────────────────────────────────────────────────────────
  const [commentFiles, setCommentFiles] = useState([]); // { file, preview?, name }
  const [replyTo, setReplyTo] = useState(null);         // { id, name }
  const [activeTab, setActiveTab] = useState("comments"); // comments | powerups | automations
  const [uploadingComment, setUploadingComment] = useState(false);
  const commentFileRef = useRef(null);

  useEffect(() => {
    const h = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const { data, refetch } = useQuery({
    queryKey: ["work-item", itemId],
    queryFn: () => api.get(`/work-items/${itemId}`).then((r) => r.data),
  });
  const { data: users } = useQuery({ queryKey: ["users"], queryFn: () => api.get("/users").then((r) => r.data) });
  const { data: divisions } = useQuery({ queryKey: ["divisions"], queryFn: () => api.get("/divisions").then((r) => r.data) });

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
    qc.invalidateQueries({ queryKey: ["calendar"] });
  };
  const run = async (fn, successMsg) => {
    try {
      const r = await fn();
      if (r?.data?.warning) toast.warning(r.data.warning);
      if (successMsg) toast.success(successMsg);
      invalidate();
      return r;
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const isSupervisorUp = ["super_admin", "admin", "supervisor"].includes(user?.role);
  const isAdmin = ["super_admin", "admin"].includes(user?.role);
  const isMember = (item.member_ids || []).includes(user?.id);
  const isWatching = (item.watcher_ids || []).includes(user?.id);
  const clTotal = (item.checklists || []).reduce((a, c) => a + c.items.length, 0);
  const clDone = (item.checklists || []).reduce((a, c) => a + c.items.filter((i) => i.done).length, 0);
  const progress = clTotal ? Math.round((clDone / clTotal) * 100) : 0;
  const usersById = Object.fromEntries((users || []).map((u) => [u.id, u]));
  const members = (item.member_ids || []).map((id) => usersById[id]).filter(Boolean);
  const attachmentsById = Object.fromEntries((attachments || []).map((a) => [a.id, a]));

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

  const uploadFile = async (e, forComment = false) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fd = new FormData();
        fd.append("file", file);
        const r = await api.post(`/work-items/${itemId}/attachments`, fd, { headers: { "Content-Type": "multipart/form-data" } });
        
        if (forComment && i === files.length - 1) {
          setPendingAttachment(r.data);
          toast.success(`"${file.name}" siap dilampirkan ke komentar`);
        }
      }
      if (!forComment) {
        toast.success(`${files.length} Lampiran diunggah`);
      }
      invalidate();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/board/${item.board_id}?card=${item.id}`);
    toast.success("Link kartu disalin");
  };

  const addCustomField = () => {
    if (!cfName.trim()) return;
    const cfs = [...(item.custom_fields || []), { id: Date.now().toString(36), name: cfName.trim(), value: cfValue.trim() }];
    run(() => api.patch(`/work-items/${itemId}`, { custom_fields: cfs }));
    setCfName("");
    setCfValue("");
  };

  const removeCustomField = (id) => {
    const cfs = (item.custom_fields || []).filter((f) => f.id !== id);
    run(() => api.patch(`/work-items/${itemId}`, { custom_fields: cfs }));
  };

  const reorderItem = (cl, subId, dir) => {
    const ids = cl.items.map((i) => i.id);
    const idx = ids.indexOf(subId);
    const swap = idx + dir;
    if (swap < 0 || swap >= ids.length) return;
    [ids[idx], ids[swap]] = [ids[swap], ids[idx]];
    run(() => api.post(`/work-items/${itemId}/checklists/${cl.id}/reorder`, { ordered_ids: ids }));
  };

  // ── Tipe file yang diizinkan di comment ─────────────────────────────────
  const OFFICE_ACCEPT = [
    ".pdf",".doc",".docx",".xls",".xlsx",".ppt",".pptx",
    ".odt",".ods",".odp",".txt",".csv",".rtf",".zip",".rar",
  ].join(",");
  const IMAGE_ACCEPT = "image/*";
  const MAX_FILES = 10;

  // ── Tambah file ke antrian comment upload ────────────────────────────────
  const addCommentFiles = (fileList) => {
    const arr = Array.from(fileList);
    setCommentFiles((prev) => {
      const merged = [...prev, ...arr.map((f) => ({
        file: f,
        name: f.name,
        preview: f.type.startsWith("image/") ? URL.createObjectURL(f) : null,
        ext: f.name.split(".").pop()?.toUpperCase() || "FILE",
      }))];
      if (merged.length > MAX_FILES) {
        toast.warning(`Maksimal ${MAX_FILES} file — ${merged.length - MAX_FILES} file diabaikan`);
        return merged.slice(0, MAX_FILES);
      }
      return merged;
    });
    // Reset input supaya file sama bisa dipilih ulang
    if (commentFileRef.current) commentFileRef.current.value = "";
  };

  // ── Hapus file dari antrian ──────────────────────────────────────────────
  const removeCommentFile = (idx) => {
    setCommentFiles((prev) => {
      const copy = [...prev];
      if (copy[idx]?.preview) URL.revokeObjectURL(copy[idx].preview);
      copy.splice(idx, 1);
      return copy;
    });
  };

  // ── Kirim komentar + file ────────────────────────────────────────────────
  const submitComment = async () => {
    if (!comment.trim() && commentFiles.length === 0) return;
    setUploadingComment(true);
    try {
      // Upload semua file dulu, kumpulkan ID attachment
      const attachmentIds = [];
      for (const cf of commentFiles) {
        const fd = new FormData();
        fd.append("file", cf.file);
        const r = await api.post(`/work-items/${itemId}/attachments`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        attachmentIds.push(r.data.id);
      }
      // Kirim komentar; backend menerima attachment_ids (array)
      await run(
        () => api.post(`/work-items/${itemId}/comments`, {
          text: comment,
          reply_to_id: replyTo?.id || null,
          attachment_ids: attachmentIds,
        }),
        "Komentar dikirim"
      );
      setComment("");
      setCommentFiles([]);
      setReplyTo(null);
      setComposing(false);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setUploadingComment(false);
    }
  };

  // ── Toggle watch ────────────────────────────────────────────────────────
  const toggleWatch = () =>
    run(
      () => api.post(`/work-items/${itemId}/${isWatching ? "unwatch" : "watch"}`),
      isWatching ? "Berhenti memantau" : "Memantau kartu ini"
    );

  // ── Add link as attachment ───────────────────────────────────────────────
  const addLinkAsAttachment = (url) =>
    run(
      () => api.post(`/work-items/${itemId}/attachments`, { url }),
      "Link ditambahkan sebagai lampiran"
    );

  const renderCommentText = (text) =>
    text.split(/(@[\w\.]+)/g).map((part, i) =>
      part.startsWith("@") ? (
        <span key={i} className="text-[#0C66E4] font-semibold bg-[#E9F2FF] rounded px-0.5">{part}</span>
      ) : (
        <span key={i}>{part}</span>
      )
    );

  const cardLabels = (board_labels || []).filter((l) => (item.label_ids || []).includes(l.id));
  const feed = [
    ...(comments || []).map((c) => ({ kind: "comment", at: c.created_at, data: c })),
    ...(showActivityDetail ? (activities || []).map((a) => ({ kind: "activity", at: a.created_at, data: a })) : []),
  ].sort((a, b) => (a.at < b.at ? 1 : -1)); // terbaru di atas

  const isDone = item.status === "done";

  /* Kelas gaya — mengikuti CardBack.reference.tsx / contoh layout.jpeg (palet slate) */
  const pill =
    "flex h-8 items-center gap-1.5 rounded bg-slate-100 px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200 disabled:opacity-50";
  const iconBtn =
    "flex h-8 w-8 items-center justify-center rounded text-slate-600 transition-colors hover:bg-slate-200";
  const menuItemCls =
    "flex h-9 w-full cursor-pointer select-none items-center gap-3 rounded px-2 text-sm text-slate-700 outline-none hover:bg-slate-100 focus:bg-slate-100";
  const sectionEditBtn =
    "h-8 rounded bg-slate-100 px-3 text-sm font-medium text-slate-700 hover:bg-slate-200";

  const initials = (name) =>
    (name || "?").split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  return (
    /* Overlay */
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:p-8 max-sm:p-0 fade-enter"
      onClick={onClose}
      data-testid="card-modal-overlay"
    >
      {/* Modal shell */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="card-modal-title"
        onClick={(e) => e.stopPropagation()}
        data-testid="card-modal-content"
        className="flex max-h-[90vh] w-[900px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-lg bg-white text-[#172b4d] shadow-2xl max-sm:h-full max-sm:max-h-full max-sm:w-full max-sm:max-w-full max-sm:rounded-none"
      >
        {/* Cover */}
        {item.cover_attachment_id && attachmentsById[item.cover_attachment_id] ? (
          <div
            className="h-40 w-full shrink-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${API}/attachments/${item.cover_attachment_id}/download)` }}
          />
        ) : item.cover_color ? (
          <div className="h-28 w-full shrink-0" style={{ backgroundColor: item.cover_color }} />
        ) : null}

        {/* ── HEADER ──────────────────────────────────────────────────── */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-2">
          <button
            type="button"
            className="flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-[12px] font-semibold uppercase tracking-wide text-slate-700 hover:bg-slate-200"
          >
            {list_name}
            {item.hari_stage ? ` · HARI ${item.hari_stage}` : ""}
            <ChevronDown size={12} />
          </button>

          <div className="flex items-center gap-1">
            <label title="Sampul" className={`${iconBtn} cursor-pointer ${uploading ? "opacity-50" : ""}`}>
              <ImageIcon size={16} />
              <input type="file" accept="image/*" className="hidden" onChange={uploadFile} disabled={uploading} />
            </label>

            <button
              type="button"
              onClick={toggleWatch}
              title={isWatching ? "Berhenti memantau kartu ini" : "Watch — aktifkan notifikasi"}
              className={`flex h-8 w-8 items-center justify-center rounded transition-colors hover:bg-slate-200 ${isWatching ? "text-blue-600" : "text-slate-600"}`}
            >
              <Eye size={16} />
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" aria-label="More" className={iconBtn}><MoreHorizontal size={16} /></button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={4} className="w-[240px] p-2">
                {!isMember && !isDone && (
                  <DropdownMenuItem className={menuItemCls} onSelect={() => run(() => api.post(`/work-items/${itemId}/claim`), "Anda menjadi PIC")}>
                    <Hand size={16} className="text-slate-600" /> Ambil Pekerjaan
                  </DropdownMenuItem>
                )}
                {isMember && !isDone && (
                  <DropdownMenuItem
                    className={menuItemCls}
                    onSelect={() => {
                      const reason = window.prompt("Alasan melepas pekerjaan (opsional):") || "";
                      run(() => api.post(`/work-items/${itemId}/release`, { reason }), "Dilepas");
                    }}
                  >
                    <X size={16} className="text-slate-600" /> Lepaskan
                  </DropdownMenuItem>
                )}
                {item.status === "active" && (
                  <DropdownMenuItem className={menuItemCls} onSelect={() => run(() => api.post(`/work-items/${itemId}/submit`), "Selesai")}>
                    <Send size={16} className="text-slate-600" /> Tandai Selesai
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem className={menuItemCls} onSelect={() => toggleMember(user?.id)}>
                  <UserPlus size={16} className="text-slate-600" /> Join
                </DropdownMenuItem>
                <DropdownMenuItem className={menuItemCls} onSelect={() => setShowSend(true)}>
                  <ArrowRight size={16} className="text-slate-600" /> Move
                </DropdownMenuItem>
                <DropdownMenuItem className={menuItemCls} onSelect={copyLink}>
                  <Copy size={16} className="text-slate-600" /> Copy
                </DropdownMenuItem>
                <DropdownMenuItem className={menuItemCls} onSelect={() => toast.info("Belum tersedia")}>
                  <SquareCheck size={16} className="text-slate-600" /> Create Jira work item
                </DropdownMenuItem>
                <DropdownMenuItem className={menuItemCls} onSelect={() => toast.info("Belum tersedia")}>
                  <Frame size={16} className="text-slate-600" /> Mirror
                </DropdownMenuItem>
                <DropdownMenuItem className={menuItemCls} onSelect={() => toast.info("Belum tersedia")}>
                  <LayoutTemplate size={16} className="text-slate-600" /> Make template
                </DropdownMenuItem>
                <DropdownMenuItem className={`${menuItemCls} justify-between`} onSelect={(e) => e.preventDefault()}>
                  <span className="flex items-center gap-3"><Eye size={16} className="text-slate-600" /> Watch</span>
                  {isWatching && <CheckCircle2 size={16} className="text-green-600" />}
                </DropdownMenuItem>
                <DropdownMenuSeparator className="my-1 h-px bg-slate-200" />
                <DropdownMenuItem className={menuItemCls} onSelect={copyLink}>
                  <Share2 size={16} className="text-slate-600" /> Share
                </DropdownMenuItem>
                {!item.archived ? (
                  <DropdownMenuItem className={menuItemCls} onSelect={() => run(() => api.post(`/work-items/${itemId}/archive`), "Diarsipkan")}>
                    <Archive size={16} className="text-slate-600" /> Archive
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem className={menuItemCls} onSelect={() => run(() => api.post(`/work-items/${itemId}/unarchive`), "Dikembalikan")}>
                    <ArchiveRestore size={16} className="text-slate-600" /> Kembalikan ke board
                  </DropdownMenuItem>
                )}
                {isAdmin && (
                  <DropdownMenuItem
                    className={`${menuItemCls} text-red-600 hover:bg-red-50 focus:bg-red-50`}
                    onSelect={() => {
                      if (window.confirm("Hapus pekerjaan ini secara permanen?")) {
                        run(async () => { await api.delete(`/work-items/${itemId}`); onClose(); });
                      }
                    }}
                  >
                    <Trash2 size={16} className="text-red-500" /> Hapus permanen
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <button type="button" onClick={onClose} aria-label="Close" data-testid="card-modal-close" className={`${iconBtn} ml-1`}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── BODY: 2 KOLOM SELALU SEJAJAR ──────────────────────────────── */}
        {/* flex-row tanpa breakpoint — modal fix 768px tidak butuh lg:     */}
        <div className="flex flex-1 flex-row overflow-hidden">
          {/* ═══ KOLOM KIRI — flex-1, scroll sendiri ═══ */}
          <div className="flex-1 overflow-y-auto p-4 minimal-scrollbar border-r border-slate-200">
            {/* Judul */}
            <div className="flex items-start gap-3">
              <button
                type="button"
                aria-label="Tandai selesai"
                title={isDone ? "Selesai" : "Tandai selesai"}
                onClick={() => { if (item.status === "active") run(() => api.post(`/work-items/${itemId}/submit`), "Selesai"); }}
                className="mt-1 shrink-0 text-slate-400 hover:text-slate-600"
              >
                {isDone ? <CircleCheck size={20} className="text-green-600" /> : <Circle size={20} />}
              </button>
              <input
                id="card-modal-title"
                data-testid="card-title-input"
                defaultValue={item.title}
                key={item.id + item.title}
                onBlur={(e) => e.target.value.trim() && e.target.value !== item.title && saveField("title", e.target.value.trim())}
                onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
                className="min-w-0 flex-1 rounded border-2 border-transparent bg-transparent px-1 text-xl font-semibold leading-tight text-slate-900 outline-none focus:border-blue-600 focus:bg-white"
              />
            </div>

            {/* Quick actions */}
            <div className="mt-4 flex flex-wrap gap-2 pl-8">
              <Popover>
                <PopoverTrigger asChild><button type="button" className={pill}><Plus size={16} /> Add</button></PopoverTrigger>
                <PopoverContent align="start" className="w-[200px] p-2">
                  <button onClick={() => run(() => api.post(`/work-items/${itemId}/checklists`, { title: "Checklist" }))} className="flex h-9 w-full items-center gap-3 rounded px-2 text-left text-sm hover:bg-slate-100">
                    <CheckSquare size={16} className="text-slate-600" /> Daftar periksa
                  </button>
                  <label className="flex h-9 w-full cursor-pointer items-center gap-3 rounded px-2 text-left text-sm hover:bg-slate-100">
                    <Paperclip size={16} className="text-slate-600" />
                    {uploading ? "Mengunggah..." : "Lampiran"}
                    <input type="file" multiple className="hidden" onChange={uploadFile} disabled={uploading} />
                  </label>
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild><button type="button" className={pill}><Clock size={16} /> Dates</button></PopoverTrigger>
                <PopoverContent align="start" className="w-[240px] p-3">
                  <p className="mb-2 text-sm font-semibold text-slate-700">Tenggat</p>
                  <input
                    type="date"
                    defaultValue={item.due_date ? String(item.due_date).slice(0, 10) : ""}
                    onChange={(e) => saveField("due_date", e.target.value || null)}
                    className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </PopoverContent>
              </Popover>

              <button type="button" className={pill} onClick={() => run(() => api.post(`/work-items/${itemId}/checklists`, { title: "Checklist" }))}>
                <SquareCheck size={16} /> Checklist
              </button>

              <Popover>
                <PopoverTrigger asChild><button type="button" className={pill}><Users size={16} /> Members</button></PopoverTrigger>
                <PopoverContent align="start" className="w-[240px] p-2">
                  <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Anggota</p>
                  <div className="max-h-[240px] overflow-y-auto">
                    {(users || []).map((u) => {
                      const on = (item.member_ids || []).includes(u.id);
                      return (
                        <button key={u.id} onClick={() => toggleMember(u.id)} className="flex w-full items-center gap-2 rounded p-1.5 text-left hover:bg-slate-100">
                          <Avatar name={u.name} color={u.avatar_color} size="h-7 w-7 text-xs" />
                          <span className="flex-1 truncate text-sm text-slate-700">{u.name}</span>
                          {on && <CheckCircle2 size={16} className="text-blue-600" />}
                        </button>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Aksi utama GIANT-APPS (menonjol) */}
            {((!isMember && !isDone) || item.status === "active" || (isMember && !isDone)) && (
              <div className="mt-3 flex flex-wrap gap-2 pl-8">
                {!isMember && !isDone && (
                  <button onClick={() => run(() => api.post(`/work-items/${itemId}/claim`), "Anda menjadi PIC")} className="flex h-8 items-center gap-1.5 rounded bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700">
                    <Hand size={15} /> Ambil Pekerjaan
                  </button>
                )}
                {item.status === "active" && (
                  <button onClick={() => run(() => api.post(`/work-items/${itemId}/submit`), "Selesai")} className="flex h-8 items-center gap-1.5 rounded bg-emerald-600 px-3 text-sm font-semibold text-white hover:bg-emerald-700">
                    <Send size={15} /> Tandai Selesai
                  </button>
                )}
                {isMember && !isDone && (
                  <button
                    onClick={() => {
                      const reason = window.prompt("Alasan melepas pekerjaan (opsional):") || "";
                      run(() => api.post(`/work-items/${itemId}/release`, { reason }), "Dilepas");
                    }}
                    className={pill}
                  >
                    <X size={15} /> Lepaskan
                  </button>
                )}
              </div>
            )}

            {/* Labels */}
            <div className="mt-6 pl-8">
              <div className="mb-1 text-xs font-semibold text-slate-500">Labels</div>
              <div className="flex flex-wrap gap-2">
                {cardLabels.map((l) => (
                  <span key={l.id} className="flex h-8 items-center rounded px-3 text-sm font-semibold text-white" style={{ backgroundColor: l.color }}>
                    {l.name}
                  </span>
                ))}
                <Popover>
                  <PopoverTrigger asChild>
                    <button type="button" aria-label="Kelola label" className="flex h-8 w-8 items-center justify-center rounded bg-slate-100 text-slate-600 hover:bg-slate-200">
                      <Plus size={16} />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-[240px] p-2">
                    <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Labels</p>
                    {(board_labels || []).map((l) => {
                      const on = (item.label_ids || []).includes(l.id);
                      return (
                        <button key={l.id} onClick={() => toggleLabel(l.id)} className="mb-1 flex w-full items-center gap-2 rounded p-1 text-left hover:bg-slate-100">
                          <span className="h-8 flex-1 rounded px-3 text-sm font-semibold leading-8 text-white" style={{ backgroundColor: l.color }}>{l.name}</span>
                          {on && <CheckCircle2 size={16} className="text-blue-600" />}
                        </button>
                      );
                    })}
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Dates */}
            {item.due_date && (
              <div className="mt-4 pl-8">
                <div className="mb-1 text-xs font-semibold text-slate-500">Dates</div>
                <span className="flex h-8 w-fit items-center gap-1.5 rounded bg-slate-100 px-3 text-sm font-medium text-slate-700">
                  {fmtDate(item.due_date)}
                  <ChevronDown size={12} />
                </span>
              </div>
            )}

            {/* Description */}
            <div className="mt-6">
              <div className="flex items-center gap-3">
                <AlignLeft size={20} className="shrink-0 text-slate-600" />
                <h3 className="flex-1 font-semibold text-slate-900">Description</h3>
                {item.description && !editingDesc && (
                  <button onClick={() => { setDesc(item.description); setEditingDesc(true); }} className={sectionEditBtn}>Edit</button>
                )}
              </div>
              <div className="mt-2 pl-8">
                {editingDesc ? (
                  <div>
                    <textarea
                      autoFocus
                      value={desc}
                      onChange={(e) => setDesc(e.target.value)}
                      placeholder="Tambahkan deskripsi yang lebih detail..."
                      className="min-h-[140px] w-full resize-y rounded border-2 border-blue-600 p-2 text-sm outline-none"
                    />
                    <div className="mt-2 flex gap-2">
                      <button onClick={() => { saveField("description", desc.trim()); setEditingDesc(false); }} className="h-8 rounded bg-blue-700 px-3 text-sm font-medium text-white hover:bg-blue-800">Save</button>
                      <button onClick={() => setEditingDesc(false)} className="h-8 rounded px-3 text-sm text-slate-700 hover:bg-slate-100">Cancel</button>
                    </div>
                  </div>
                ) : item.description ? (
                  <div className="text-sm leading-relaxed text-slate-800 [&_p]:mb-2">
                    {item.description.split("\n").map((l, i) => <p key={i} className="min-h-[1em]">{renderCommentText(l)}</p>)}
                  </div>
                ) : (
                  <button onClick={() => { setDesc(""); setEditingDesc(true); }} className="flex min-h-[56px] w-full items-center rounded bg-slate-100 p-3 text-left text-sm text-slate-500 hover:bg-slate-200">
                    Tambahkan deskripsi yang lebih detail...
                  </button>
                )}
              </div>
            </div>

            {/* Attachments */}
            {attachments.length > 0 && (
              <div className="mt-6">
                <div className="flex items-center gap-3">
                  <Paperclip size={20} className="shrink-0 text-slate-600" />
                  <h3 className="flex-1 font-semibold text-slate-900">Attachments</h3>
                  <label className={`${sectionEditBtn} cursor-pointer leading-8`}>
                    Add
                    <input type="file" multiple className="hidden" onChange={uploadFile} disabled={uploading} />
                  </label>
                </div>
                <div className="mt-2 pl-8">
                  <div className="mb-1 text-xs font-semibold text-slate-500">Files</div>
                  <ul className="space-y-1">
                    {attachments.map((a) => {
                      const isImg = a.content_type?.startsWith("image/");
                      return (
                        <li key={a.id} className="flex items-center gap-3 rounded p-1 hover:bg-slate-100">
                          <div className="flex h-10 w-14 shrink-0 items-center justify-center overflow-hidden rounded bg-slate-100 bg-cover bg-center text-[10px] font-semibold text-slate-600" style={isImg ? { backgroundImage: `url(${API}/attachments/${a.id}/download)` } : {}}>
                            {!isImg && (a.original_filename?.split(".").pop()?.toUpperCase() || "FILE")}
                          </div>
                          <div className="min-w-0 flex-1">
                            <a href={a.content_type === "link" ? a.external_url : `${API}/attachments/${a.id}/download`} target="_blank" rel="noreferrer" className="block truncate text-sm font-semibold text-slate-900 hover:underline">
                              {a.original_filename || "File"}
                            </a>
                            <p className="text-xs text-slate-500">{a.size ? `${(a.size / 1024).toFixed(0)} KB` : "Link"} · {a.uploaded_by_name}</p>
                          </div>
                          {isImg && (
                            <button onClick={() => saveField("cover_attachment_id", item.cover_attachment_id === a.id ? null : a.id)} title={item.cover_attachment_id === a.id ? "Hapus cover" : "Jadikan cover"} className="flex h-7 w-7 items-center justify-center rounded text-slate-600 hover:bg-slate-200">
                              <ImageIcon size={15} />
                            </button>
                          )}
                          <button onClick={() => run(() => api.delete(`/attachments/${a.id}`))} title="Hapus lampiran" className="flex h-7 w-7 items-center justify-center rounded text-slate-600 hover:bg-slate-200">
                            <Trash2 size={15} />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            )}

            {/* Checklists */}
            {(item.checklists || []).map((cl) => {
              const total = cl.items.length;
              const done = cl.items.filter((i) => i.done).length;
              const pct = total === 0 ? 0 : Math.round((done / total) * 100);
              return (
                <div key={cl.id} className="mt-6">
                  <div className="flex items-center gap-3">
                    <CheckSquare size={20} className="shrink-0 text-slate-600" />
                    <div className="flex-1 font-semibold text-slate-900">
                      <ChecklistTitle cl={cl} onRename={(t) => run(() => api.patch(`/work-items/${itemId}/checklists/${cl.id}`, { title: t }))} />
                    </div>
                    <button onClick={() => run(() => api.delete(`/work-items/${itemId}/checklists/${cl.id}`))} className={sectionEditBtn}>Hapus</button>
                  </div>
                  <div className="mt-2 pl-8">
                    <div className="mb-3 flex items-center gap-3">
                      <span className="w-8 text-right text-xs text-slate-500">{pct}%</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div className={`h-full ${pct === 100 ? "bg-green-600" : "bg-blue-600"}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div className="space-y-1">
                      {cl.items.map((sub) => (
                        <div key={sub.id} className="group -ml-1 flex items-start gap-2 rounded p-1 hover:bg-slate-100">
                          <input
                            type="checkbox"
                            checked={sub.done}
                            onChange={(e) => run(() => api.patch(`/work-items/${itemId}/checklists/${cl.id}/items/${sub.id}`, { done: e.target.checked }))}
                            className="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded-sm accent-blue-600"
                          />
                          <span className={`flex-1 text-sm ${sub.done ? "text-slate-400 line-through" : "text-slate-800"}`}>{sub.text}</span>
                          <button onClick={() => run(() => api.delete(`/work-items/${itemId}/checklists/${cl.id}/items/${sub.id}`))} className="rounded p-1 text-slate-500 opacity-0 hover:bg-slate-200 group-hover:opacity-100">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <AddChecklistItem testid={cl.id} onAdd={(t) => run(() => api.post(`/work-items/${itemId}/checklists/${cl.id}/items`, { text: t }))} />
                  </div>
                </div>
              );
            })}

            {/* Anggota */}
            {members.length > 0 && (
              <div className="mt-6 pl-8">
                <div className="mb-1 text-xs font-semibold text-slate-500">Anggota</div>
                <div className="flex flex-wrap gap-2">
                  {members.map((m) => (
                    <div key={m.id} title={m.name}><Avatar name={m.name} color={m.avatar_color} size="h-8 w-8 text-xs" /></div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ═══ KOLOM KANAN — w-[380px] shrink-0, scroll sendiri ═══ */}
          <div className="flex w-[380px] shrink-0 flex-col overflow-hidden border-l border-slate-200 bg-white">
            <div className="sticky top-0 z-[1] flex shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-4 py-3">
              <MessageSquare size={18} className="text-slate-600" />
              <h3 className="flex-1 font-semibold text-slate-900">Comments and activity</h3>
              <button onClick={() => setShowActivityDetail(!showActivityDetail)} className="h-8 rounded bg-slate-100 px-3 text-xs font-medium text-slate-700 hover:bg-slate-200">
                {showActivityDetail ? "Hide details" : "Show details"}
              </button>
            </div>

            {/* ── Composer komentar ─────────────────────────────────────── */}
            <div className="shrink-0 px-4 pb-3 pt-3">
              {/* Reply-to indicator */}
              {replyTo && (
                <div className="mb-2 flex items-center gap-2 rounded bg-blue-50 px-3 py-1.5 text-xs text-blue-700">
                  <span className="flex-1 truncate">Membalas <strong>{replyTo.name}</strong></span>
                  <button type="button" onClick={() => setReplyTo(null)} className="text-blue-400 hover:text-blue-700"><X size={12} /></button>
                </div>
              )}

              {!composing ? (
                /* Placeholder bar */
                <div
                  onClick={() => setComposing(true)}
                  className="flex min-h-[40px] cursor-text items-center rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-500 shadow-sm hover:border-slate-400"
                >
                  Write a comment...
                </div>
              ) : (
                <>
                  {/* Input box */}
                  <div className="overflow-hidden rounded-lg border-2 border-blue-600 bg-white shadow-sm">
                    {/* Toolbar */}
                    <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 px-2 py-1.5">
                      <span className="flex h-7 items-center gap-0.5 rounded px-1.5 text-slate-500 text-xs"><Type size={14} /><ChevronDown size={11} /></span>
                      <span className="flex h-7 w-7 items-center justify-center rounded text-slate-500 hover:bg-slate-100 cursor-pointer"><Bold size={14} /></span>
                      <span className="flex h-7 w-7 items-center justify-center rounded text-slate-500 hover:bg-slate-100 cursor-pointer"><Italic size={14} /></span>
                      <span className="mx-1 h-4 w-px bg-slate-200" />
                      <span className="flex h-7 w-7 items-center justify-center rounded text-slate-500 hover:bg-slate-100 cursor-pointer"><List size={14} /></span>
                      <span className="flex h-7 w-7 items-center justify-center rounded text-slate-500 hover:bg-slate-100 cursor-pointer"><LinkIcon size={14} /></span>
                      <span className="flex-1" />
                      {/* Upload Gambar */}
                      <label title={`Upload gambar (maks ${MAX_FILES} file)`} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded text-slate-500 hover:bg-slate-100">
                        <ImageIcon size={14} />
                        <input
                          ref={null}
                          type="file"
                          accept={IMAGE_ACCEPT}
                          multiple
                          className="hidden"
                          onChange={(e) => { addCommentFiles(e.target.files); e.target.value = ""; }}
                        />
                      </label>
                      {/* Upload Dokumen Office */}
                      <label title={`Upload file (PDF, DOCX, XLSX, dll — maks ${MAX_FILES} file)`} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded text-slate-500 hover:bg-slate-100">
                        <Paperclip size={14} />
                        <input
                          ref={commentFileRef}
                          type="file"
                          accept={OFFICE_ACCEPT}
                          multiple
                          className="hidden"
                          onChange={(e) => { addCommentFiles(e.target.files); e.target.value = ""; }}
                        />
                      </label>
                    </div>

                    {/* Textarea */}
                    <textarea
                      autoFocus
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submitComment();
                      }}
                      placeholder="Write a comment... (Ctrl+Enter untuk kirim)"
                      className="min-h-[72px] w-full resize-none px-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400"
                    />

                    {/* Preview file yang akan diupload */}
                    {commentFiles.length > 0 && (
                      <div className="flex flex-wrap gap-2 border-t border-slate-200 px-3 py-2">
                        {commentFiles.map((cf, idx) => (
                          <div key={idx} className="relative group flex items-center gap-1.5 rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-700 max-w-[160px]">
                            {cf.preview ? (
                              <img src={cf.preview} alt={cf.name} className="h-8 w-8 rounded object-cover shrink-0" />
                            ) : (
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-slate-200 text-[9px] font-bold text-slate-600">{cf.ext}</div>
                            )}
                            <span className="truncate flex-1">{cf.name}</span>
                            <button
                              type="button"
                              onClick={() => removeCommentFile(idx)}
                              className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-300 text-slate-600 hover:bg-red-100 hover:text-red-600"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        ))}
                        <span className="self-center text-xs text-slate-400">{commentFiles.length}/{MAX_FILES}</span>
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      disabled={(!comment.trim() && commentFiles.length === 0) || uploadingComment}
                      onClick={submitComment}
                      className="h-8 rounded bg-slate-100 px-4 text-sm font-medium text-slate-500 disabled:cursor-not-allowed enabled:bg-blue-700 enabled:text-white enabled:hover:bg-blue-800 transition-colors"
                    >
                      {uploadingComment ? "Mengirim..." : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setComment(""); setCommentFiles([]); setReplyTo(null); setComposing(false); }}
                      className="h-8 rounded px-3 text-sm text-slate-700 hover:bg-slate-100"
                    >
                      Cancel
                    </button>
                    {commentFiles.length > 0 && (
                      <span className="ml-auto text-xs text-slate-400">{commentFiles.length} file terpilih</span>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Feed */}
            <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-4 minimal-scrollbar">
              {feed.length === 0 && <p className="py-4 text-center text-sm text-slate-400">Belum ada komentar.</p>}
              {feed.map((entry, i) => {
                if (entry.kind === "activity") {
                  const a = entry.data;
                  return (
                    <div key={`a-${a.id || i}`} className="flex gap-2">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                        <Activity size={14} />
                      </div>
                      <p className="min-w-0 flex-1 pt-1 text-xs text-slate-500">
                        <span className="font-semibold text-slate-700">{a.user_name}</span> {a.action}
                        <span className="ml-1 text-slate-400">· {fmtDateTime(entry.at)}</span>
                      </p>
                    </div>
                  );
                }
                const c = entry.data;
                const own = c.created_by_id === user?.id;
                const canDelete = own || isAdmin;
                const bg = usersById[c.created_by_id]?.avatar_color || "#0C66E4";
                const hasLink = /https?:\/\//i.test(c.text || "");
                const att = c.attachment_id ? attachmentsById[c.attachment_id] : null;
                return (
                  <div key={`c-${c.id}`} className="flex gap-2">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white" style={{ backgroundColor: bg }}>
                      {initials(c.created_by_name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="text-sm font-semibold text-slate-900">{c.created_by_name}</span>
                        <span className="text-xs text-blue-700">{fmtDateTime(c.created_at)}</span>
                        {c.updated_at && c.updated_at !== c.created_at && <span className="text-xs italic text-slate-400">(edited)</span>}
                      </div>

                      {editingComment === c.id ? (
                        <div className="mt-1">
                          <textarea
                            autoFocus
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            className="min-h-[72px] w-full resize-none rounded border-2 border-blue-600 p-2 text-sm outline-none"
                          />
                          <div className="mt-1 flex gap-2">
                            <button onClick={() => { run(() => api.patch(`/comments/${c.id}`, { text: editText }), "Komentar diperbarui"); setEditingComment(null); }} className="h-8 rounded bg-blue-700 px-3 text-sm font-medium text-white hover:bg-blue-800">Save</button>
                            <button onClick={() => setEditingComment(null)} className="h-8 rounded px-3 text-sm text-slate-700 hover:bg-slate-100">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="mt-1 whitespace-pre-wrap rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm">
                            {(c.text || "").split("\n").map((l, j) => <p key={j}>{renderCommentText(l)}</p>)}
                          </div>
                          {att && (
                            <a href={`${API}/attachments/${att.id}/download`} target="_blank" rel="noreferrer" className="mt-1 block text-xs font-medium text-blue-600 hover:underline">
                              {att.original_filename || "Lampiran"}
                            </a>
                          )}
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <button type="button" title="Tambah reaksi emoji" onClick={() => toast.info("Emoji reaction belum tersedia")} className="hover:text-slate-700"><Smile size={14} /></button>
                            <button
                              type="button"
                              className="underline hover:text-slate-700"
                              onClick={() => {
                                setReplyTo({ id: c.id, name: c.created_by_name });
                                setComposing(true);
                                // scroll ke composer
                                setTimeout(() => document.querySelector("textarea[placeholder*='comment']")?.focus(), 50);
                              }}
                            >Reply</button>
                            {own && <button type="button" onClick={() => { setEditingComment(c.id); setEditText(c.text || ""); }} className="underline hover:text-slate-700">Edit</button>}
                            {hasLink && (
                              <button
                                type="button"
                                className="underline hover:text-slate-700"
                                onClick={() => {
                                  const url = (c.text || "").match(/https?:\/\/[^\s]+/)?.[0];
                                  if (url) addLinkAsAttachment(url);
                                  else toast.warning("Tidak ditemukan URL dalam komentar");
                                }}
                              >Add link as attachment</button>
                            )}
                            {canDelete && (
                              <button type="button" onClick={() => { if (window.confirm("Hapus komentar ini?")) run(() => api.delete(`/comments/${c.id}`)); }} className="underline hover:text-red-600">Delete</button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── BOTTOM BAR ─────────────────────────────────────────────── */}
        <div className="flex h-12 shrink-0 items-center justify-center gap-6 border-t border-slate-200 bg-white text-sm font-medium transition-colors">
          <button
            type="button"
            onClick={() => setActiveTab("powerups")}
            className={`flex items-center gap-1.5 rounded px-3 py-1.5 ${activeTab === "powerups" ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100"}`}
          >
            <Zap size={16} /> Power-ups
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("automations")}
            className={`flex items-center gap-1.5 rounded px-3 py-1.5 ${activeTab === "automations" ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100"}`}
          >
            <Bot size={16} /> Automations
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("comments")}
            className={`flex items-center gap-1.5 rounded px-3 py-1.5 ${activeTab === "comments" ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100"}`}
          >
            <MessageSquare size={16} /> Comments
          </button>
        </div>
      </div>

      {showSend && (
        <SendWorkDialog item={item} onClose={() => setShowSend(false)} onDone={() => { setShowSend(false); invalidate(); }} />
      )}
    </div>
  );
}

function ChecklistTitle({ cl, onRename }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(cl.title);
  if (!editing)
    return (
      <p className="text-sm font-semibold flex items-center gap-1.5">
        {cl.title}
        <button aria-label="Ubah nama checklist" data-testid={`checklist-rename-${cl.id}`} onClick={() => setEditing(true)} className="text-[#8590A2] hover:text-[#44546F]">
          <Pencil size={11} />
        </button>
      </p>
    );
  return (
    <input
      data-testid={`checklist-rename-input-${cl.id}`}
      autoFocus
      value={title}
      onChange={(e) => setTitle(e.target.value)}
      onBlur={() => { setEditing(false); if (title.trim() && title !== cl.title) onRename(title.trim()); }}
      onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); if (e.key === "Escape") { setTitle(cl.title); setEditing(false); } }}
      className="h-7 rounded border border-[#0C66E4] px-2 text-sm font-semibold outline-none"
    />
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
