import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Database, Plus, Hand, X, Lock, CheckCircle2, Swords, Filter, ChevronDown, ChevronRight } from "lucide-react";
import { api, errMsg, PRIORITIES } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Avatar, StatusBadge, PriorityFlag } from "../components/common";
import CardModal from "../components/kanban/CardModalWrapper";

const abbr = (name) => {
  const m = (name || "").match(/SKOR\s*(\d)/i);
  if (m) return "S" + m[1];
  return (name || "?").split(" ")[0].slice(0, 8).toUpperCase();
};

const inputCls = "h-9 w-full rounded-lg border border-[hsl(var(--hairline))] px-3 text-sm text-foreground bg-[hsl(var(--elevated))] outline-none focus:ring-2 focus:ring-[#0C66E4]";
const filterCls = "h-8 rounded-lg border border-[hsl(var(--hairline))] px-2 text-xs text-foreground bg-[hsl(var(--elevated))] outline-none focus:ring-2 focus:ring-[#0C66E4]";

// Ambang "umur pekerjaan" (PRD §16 default): merah setelah 2 jam.
const AGE_YELLOW_MIN = 60;
const AGE_RED_MIN = 120;

function ageMinutes(iso) {
  if (!iso) return null;
  return Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
}

function umurInfo(iso) {
  const mins = ageMinutes(iso);
  if (mins == null) return { text: "-", cls: "text-3", dotColor: null, mins: 0 };
  let text;
  if (mins < 60) text = `${mins} mnt`;
  else if (mins < 1440) text = `${Math.floor(mins / 60)} jam ${mins % 60} mnt`;
  else text = `${Math.floor(mins / 1440)} hari ${Math.floor((mins % 1440) / 60)} jam`;
  const cls = mins < AGE_YELLOW_MIN ? "text-[#216E4E]" : mins < AGE_RED_MIN ? "text-[#946F00]" : "text-[#CA3521] font-bold";
  const dotColor = mins < AGE_YELLOW_MIN ? "#22A06B" : mins < AGE_RED_MIN ? "#F5CD47" : "#CA3521";
  return { text, cls, dotColor, mins };
}

/** Titik warna umur pekerjaan — pengganti emoji 🟢🟡🔴 (konsisten lintas OS/browser). */
function AgeDot({ umur }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${umur.cls}`}>
      {umur.dotColor && <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: umur.dotColor }} />}
      {umur.text}
    </span>
  );
}

const AGE_FILTERS = [
  { value: "all", label: "Semua umur" },
  { value: "gt2h", label: "> 2 jam" },
  { value: "gt1d", label: "> 1 hari" },
];

export default function BankData() {
  const { divisionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [showExtra, setShowExtra] = useState(false);
  const [openItem, setOpenItem] = useState(null);
  const [form, setForm] = useState({ title: "", client_name: "", note: "", targetDivId: "", list_id: "", mode: "division", member_ids: [], priority: "none", due_date: "" });

  const [filters, setFilters] = useState({ status: "all", pic: "all", sender: "all", priority: "all", age: "all", from: "", to: "" });
  const [showFilters, setShowFilters] = useState(false);

  const { data: divisions } = useQuery({ queryKey: ["divisions"], queryFn: () => api.get("/divisions").then((r) => r.data) });
  const { data: summary } = useQuery({ queryKey: ["bank-data-summary"], queryFn: () => api.get("/bank-data/summary").then((r) => r.data), refetchInterval: 60000 });
  const activeDivId = divisionId || (divisions || [])[0]?.id;
  const { data, isLoading } = useQuery({
    queryKey: ["bank-data", activeDivId],
    queryFn: () => api.get(`/bank-data/${activeDivId}`).then((r) => r.data),
    enabled: !!activeDivId,
  });
  const waitingCountFor = (id) => (summary || []).find((s) => s.division_id === id)?.waiting ?? 0;
  const formDivId = form.targetDivId || activeDivId;
  const { data: formDivData } = useQuery({
    queryKey: ["bank-data", formDivId],
    queryFn: () => api.get(`/bank-data/${formDivId}`).then((r) => r.data),
    enabled: showCreate && !!formDivId,
  });

  const division = data?.division;
  const items = useMemo(() => data?.items || [], [data]);
  const workload = data?.workload || [];
  const isDivisionMember = user?.division_id === activeDivId;
  const isSupervisorUp = ["super_admin", "admin", "supervisor"].includes(user?.role);

  // opsi filter dinamis
  const senderOptions = useMemo(() => {
    const set = new Map();
    items.forEach((i) => {
      const n = i.source_user_name || i.created_by_name;
      if (n) set.set(n, n);
    });
    return [...set.keys()].sort();
  }, [items]);
  const picOptions = useMemo(() => {
    const set = new Map();
    items.forEach((i) => { if (i.current_pic_name) set.set(i.current_pic_name, i.current_pic_name); });
    return [...set.keys()].sort();
  }, [items]);

  const matchFilters = (i) => {
    if (filters.pic !== "all" && (i.current_pic_name || "—") !== filters.pic) return false;
    if (filters.sender !== "all" && (i.source_user_name || i.created_by_name || "—") !== filters.sender) return false;
    if (filters.priority !== "all" && (i.priority || "none") !== filters.priority) return false;
    if (filters.age !== "all") {
      const m = ageMinutes(i.claimed_at || i.created_at) || 0;
      if (filters.age === "gt2h" && m <= 120) return false;
      if (filters.age === "gt1d" && m <= 1440) return false;
    }
    if (filters.from && new Date(i.created_at) < new Date(filters.from)) return false;
    if (filters.to && new Date(i.created_at) > new Date(filters.to + "T23:59:59")) return false;
    return true;
  };

  const isDone = (i) => i.status === "done" || i.work_status === "COMPLETED";
  const allWaiting = items.filter((i) => i.distribution_status === "AVAILABLE" && !isDone(i));
  const allTaken = items.filter((i) => (i.current_pic_id || (i.member_ids || []).length > 0 || isDone(i)) && i.distribution_status !== "AVAILABLE");

  const showWaiting = filters.status === "all" || filters.status === "waiting";
  const showTaken = filters.status === "all" || filters.status === "taken" || filters.status === "done";
  const waiting = showWaiting ? allWaiting.filter(matchFilters) : [];
  const taken = (showTaken ? allTaken.filter(matchFilters) : []).filter((i) => filters.status !== "done" || isDone(i));
  const activeFilterCount = Object.values(filters).filter((v) => v && v !== "all").length;

  const formBoards = formDivData?.boards || [];
  const formBoard = formBoards[0];
  const formLists = formBoard?.lists || [];
  const formWorkload = formDivData?.workload || [];

  const openCreate = () => {
    setForm({ title: "", client_name: "", note: "", targetDivId: activeDivId, list_id: "", mode: "division", member_ids: [], priority: "none", due_date: "" });
    setShowExtra(false);
    setShowCreate(true);
  };

  const createItem = async () => {
    if (!form.title.trim()) {
      toast.error("Judul pekerjaan wajib diisi");
      return;
    }
    try {
      // Flow B — client offline masuk Bank Data; Owner ditetapkan saat di-claim
      await api.post("/bank-data/intake", {
        title: form.title.trim(),
        client_name: form.client_name.trim(),
        note: form.note.trim(),
        target_division_id: formDivId,
        target_list_id: form.list_id || formLists[0]?.id || null,
        priority: form.priority,
        due_date: form.due_date || null,
        assign_to_user_id: form.mode === "user" && form.member_ids.length > 0 ? form.member_ids[0] : null,
      });
      toast.success(`Pekerjaan masuk Bank Data ${formDivData?.division?.name || ""}`);
      setShowCreate(false);
      qc.invalidateQueries({ queryKey: ["bank-data"] });
      qc.invalidateQueries({ queryKey: ["bank-data-summary"] });
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
      qc.invalidateQueries({ queryKey: ["bank-data-summary"] });
      qc.invalidateQueries({ queryKey: ["my-work"] });
    } catch (e) {
      // 409 = sudah keburu diambil orang lain (klaim atomic)
      toast.error(errMsg(e));
      qc.invalidateQueries({ queryKey: ["bank-data"] });
    }
  };

  const takeover = async (itemId) => {
    if (!window.confirm("Ambil alih pekerjaan ini? PIC saat ini akan diberi notifikasi.")) return;
    try {
      await api.post(`/work-items/${itemId}/takeover`);
      toast.success("Pekerjaan berhasil diambil alih");
      qc.invalidateQueries({ queryKey: ["bank-data"] });
      qc.invalidateQueries({ queryKey: ["bank-data-summary"] });
      qc.invalidateQueries({ queryKey: ["my-work"] });
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto" data-testid="bank-data-page">
      <div className="mb-5">
        <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Database size={24} className="text-[#0C66E4]" /> Bank Data Pekerjaan
        </h1>
        <p className="text-sm text-2 mt-1">Ruang tunggu pekerjaan divisi — ambil pekerjaan, atau kirim pekerjaan baru ke divisi.</p>
      </div>

      <div className="flex flex-wrap gap-2 mb-4" data-testid="bank-data-division-tabs">
        {(divisions || []).map((d) => {
          const wc = waitingCountFor(d.id);
          const on = d.id === activeDivId;
          return (
            <button key={d.id} data-testid={`bankdata-tab-${d.id}`} onClick={() => navigate(`/bank-data/${d.id}`)}
              className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-colors active:scale-95 flex items-center gap-1.5 ${
                on ? "text-white" : "bg-[hsl(var(--elevated))] text-2 border border-[hsl(var(--hairline))] hover:bg-[hsl(var(--muted))]"
              }`}
              style={on ? { backgroundColor: d.color } : {}}>
              {d.name}
              {wc > 0 && (
                <span className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 ${on ? "bg-[hsl(var(--elevated))]/25" : wc >= 5 ? "bg-[#CA3521] text-white" : "bg-[#F5CD47] text-[#946F00]"}`} data-testid={`bankdata-tab-badge-${d.id}`}>
                  {wc}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Filter Bank Data (§9.4) */}
      <div className="mb-5" data-testid="bank-data-filters">
        <button onClick={() => setShowFilters((v) => !v)}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[hsl(var(--hairline))] bg-[hsl(var(--elevated))] text-xs font-semibold text-2 hover:bg-[hsl(var(--muted))]">
          <Filter size={13} /> Filter {activeFilterCount > 0 && <span className="bg-[#0C66E4] text-white rounded-full px-1.5">{activeFilterCount}</span>}
        </button>
        {showFilters && (
          <div className="mt-2 flex flex-wrap items-end gap-2 rounded-xl border border-[hsl(var(--hairline))] bg-[hsl(var(--elevated))] p-3">
            <label className="flex flex-col gap-1"><span className="text-[10px] font-bold uppercase text-3">Status</span>
              <select className={filterCls} value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
                <option value="all">Semua</option><option value="waiting">Menunggu diambil</option><option value="taken">Sedang dikerjakan</option><option value="done">Selesai</option>
              </select></label>
            <label className="flex flex-col gap-1"><span className="text-[10px] font-bold uppercase text-3">PIC</span>
              <select className={filterCls} value={filters.pic} onChange={(e) => setFilters({ ...filters, pic: e.target.value })}>
                <option value="all">Semua</option>{picOptions.map((n) => <option key={n} value={n}>{n}</option>)}
              </select></label>
            <label className="flex flex-col gap-1"><span className="text-[10px] font-bold uppercase text-3">Pengirim</span>
              <select className={filterCls} value={filters.sender} onChange={(e) => setFilters({ ...filters, sender: e.target.value })}>
                <option value="all">Semua</option>{senderOptions.map((n) => <option key={n} value={n}>{n}</option>)}
              </select></label>
            <label className="flex flex-col gap-1"><span className="text-[10px] font-bold uppercase text-3">Prioritas</span>
              <select className={filterCls} value={filters.priority} onChange={(e) => setFilters({ ...filters, priority: e.target.value })}>
                <option value="all">Semua</option>{PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select></label>
            <label className="flex flex-col gap-1"><span className="text-[10px] font-bold uppercase text-3">Umur</span>
              <select className={filterCls} value={filters.age} onChange={(e) => setFilters({ ...filters, age: e.target.value })}>
                {AGE_FILTERS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select></label>
            <label className="flex flex-col gap-1"><span className="text-[10px] font-bold uppercase text-3">Dari tanggal</span>
              <input type="date" className={filterCls} value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} /></label>
            <label className="flex flex-col gap-1"><span className="text-[10px] font-bold uppercase text-3">Sampai</span>
              <input type="date" className={filterCls} value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} /></label>
            {activeFilterCount > 0 && (
              <button onClick={() => setFilters({ status: "all", pic: "all", sender: "all", priority: "all", age: "all", from: "", to: "" })}
                className="h-8 px-3 rounded-lg text-xs font-semibold text-[#CA3521] hover:bg-[#FFEBE6]">Reset</button>
            )}
          </div>
        )}
      </div>

      {isLoading && <p className="text-sm text-2">Memuat...</p>}

      {data && (
        <>
          <div className="bg-[hsl(var(--elevated))] rounded-xl border border-[hsl(var(--hairline))] shadow-sm mb-5 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-[hsl(var(--hairline))] bg-[#FFF8E6]">
              <h2 className="font-heading font-bold text-foreground" data-testid="bank-data-waiting-title">
                Menunggu Diambil — {division?.name}
                <span className="ml-2 text-xs font-bold text-[#946F00] bg-[#F5CD47]/40 rounded-full px-2 py-0.5">{waiting.length}{activeFilterCount ? ` / ${allWaiting.length}` : ""} pekerjaan</span>
              </h2>
              <button data-testid="bank-data-add-button" onClick={openCreate}
                className="h-9 px-4 rounded-lg bg-[#0c66e4] hover:bg-[#0052cc] text-white text-sm font-semibold flex items-center gap-1.5 transition-colors active:scale-95">
                <Plus size={15} /> Tambah Pekerjaan
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="bank-data-waiting-table">
                <thead>
                  <tr className="border-b border-[hsl(var(--hairline))] text-left bg-[hsl(var(--muted))]">
                    <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-3 w-12">No</th>
                    <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-3">Pekerjaan</th>
                    <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-3">Owner</th>
                    <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-3">Dari</th>
                    <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-3">List</th>
                    <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-3">Prioritas</th>
                    <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-3">Umur</th>
                    <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-3">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {waiting.map((item, idx) => {
                    const umur = umurInfo(item.created_at);
                    return (
                      <tr key={item.id} className="border-b border-[hsl(var(--hairline))] hover:bg-[hsl(var(--muted))] transition-colors" data-testid={`bankdata-row-${item.id}`}>
                        <td className="px-4 py-2.5 text-3">{idx + 1}</td>
                        <td className="px-4 py-2.5 max-w-[280px]">
                          <button onClick={() => setOpenItem(item.id)} className="text-left" data-testid={`bankdata-open-${item.id}`}>
                            <p className="font-medium text-foreground hover:text-[#0C66E4] line-clamp-2">{item.title}</p>
                            {item.client_name && <p className="text-xs text-2">{item.client_name}</p>}
                          </button>
                        </td>
                        <td className="px-4 py-2.5 text-2 text-xs">{item.owner_user_name || <span className="text-3 italic">belum ditetapkan</span>}</td>
                        <td className="px-4 py-2.5 text-2 text-xs">{item.source_user_name || item.created_by_name || "—"}</td>
                        <td className="px-4 py-2.5">
                          <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-[hsl(var(--muted))] text-2">{item.list_name}</span>
                        </td>
                        <td className="px-4 py-2.5"><PriorityFlag priority={item.priority} /></td>
                        <td className="px-4 py-2.5 text-xs font-semibold" data-testid={`bankdata-umur-${item.id}`}><AgeDot umur={umur} /></td>
                        <td className="px-4 py-2.5">
                          {isDivisionMember ? (
                            <button data-testid={`bankdata-claim-${item.id}`} onClick={() => claim(item.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#22A06B] hover:bg-[#1D8A5C] text-white text-xs font-bold transition-colors active:scale-95">
                              <Hand size={12} /> AMBIL PEKERJAAN
                            </button>
                          ) : (
                            <span className="text-[11px] text-3">Hanya anggota divisi</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {waiting.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-3">
                      {activeFilterCount ? "Tidak ada yang cocok dengan filter." : "Tidak ada pekerjaan yang menunggu — semua sudah ada PIC."}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-[hsl(var(--elevated))] rounded-xl border border-[hsl(var(--hairline))] shadow-sm mb-5 overflow-hidden">
            <div className="px-5 py-3 border-b border-[hsl(var(--hairline))]">
              <h2 className="font-heading font-bold text-foreground" data-testid="bank-data-taken-title">
                Sedang Dikerjakan / Selesai
                <span className="ml-2 text-xs font-normal text-3">{taken.length}{activeFilterCount ? ` / ${allTaken.length}` : ""} pekerjaan</span>
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="bank-data-taken-table">
                <thead>
                  <tr className="border-b border-[hsl(var(--hairline))] text-left bg-[hsl(var(--muted))]">
                    <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-3 w-12">No</th>
                    <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-3">Pekerjaan</th>
                    <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-3">Owner</th>
                    <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-3">Dari</th>
                    <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-3">PIC</th>
                    <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-3">Umur klaim</th>
                    <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-3">Status</th>
                    <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-3">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {taken.map((item, idx) => (
                    <TakenRow key={item.id} item={item} idx={idx} user={user} isSupervisorUp={isSupervisorUp}
                      onOpen={() => setOpenItem(item.id)} onTakeover={() => takeover(item.id)} />
                  ))}
                  {taken.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-3">
                      {activeFilterCount ? "Tidak ada yang cocok dengan filter." : "Belum ada pekerjaan yang diambil."}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-[hsl(var(--elevated))] rounded-xl border border-[hsl(var(--hairline))] shadow-sm p-5" data-testid="bank-data-workload">
            <h2 className="font-heading font-bold text-foreground mb-4">Beban Kerja Anggota {division?.name}</h2>

            {/* Ringkasan management (§30) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5" data-testid="bank-data-kpi">
              {[
                { label: "Pekerjaan masuk", val: allWaiting.length + allTaken.length, cls: "text-foreground" },
                { label: "Belum diambil", val: allWaiting.length, cls: allWaiting.length ? "text-[#CA3521]" : "text-[#22A06B]" },
                { label: "Sedang dikerjakan", val: allTaken.filter((i) => !isDone(i)).length, cls: "text-[#0C66E4]" },
                { label: "Anggota belum dapat", val: workload.filter((w) => w.total === 0).length, cls: workload.some((w) => w.total === 0) ? "text-[#946F00]" : "text-[#22A06B]" },
              ].map((k) => (
                <div key={k.label} className="rounded-xl bg-[hsl(var(--muted))] border border-[hsl(var(--hairline))] p-3 text-center">
                  <p className={`text-2xl font-bold ${k.cls}`}>{k.val}</p>
                  <p className="text-[11px] text-3 mt-0.5">{k.label}</p>
                </div>
              ))}
            </div>

            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
              {workload.map((w) => (
                <div key={w.user.id} className="rounded-xl border border-[hsl(var(--hairline))] p-4 hover:shadow-sm transition-shadow" data-testid={`workload-${w.user.id}`}>
                  <div className="flex items-center gap-2.5 mb-2">
                    <Avatar name={w.user.name} color={w.user.avatar_color} size="h-8 w-8 text-xs" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">{w.user.name}</p>
                      <p className="text-[11px] text-3">
                        {w.total} sedang dikerjakan
                        {typeof w.available_in_bank === "number" && <> · {w.available_in_bank} menunggu di Bank Data</>}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(w.by_list || {}).map(([lname, count]) => (
                      <span key={lname} className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#E9F2FF] text-[#0C66E4]" title={lname}>
                        {abbr(lname)}: {count}
                      </span>
                    ))}
                    {Object.keys(w.by_list || {}).length === 0 && <span className="text-[11px] text-3">Tidak ada pekerjaan aktif</span>}
                  </div>
                </div>
              ))}
              {workload.length === 0 && <p className="text-sm text-3">Belum ada anggota di divisi ini.</p>}
            </div>
          </div>
        </>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-start pt-14 overflow-y-auto fade-enter" onClick={() => setShowCreate(false)} data-testid="bankdata-create-modal">
          <div className="bg-[hsl(var(--elevated))] w-full max-w-lg rounded-xl shadow-2xl p-6 mb-16 modal-enter" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading text-lg font-bold text-foreground">Kirim Pekerjaan ke Bank Data</h2>
              <button aria-label="Tutup" data-testid="bankdata-create-close" onClick={() => setShowCreate(false)} className="p-1.5 rounded hover:bg-[hsl(var(--muted))] text-2">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-2">Judul Pekerjaan *</label>
                <input data-testid="bankdata-form-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="mis: PT ABC - Pengurusan NIB" className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-semibold text-2">Nama Client</label>
                <input data-testid="bankdata-form-client" value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} placeholder="mis: PT ABC" className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-semibold text-2">Catatan</label>
                <textarea data-testid="bankdata-form-note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2} placeholder="mis: Pendirian PT + NPWP" className="w-full rounded-lg border border-[hsl(var(--hairline))] px-3 py-2 text-sm bg-[hsl(var(--elevated))] outline-none focus:ring-2 focus:ring-[#0C66E4] resize-none" />
              </div>
              <div className="border-t border-[hsl(var(--hairline))] pt-3">
                <p className="text-xs font-bold uppercase tracking-wider text-3 mb-2">Kirim ke</p>
                <label className="text-xs font-semibold text-2">Divisi Tujuan</label>
                <select data-testid="bankdata-form-division" value={formDivId || ""} onChange={(e) => setForm({ ...form, targetDivId: e.target.value, list_id: "", member_ids: [] })} className={inputCls}>
                  {(divisions || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                {formLists.length > 0 && (
                  <div className="mt-2">
                    <label className="text-xs font-semibold text-2">Masuk ke list</label>
                    <select data-testid="bankdata-form-list" value={form.list_id} onChange={(e) => setForm({ ...form, list_id: e.target.value })} className={inputCls}>
                      {formLists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div className="border-t border-[hsl(var(--hairline))] pt-3">
                <p className="text-xs font-bold uppercase tracking-wider text-3 mb-2">Penanggung Jawab</p>
                <label className="flex items-start gap-2 cursor-pointer mb-1.5" data-testid="bankdata-mode-division">
                  <input type="radio" checked={form.mode === "division"} onChange={() => setForm({ ...form, mode: "division" })} className="mt-1 accent-[#0C66E4]" />
                  <span className="text-sm text-foreground">Biarkan anggota divisi mengambil sendiri</span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer" data-testid="bankdata-mode-user">
                  <input type="radio" checked={form.mode === "user"} onChange={() => setForm({ ...form, mode: "user" })} className="mt-1 accent-[#0C66E4]" />
                  <span className="text-sm text-foreground">Berikan langsung kepada user tertentu</span>
                </label>
                {form.mode === "user" && (
                  <div className="mt-2 max-h-32 overflow-y-auto minimal-scrollbar space-y-1 border border-[hsl(var(--hairline))] rounded-lg p-2">
                    {formWorkload.map((w) => (
                      <label key={w.user.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[hsl(var(--muted))] cursor-pointer" data-testid={`bankdata-assign-${w.user.id}`}>
                        <input type="checkbox" checked={form.member_ids.includes(w.user.id)}
                          onChange={() => setForm((f) => ({ ...f, member_ids: f.member_ids.includes(w.user.id) ? f.member_ids.filter((x) => x !== w.user.id) : [...f.member_ids, w.user.id] }))}
                          className="w-4 h-4 accent-[#0C66E4]" />
                        <Avatar name={w.user.name} color={w.user.avatar_color} size="h-6 w-6 text-[10px]" />
                        <span className="text-sm text-foreground flex-1">{w.user.name}</span>
                        <span className="text-[10px] text-3">{w.total} pekerjaan</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div className="border-t border-[hsl(var(--hairline))] pt-3">
                <button type="button" data-testid="bankdata-extra-toggle" onClick={() => setShowExtra((v) => !v)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#0C66E4] hover:underline">
                  {showExtra ? <ChevronDown size={13} /> : <ChevronRight size={13} />} Opsi Tambahan
                </button>
                {showExtra && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-semibold text-2">Prioritas</label>
                      <select data-testid="bankdata-form-priority" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className={inputCls}>
                        {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-2">Tenggat</label>
                      <input data-testid="bankdata-form-due" type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className={inputCls} />
                    </div>
                  </div>
                )}
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

const DIST_LABEL = {
  CLAIMED: { t: "Sudah diambil", c: "bg-[#E3FCEF] text-[#216E4E]" },
  DIRECT_ASSIGNED: { t: "Ditugaskan langsung", c: "bg-[#EAE6FF] text-[#5E4DB2]" },
  RELEASED: { t: "Dilepaskan", c: "bg-[#FFF0B3] text-[#946F00]" },
  AVAILABLE: { t: "Menunggu", c: "bg-[hsl(var(--muted))] text-2" },
};

function TakenRow({ item, idx, user, isSupervisorUp, onOpen, onTakeover }) {
  const { data: users } = useQuery({ queryKey: ["users"], queryFn: () => api.get("/users").then((r) => r.data) });
  const usersById = Object.fromEntries((users || []).map((u) => [u.id, u]));
  const isMine = item.current_pic_id === user?.id || (item.member_ids || []).includes(user?.id);
  const pic = usersById[item.current_pic_id] || usersById[(item.member_ids || [])[0]];
  const picName = item.current_pic_name || pic?.name;
  const isDone = item.status === "done" || item.work_status === "COMPLETED";
  const claimAge = umurInfo(item.claimed_at);
  const dist = DIST_LABEL[item.distribution_status] || DIST_LABEL.CLAIMED;
  return (
    <tr className="border-b border-[hsl(var(--hairline))] hover:bg-[hsl(var(--muted))] transition-colors" data-testid={`bankdata-taken-row-${item.id}`}>
      <td className="px-4 py-2.5 text-3">{idx + 1}</td>
      <td className="px-4 py-2.5 max-w-[260px]">
        <button onClick={onOpen} className="text-left" data-testid={`bankdata-open-${item.id}`}>
          <p className="font-medium text-foreground hover:text-[#0C66E4] line-clamp-2">{item.title}</p>
          {item.client_name && <p className="text-xs text-2">{item.client_name}</p>}
        </button>
      </td>
      <td className="px-4 py-2.5 text-2 text-xs">{item.owner_user_name || "—"}</td>
      <td className="px-4 py-2.5 text-2 text-xs">{item.source_user_name || item.created_by_name || "—"}</td>
      <td className="px-4 py-2.5">
        {picName ? (
          <span className="inline-flex items-center gap-1 bg-[hsl(var(--muted))] rounded-full pl-0.5 pr-2 py-0.5">
            <Avatar name={picName} color={pic?.avatar_color} size="h-5 w-5 text-[9px]" />
            <span className="text-[11px] font-medium text-foreground">{picName}</span>
          </span>
        ) : <span className="text-[11px] text-3">—</span>}
      </td>
      <td className="px-4 py-2.5 text-xs font-semibold">{item.claimed_at ? <AgeDot umur={claimAge} /> : "—"}</td>
      <td className="px-4 py-2.5">
        {isDone ? <StatusBadge status="done" />
          : <span className={`inline-flex px-1.5 py-0.5 rounded text-[11px] font-semibold ${dist.c}`}>{dist.t}</span>}
      </td>
      <td className="px-4 py-2.5">
        {isMine && !isDone ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#216E4E]"><CheckCircle2 size={12} /> Pekerjaan Anda</span>
        ) : isSupervisorUp && !isDone ? (
          <button data-testid={`bankdata-takeover-${item.id}`} onClick={onTakeover}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FFF8E6] border border-[#F5CD47] text-[#946F00] text-xs font-bold hover:bg-[#F5CD47]/40 transition-colors active:scale-95">
            <Swords size={12} /> Ambil Alih
          </button>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] text-3"><Lock size={11} /> {picName ? `Dikerjakan ${picName}` : "—"}</span>
        )}
      </td>
    </tr>
  );
}
