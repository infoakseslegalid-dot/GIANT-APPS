import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip } from "recharts";
import {
  Archive as ArchiveIcon, HardDrive, Files, FolderCheck, AlertTriangle, Download, X, Search,
  ExternalLink, Phone, CheckCircle2, Circle, Plus, History, Tags, ChevronRight,
  Cloud, CloudOff, RefreshCw, Copy, Link2, Lock, FileText, Eye, Plug, KeyRound,
} from "lucide-react";
import { toast } from "sonner";
import { api, errMsg, fmtDateTime, API } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import CardModal from "../components/kanban/CardModalWrapper";
import ClientDataForm from "../components/ClientDataForm";

// ── util ────────────────────────────────────────────────────────────────
export function fmtBytes(n) {
  const b = Number(n) || 0;
  if (b < 1024) return `${b} B`;
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(0)} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
}
const MONTHS_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const monthLabel = (ym) => {
  const [y, m] = String(ym).split("-");
  return `${MONTHS_ID[Number(m) - 1] || m} ${String(y).slice(2)}`;
};
const GROUPS = [
  { key: "KLIEN", label: "Dokumen dari Klien", hint: "bahan: KTP, NPWP, KK…" },
  { key: "HASIL", label: "Dokumen Hasil", hint: "produk jadi: Akta, SK, NIB…" },
  { key: "LAIN", label: "Lainnya", hint: "" },
];
const DASH_CATEGORIES = ["Legalitas", "Perpajakan", "Perizinan", "Sertifikat", "Lainnya"];
const BAR = "#0C66E4"; // satu hue: semua grafik di sini mengukur besaran, bukan identitas

const downloadUrl = (key) => `${API}/archive/jobs/${encodeURIComponent(key)}/download`;

// ── komponen kecil ──────────────────────────────────────────────────────
function Stat({ icon, label, value, sub, tone }) {
  const toneCls = { warn: "text-[#B65C02]", bad: "text-[#C9372C]", good: "text-[#1F845A]" }[tone] || "text-foreground";
  return (
    <div className="rounded-xl border border-[hsl(var(--hairline))] bg-[hsl(var(--elevated))] p-4 flex flex-col gap-1 min-w-0">
      <div className="flex items-center gap-2 text-2 text-[13px] font-semibold">{icon} {label}</div>
      <div className={`text-2xl font-bold ${toneCls}`}>{value}</div>
      {sub && <div className="text-xs text-3">{sub}</div>}
    </div>
  );
}

function Panel({ title, sub, children, className = "" }) {
  return (
    <section className={`rounded-xl border border-[hsl(var(--hairline))] bg-[hsl(var(--elevated))] overflow-hidden ${className}`}>
      <header className="px-4 py-3 border-b border-[hsl(var(--hairline))]">
        <h2 className="font-heading font-bold text-foreground">{title}</h2>
        {sub && <p className="text-xs text-2 mt-0.5">{sub}</p>}
      </header>
      <div className="p-3">{children}</div>
    </section>
  );
}

function DocBadge({ done, total, missing }) {
  if (!total) return <span className="text-xs text-3">—</span>;
  const full = done === total;
  return (
    <span
      title={missing?.length ? `Belum ada: ${missing.join(", ")}` : "Semua dokumen wajib ada"}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${
        full ? "bg-[#DCFFF1] text-[#216E4E]" : done === 0 ? "bg-[#FFECEB] text-[#AE2E24]" : "bg-[#FFF7D6] text-[#7F5F01]"
      }`}
    >
      {full ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />} {done}/{total}
    </span>
  );
}

function StatusBadge({ done }) {
  return done ? (
    <span className="rounded-full bg-[#DCFFF1] px-2 py-0.5 text-xs font-semibold text-[#216E4E]">Selesai</span>
  ) : (
    <span className="rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-xs font-semibold text-2">Berjalan</span>
  );
}

function ChartTip({ active, payload, label, unit = "bytes" }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-[hsl(var(--hairline))] bg-[hsl(var(--elevated))] px-3 py-2 text-xs shadow-md">
      <div className="font-semibold text-foreground">{p.fullName || label}</div>
      <div className="text-2">{unit === "bytes" ? fmtBytes(p.bytes) : p.bytes} · {p.count} file</div>
    </div>
  );
}

function HBar({ data, height = 260, onClick }) {
  if (!data?.length) return <p className="p-4 text-sm text-3">Belum ada data.</p>;
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--hairline))" />
          <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={fmtBytes} stroke="hsl(var(--text-3))" />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={130} stroke="hsl(var(--text-3))" />
          <RTooltip content={<ChartTip />} cursor={{ fill: "hsl(var(--muted))" }} />
          <Bar
            dataKey="bytes" fill={BAR} radius={[0, 4, 4, 0]} maxBarSize={18}
            onClick={onClick ? (d) => onClick(d.payload || d) : undefined}
            style={onClick ? { cursor: "pointer" } : undefined}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  TAB: RINGKASAN
// ═══════════════════════════════════════════════════════════════════════
function SummaryTab({ onOpenJob, onFilter }) {
  const { data, isLoading } = useQuery({
    queryKey: ["archive-summary"],
    queryFn: () => api.get("/archive/summary").then((r) => r.data),
  });
  if (isLoading || !data) return <p className="text-2 text-sm">Memuat…</p>;

  const short = (s, n = 22) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
  const months = data.by_month.map((m) => ({ ...m, name: monthLabel(m.month) }));
  const types = data.by_type.map((t) => ({ ...t, fullName: t.name, name: short(t.name) }));
  const divs = data.by_division.map((d) => ({ ...d, fullName: d.name, name: short(d.name) }));
  const tops = data.top_jobs.map((j) => ({
    ...j, bytes: j.total_bytes, count: j.file_count,
    fullName: j.title + (j.client ? ` — ${j.client}` : ""), name: short(j.title),
  }));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat icon={<HardDrive size={15} />} label="Total penyimpanan" value={fmtBytes(data.total_bytes)}
          sub={`+${fmtBytes(data.bytes_this_month)} bulan ini`} />
        <Stat icon={<Files size={15} />} label="Total file" value={data.total_files.toLocaleString("id-ID")}
          sub={`+${data.files_this_month} file bulan ini`} />
        <Stat icon={<FolderCheck size={15} />} label="Dokumen lengkap" tone="good"
          value={`${data.jobs_complete_docs} / ${data.total_jobs}`} sub="pekerjaan dengan semua dokumen wajib" />
        <Stat icon={<AlertTriangle size={15} />} label="Perlu perhatian" tone={data.jobs_done_incomplete || data.untyped_files ? "warn" : undefined}
          value={data.jobs_done_incomplete}
          sub="pekerjaan SELESAI tapi dokumen belum lengkap" />
      </div>

      {data.drive_errors > 0 && (
        <div className="rounded-xl border border-[#F87168] bg-[#FFECEB] p-3 text-sm text-[#5D1F1A] flex items-center gap-2">
          <CloudOff size={14} /> <b>{data.drive_errors}</b> file gagal dikirim ke Google Drive. Buka tab Integrasi → &quot;Sinkron semua sekarang&quot; untuk mencoba lagi.
        </div>
      )}
      {(data.jobs_done_incomplete > 0 || data.untyped_files > 0) && (
        <div className="rounded-xl border border-[#F5CD47] bg-[#FFF7D6] p-3 text-sm text-[#533F04] flex flex-col gap-1.5">
          {data.jobs_done_incomplete > 0 && (
            <button className="flex items-center gap-2 text-left hover:underline" onClick={() => onFilter({ status: "done", docs: "incomplete" })}>
              <AlertTriangle size={14} /> <b>{data.jobs_done_incomplete}</b> pekerjaan sudah selesai tapi dokumen wajibnya belum lengkap. Lihat daftarnya <ChevronRight size={14} />
            </button>
          )}
          {data.untyped_files > 0 && (
            <div className="flex items-center gap-2">
              <Tags size={14} /> <b>{data.untyped_files}</b> file belum ditandai jenis dokumennya. Tandai lewat dropdown di lampiran kartu, supaya masuk folder yang benar saat di-backup.
            </div>
          )}
        </div>
      )}

      <Panel title="Penggunaan penyimpanan per bulan" sub="Ukuran file yang diupload tiap bulan, 12 bulan terakhir.">
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={months} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--hairline))" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="hsl(var(--text-3))" />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={fmtBytes} width={60} stroke="hsl(var(--text-3))" />
              <RTooltip content={<ChartTip />} cursor={{ fill: "hsl(var(--muted))" }} />
              <Bar dataKey="bytes" fill={BAR} radius={[4, 4, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <div className="grid lg:grid-cols-2 gap-4">
        <Panel title="10 pekerjaan terbesar" sub="Klik batang untuk membuka detail pekerjaan.">
          <HBar data={tops} height={Math.max(160, tops.length * 30)} onClick={(d) => onOpenJob(d.key)} />
        </Panel>
        <Panel title="Berdasarkan jenis dokumen" sub="Ukuran total per jenis dokumen.">
          <HBar data={types} height={Math.max(160, types.length * 30)} />
        </Panel>
      </div>
      <Panel title="Berdasarkan divisi" sub="Divisi tempat file diupload.">
        <HBar data={divs} height={Math.max(140, divs.length * 32)} />
      </Panel>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  TAB: DAFTAR PEKERJAAN
// ═══════════════════════════════════════════════════════════════════════
function JobsTab({ filters, setFilters, onOpenJob, canDownload }) {
  const [q, setQ] = useState(filters.q || "");
  const params = { ...filters, q: filters.q || undefined };
  const { data: jobs, isLoading } = useQuery({
    queryKey: ["archive-jobs", params],
    queryFn: () => api.get("/archive/jobs", { params }).then((r) => r.data),
  });
  const set = (k, v) => setFilters((f) => ({ ...f, [k]: v || undefined }));
  const sel = "h-[36px] rounded-lg border border-[hsl(var(--hairline))] bg-[hsl(var(--surface))] px-2 text-sm text-foreground";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <form className="relative flex-1 min-w-[200px]" onSubmit={(e) => { e.preventDefault(); set("q", q.trim()); }}>
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-3" />
          <input
            value={q} onChange={(e) => setQ(e.target.value)} onBlur={() => set("q", q.trim())}
            placeholder="Cari PT, klien, no. WA, kode AL-…" data-testid="archive-search"
            className={`${sel} w-full pl-8`}
          />
        </form>
        <input type="month" value={filters.month || ""} onChange={(e) => set("month", e.target.value)} className={sel} title="Bulan pekerjaan dibuat" />
        <select value={filters.status || ""} onChange={(e) => set("status", e.target.value)} className={sel}>
          <option value="">Semua status</option>
          <option value="done">Selesai</option>
          <option value="active">Berjalan</option>
        </select>
        <select value={filters.docs || ""} onChange={(e) => set("docs", e.target.value)} className={sel}>
          <option value="">Semua kelengkapan</option>
          <option value="complete">Dokumen lengkap</option>
          <option value="incomplete">Belum lengkap</option>
          <option value="empty">Belum ada file</option>
        </select>
        <select value={filters.sort || "newest"} onChange={(e) => set("sort", e.target.value)} className={sel}>
          <option value="newest">Terbaru</option>
          <option value="size">Ukuran terbesar</option>
          <option value="name">Nama A–Z</option>
        </select>
        {Object.values(filters).some(Boolean) && (
          <button className="text-sm text-2 underline" onClick={() => { setQ(""); setFilters({}); }}>Reset</button>
        )}
      </div>

      <div className="rounded-xl border border-[hsl(var(--hairline))] bg-[hsl(var(--elevated))] overflow-x-auto">
        <table className="w-full border-collapse text-sm min-w-[880px]">
          <thead className="bg-[hsl(var(--muted))] text-[12px] uppercase tracking-wide text-3">
            <tr>
              <th className="px-3 py-2 text-left">Pekerjaan</th>
              <th className="px-3 py-2 text-left">Klien</th>
              <th className="px-3 py-2 text-left">Dokumen wajib</th>
              <th className="px-3 py-2 text-right">File</th>
              <th className="px-3 py-2 text-right">Ukuran</th>
              <th className="px-3 py-2 text-center" title="Status Google Drive">Drive</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={8} className="p-4 text-2">Memuat…</td></tr>}
            {!isLoading && !jobs?.length && <tr><td colSpan={8} className="p-6 text-center text-2">Tidak ada pekerjaan yang cocok.</td></tr>}
            {(jobs || []).map((j) => (
              <tr key={j.key} className="border-t border-[hsl(var(--hairline))] hover:bg-[hsl(var(--muted))] cursor-pointer" onClick={() => onOpenJob(j.key)} data-testid="archive-job-row">
                <td className="px-3 py-2">
                  <div className="font-semibold text-foreground">{j.title}</div>
                  <div className="text-xs text-3">{fmtDateTime(j.created_at)}{j.divisions?.length ? ` · ${j.divisions.map((d) => d.name).join(", ")}` : ""}</div>
                </td>
                <td className="px-3 py-2">
                  <div className="text-foreground">{j.client || "—"}</div>
                  {j.client_phone && <div className="text-xs text-3">{j.client_phone}</div>}
                </td>
                <td className="px-3 py-2"><DocBadge done={j.required_done} total={j.required_total} missing={j.missing} /></td>
                <td className="px-3 py-2 text-right tabular-nums">{j.file_count}{j.untyped_count > 0 && <span className="ml-1 text-[11px] text-[#B65C02]" title="belum ditandai jenisnya">({j.untyped_count}?)</span>}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtBytes(j.total_bytes)}</td>
                <td className="px-3 py-2 text-center">
                  {j.drive_errors > 0 ? <span title={`${j.drive_errors} file gagal dikirim`} className="inline-flex text-[#C9372C]"><CloudOff size={15} /></span>
                    : j.file_count === 0 ? <span className="text-3">—</span>
                    : j.drive_pending > 0 ? <span title={`${j.drive_pending} file menunggu dikirim`} className="inline-flex text-3"><Cloud size={15} /></span>
                    : <span title={`Semua file di Google Drive${j.drive?.month ? ` (folder ${monthLabel(j.drive.month)})` : ""}`} className="inline-flex text-[#1F845A]"><Cloud size={15} /></span>}
                </td>
                <td className="px-3 py-2"><StatusBadge done={j.done} /></td>
                <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                  {canDownload && j.file_count > 0 && (
                    <a href={downloadUrl(j.key)} className="inline-flex items-center gap-1 rounded-md border border-[hsl(var(--hairline))] px-2 py-1 text-xs font-semibold text-foreground hover:bg-[hsl(var(--muted))]">
                      <Download size={13} /> ZIP
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {jobs?.length > 0 && (
        <p className="text-xs text-3">
          {jobs.length} pekerjaan · {jobs.reduce((s, j) => s + j.file_count, 0)} file · {fmtBytes(jobs.reduce((s, j) => s + j.total_bytes, 0))}
        </p>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  DETAIL PEKERJAAN (panel samping)
// ═══════════════════════════════════════════════════════════════════════
async function copyText(text, msg = "Disalin") {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(msg);
  } catch {
    toast.error("Gagal menyalin — salin manual dari layar");
  }
}

function waText(job) {
  const d = job.dashboard;
  const lines = [
    `Halo${job.client ? ` Bapak/Ibu ${job.client}` : ""}, berikut dokumen ${d.company_name}:`,
    "",
    ...d.documents.map((x) => `• ${x.type}: ${x.url}`),
    "",
    "Terima kasih — Akses Legal Indonesia",
  ];
  return lines.join("\n");
}

function DriveBadge({ f, connected }) {
  if (!connected) return null;
  if (f.drive_error) return <span title={f.drive_error} className="text-[#C9372C]"><CloudOff size={14} /></span>;
  if (f.drive_file_id) return <span title={`Tersimpan di Google Drive${f.drive_side === "OUT" ? " (link dibagikan ke klien)" : " (internal)"}`} className="text-[#1F845A]"><Cloud size={14} /></span>;
  return <span title="Menunggu dikirim ke Google Drive" className="text-3"><Cloud size={14} /></span>;
}

function JobDrawer({ jobKey, onClose, canDownload, canManage, onKeyChange }) {
  const qc = useQueryClient();
  const [openCard, setOpenCard] = useState(null);
  const [editClient, setEditClient] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const { data: job, isLoading, refetch } = useQuery({
    queryKey: ["archive-job", jobKey],
    queryFn: () => api.get(`/archive/jobs/${encodeURIComponent(jobKey)}`).then((r) => r.data),
  });

  const saveClient = async (body) => {
    try {
      const r = await api.patch(`/archive/jobs/${encodeURIComponent(jobKey)}`, body);
      toast.success("Data klien disimpan");
      setEditClient(false);
      qc.invalidateQueries({ queryKey: ["archive-jobs"] });
      if (r.data.key && r.data.key !== jobKey) onKeyChange(r.data.key);
      else refetch();
    } catch (e) { toast.error(errMsg(e)); }
  };

  const syncNow = async () => {
    setSyncing(true);
    try {
      const r = await api.post(`/archive/jobs/${encodeURIComponent(jobKey)}/sync`);
      if (r.data.ok) toast.success(`Tersinkron ke Google Drive (${r.data.files} file)`);
      else toast.warning(r.data.reason || `${r.data.errors} file gagal dikirim`);
      refetch();
      qc.invalidateQueries({ queryKey: ["archive-jobs"] });
    } catch (e) { toast.error(errMsg(e)); } finally { setSyncing(false); }
  };

  const grouped = useMemo(() => {
    const files = job?.files || [];
    return [
      ...GROUPS.map((g) => ({ ...g, files: files.filter((f) => f.document_group === g.key) })),
      { key: "NONE", label: "Belum ditandai jenisnya", hint: "masuk folder \"Belum Dipilah\" (internal) sampai ditandai", files: files.filter((f) => !f.document_group) },
    ].filter((g) => g.files.length);
  }, [job]);

  const clientRows = job ? [
    ["Perusahaan", job.company_name], ["Jenis layanan", job.service_type], ["Klien", job.client],
    ["No. telepon / WA", job.client_phone], ["Email", job.client_email], ["No. akta", job.akta_number],
    ["NIB", job.nib_number], ["Tanggal pendirian", job.established_date], ["Owner (CS)", job.owner_name],
  ] : [];
  const dash = job?.dashboard;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/40" onClick={onClose}>
      <aside
        className="h-full w-full max-w-[760px] overflow-y-auto bg-[hsl(var(--surface))] shadow-2xl"
        onClick={(e) => e.stopPropagation()} data-testid="archive-job-drawer"
      >
        {isLoading || !job ? (
          <p className="p-6 text-2">Memuat…</p>
        ) : (
          <div className="p-5 space-y-5">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-3">{job.code}</div>
                <h2 className="font-heading text-xl font-bold text-foreground break-words">{job.company_name || job.title}</h2>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-2">
                  <StatusBadge done={job.done} />
                  {job.company_name && <span className="truncate">{job.title}</span>}
                  <span>· {job.file_count} file · {fmtBytes(job.total_bytes)}</span>
                </div>
              </div>
              <button onClick={onClose} className="rounded-md p-1.5 text-2 hover:bg-[hsl(var(--muted))]" aria-label="Tutup"><X size={18} /></button>
            </div>

            <div className="flex flex-wrap gap-2">
              {canDownload && job.file_count > 0 && (
                <a href={downloadUrl(job.key)} onClick={() => setTimeout(() => refetch(), 3000)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#0C66E4] px-3 py-2 text-sm font-semibold text-white hover:bg-[#0055CC]" data-testid="archive-download-zip">
                  <Download size={15} /> Download semua (ZIP)
                </a>
              )}
              {job.rep_item_id && (
                <button onClick={() => setOpenCard(job.rep_item_id)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[hsl(var(--hairline))] px-3 py-2 text-sm font-semibold text-foreground hover:bg-[hsl(var(--muted))]">
                  <ExternalLink size={15} /> Buka kartu
                </button>
              )}
            </div>

            {/* Dashboard klien */}
            <div className="rounded-xl border-2 border-[#85B8FF] bg-[hsl(var(--elevated))] p-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-bold text-foreground flex items-center gap-1.5"><Link2 size={15} /> Link untuk Dashboard Klien</h3>
                <span className="text-xs text-2">{dash.documents_ready}/{dash.documents_total} dokumen hasil sudah ada link-nya</span>
                {dash.documents.length > 0 && (
                  <button onClick={() => copyText(waText(job), "Pesan WhatsApp disalin")}
                    className="ml-auto inline-flex items-center gap-1 rounded-md bg-[#1F845A] px-2.5 py-1 text-xs font-semibold text-white">
                    <Copy size={12} /> Salin untuk WhatsApp
                  </button>
                )}
              </div>
              {dash.documents.length === 0 ? (
                <p className="mt-2 text-xs text-2">
                  {!job.drive_connected
                    ? "Google Drive belum dihubungkan — link muncul otomatis setelah terhubung (tab Integrasi)."
                    : dash.documents_total === 0
                      ? "Belum ada file yang ditandai sebagai dokumen hasil (Akta, SK, NPWP Perusahaan, NIB, …)."
                      : "Dokumen hasil sedang dikirim ke Google Drive…"}
                </p>
              ) : (
                <div className="mt-2 divide-y divide-[hsl(var(--hairline))] rounded-lg border border-[hsl(var(--hairline))] bg-[hsl(var(--surface))]">
                  {dash.documents.map((d) => (
                    <div key={d.id} className="flex items-center gap-2 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-semibold text-foreground">{d.name}</div>
                        <div className="text-[11px] text-3">{d.category}{d.number ? ` · No. ${d.number}` : ""}</div>
                      </div>
                      <a href={d.url} target="_blank" rel="noreferrer" className="rounded p-1.5 text-2 hover:bg-[hsl(var(--muted))]" title="Buka di Google Drive"><Eye size={15} /></a>
                      <button onClick={() => copyText(d.url, `Link ${d.type} disalin`)} className="inline-flex items-center gap-1 rounded-md border border-[hsl(var(--hairline))] px-2 py-1 text-xs font-semibold text-foreground hover:bg-[hsl(var(--muted))]">
                        <Copy size={12} /> Salin
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {job.drive?.pushed_at && <p className="mt-2 text-[11px] text-2">Terkirim otomatis ke dashboard {fmtDateTime(job.drive.pushed_at)}</p>}
              {job.drive?.push_error && <p className="mt-2 text-[11px] text-[#C9372C]">Kirim ke dashboard gagal: {job.drive.push_error}</p>}
            </div>

            {/* Data klien */}
            <div className="rounded-xl border border-[hsl(var(--hairline))] bg-[hsl(var(--elevated))] p-4 text-sm">
              <div className="mb-2 flex items-center gap-2">
                <h3 className="font-bold text-foreground flex items-center gap-1.5"><Phone size={14} /> Data klien &amp; perusahaan</h3>
                {canManage && !editClient && <button className="ml-auto text-xs text-[#0C66E4] underline" onClick={() => setEditClient(true)}>ubah</button>}
              </div>
              {editClient ? (
                <ClientDataForm value={job} canEdit onSave={saveClient} onCancel={() => setEditClient(false)} compact />
              ) : (
                <>
                  <dl className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-2">
                    {clientRows.map(([l, v]) => (
                      <div key={l} className="min-w-0"><dt className="text-xs text-3">{l}</dt><dd className="font-semibold text-foreground break-words">{v || "—"}</dd></div>
                    ))}
                  </dl>
                  {(job.client_address || job.client_notes) && (
                    <div className="mt-2 space-y-1 text-[13px] text-2">
                      {job.client_address && <p><b className="text-foreground">Alamat:</b> {job.client_address}</p>}
                      {job.client_notes && <p className="whitespace-pre-line"><b className="text-foreground">Catatan:</b> {job.client_notes}</p>}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Google Drive */}
            <div className="rounded-xl border border-[hsl(var(--hairline))] bg-[hsl(var(--elevated))] p-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-bold text-foreground flex items-center gap-1.5"><Cloud size={15} /> Google Drive</h3>
                {job.drive_connected ? (
                  <span className="text-xs text-2">
                    {job.drive?.synced_at ? `Sinkron terakhir ${fmtDateTime(job.drive.synced_at)}` : "Belum pernah disinkron"}
                    {job.drive?.month ? ` · folder ${monthLabel(job.drive.month)}` : job.drive?.synced_at ? " · folder _SEDANG BERJALAN" : ""}
                  </span>
                ) : (
                  <span className="text-xs text-3">Belum terhubung</span>
                )}
                {job.drive_connected && canManage && (
                  <button onClick={syncNow} disabled={syncing}
                    className="ml-auto inline-flex items-center gap-1 rounded-md border border-[hsl(var(--hairline))] px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-[hsl(var(--muted))] disabled:opacity-50">
                    <RefreshCw size={12} className={syncing ? "animate-spin" : ""} /> {syncing ? "Menyinkron…" : "Sinkron sekarang"}
                  </button>
                )}
              </div>
              {job.drive?.error && <p className="mt-1 text-xs text-[#C9372C]">{job.drive.error}</p>}
              {(job.raw_folder_url || job.out_folder_url) && (
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  {job.raw_folder_url && <a href={job.raw_folder_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md bg-[hsl(var(--muted))] px-2 py-1 font-semibold text-foreground hover:underline"><Lock size={11} /> Folder data mentah</a>}
                  {job.out_folder_url && <a href={job.out_folder_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md bg-[hsl(var(--muted))] px-2 py-1 font-semibold text-foreground hover:underline"><FolderCheck size={11} /> Folder dokumen hasil</a>}
                  {job.notes_url && <a href={job.notes_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md bg-[hsl(var(--muted))] px-2 py-1 font-semibold text-foreground hover:underline"><FileText size={11} /> Catatan Klien</a>}
                </div>
              )}
            </div>

            {/* Kelengkapan */}
            <div>
              <div className="mb-2 flex items-center gap-2">
                <h3 className="font-bold text-foreground">Kelengkapan dokumen</h3>
                <DocBadge done={job.required_done} total={job.required_total} missing={job.missing} />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {job.checklist.map((t) => (
                  <span key={t.id} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                    t.count ? "border-[#94C748] bg-[#EFFFD6] text-[#37471F]" : "border-[hsl(var(--hairline))] text-3"
                  }`}>
                    {t.count ? <CheckCircle2 size={12} /> : <Circle size={12} />} {t.name}
                    {t.party_name && <span className="font-normal opacity-80">— {t.party_name} ({t.party_role})</span>}
                    {t.count > 1 ? ` ×${t.count}` : ""}
                    {!t.required && <span className="font-normal opacity-70">(opsional)</span>}
                  </span>
                ))}
              </div>
            </div>

            {/* File */}
            {grouped.length === 0 && <p className="rounded-lg bg-[hsl(var(--muted))] p-4 text-sm text-2">Belum ada file di pekerjaan ini.</p>}
            {grouped.map((g) => (
              <div key={g.key}>
                <h3 className="font-bold text-foreground">{g.label} <span className="font-normal text-3 text-sm">({g.files.length})</span></h3>
                {g.hint && <p className="text-xs text-3 mb-1.5">{g.hint}</p>}
                <div className="rounded-lg border border-[hsl(var(--hairline))] divide-y divide-[hsl(var(--hairline))]">
                  {g.files.map((f) => (
                    <div key={f.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                      <DriveBadge f={f} connected={job.drive_connected} />
                      <div className="min-w-0 flex-1">
                        <a href={`${API}/attachments/${f.id}/download`} target="_blank" rel="noreferrer" className="block truncate font-semibold text-foreground hover:underline" title={f.original_filename}>
                          {f.original_filename}
                        </a>
                        <div className="text-xs text-3 truncate">
                          {f.document_type_name && <span className="mr-1 rounded bg-[#E9F2FF] px-1.5 py-px font-semibold text-[#0055CC]">{f.document_type_name}</span>}
                          {f.uploaded_by_name || "—"} · {f.division_name || f.card_title} · {fmtDateTime(f.created_at)}
                        </div>
                        {f.drive_error && <div className="text-[11px] text-[#C9372C] truncate" title={f.drive_error}>Drive: {f.drive_error}</div>}
                      </div>
                      {f.drive_url && <a href={f.drive_url} target="_blank" rel="noreferrer" title="Buka di Google Drive" className="shrink-0 text-2 hover:text-foreground"><ExternalLink size={14} /></a>}
                      <span className="shrink-0 text-xs text-2 tabular-nums">{fmtBytes(f.size)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {job.links?.length > 0 && (
              <div>
                <h3 className="font-bold text-foreground mb-1.5">Tautan</h3>
                <ul className="text-sm space-y-1">
                  {job.links.map((l) => (
                    <li key={l.id}><a href={l.url} target="_blank" rel="noreferrer" className="text-[#0C66E4] hover:underline break-all">{l.original_filename}</a></li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <h3 className="font-bold text-foreground mb-1.5 flex items-center gap-1.5"><History size={15} /> Riwayat download</h3>
              {job.downloads.length === 0 ? (
                <p className="text-sm text-3">Belum pernah didownload.</p>
              ) : (
                <ul className="text-sm text-2 space-y-0.5">
                  {job.downloads.map((d) => (
                    <li key={d.id}>{fmtDateTime(d.created_at)} — <b className="text-foreground">{d.user_name}</b> ({d.file_count} file, {fmtBytes(d.total_bytes)})</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </aside>
      {openCard && <CardModal itemId={openCard} onClose={() => setOpenCard(null)} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  TAB: RIWAYAT DOWNLOAD
// ═══════════════════════════════════════════════════════════════════════
function DownloadsTab({ onOpenJob }) {
  const { data, isLoading } = useQuery({
    queryKey: ["archive-downloads"],
    queryFn: () => api.get("/archive/downloads").then((r) => r.data),
  });
  return (
    <div className="rounded-xl border border-[hsl(var(--hairline))] bg-[hsl(var(--elevated))] overflow-x-auto">
      <table className="w-full border-collapse text-sm min-w-[600px]">
        <thead className="bg-[hsl(var(--muted))] text-[12px] uppercase tracking-wide text-3">
          <tr>
            <th className="px-3 py-2 text-left">Waktu</th>
            <th className="px-3 py-2 text-left">Oleh</th>
            <th className="px-3 py-2 text-left">Pekerjaan</th>
            <th className="px-3 py-2 text-right">File</th>
            <th className="px-3 py-2 text-right">Ukuran</th>
          </tr>
        </thead>
        <tbody>
          {isLoading && <tr><td colSpan={5} className="p-4 text-2">Memuat…</td></tr>}
          {!isLoading && !data?.length && <tr><td colSpan={5} className="p-6 text-center text-2">Belum ada yang mendownload arsip.</td></tr>}
          {(data || []).map((d) => (
            <tr key={d.id} className="border-t border-[hsl(var(--hairline))]">
              <td className="px-3 py-2 whitespace-nowrap">{fmtDateTime(d.created_at)}</td>
              <td className="px-3 py-2 font-semibold">{d.user_name}</td>
              <td className="px-3 py-2"><button className="text-left hover:underline" onClick={() => onOpenJob(d.job_key)}>{d.job_title}</button></td>
              <td className="px-3 py-2 text-right tabular-nums">{d.file_count}</td>
              <td className="px-3 py-2 text-right tabular-nums">{fmtBytes(d.total_bytes)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  TAB: JENIS DOKUMEN (pengaturan)
// ═══════════════════════════════════════════════════════════════════════
function TypesTab() {
  const qc = useQueryClient();
  const { data: types } = useQuery({
    queryKey: ["document-types"],
    queryFn: () => api.get("/archive/document-types").then((r) => r.data),
  });
  const [form, setForm] = useState({ name: "", group: "KLIEN", required: false, per_party: false });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["document-types"] });
    qc.invalidateQueries({ queryKey: ["archive-summary"] });
    qc.invalidateQueries({ queryKey: ["archive-jobs"] });
  };
  const patch = async (id, body) => {
    try { await api.patch(`/archive/document-types/${id}`, body); refresh(); } catch (e) { toast.error(errMsg(e)); }
  };
  const add = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    try {
      await api.post("/archive/document-types", form);
      toast.success(`Jenis "${form.name}" ditambahkan`);
      setForm({ name: "", group: form.group, required: false, per_party: false });
      refresh();
    } catch (err) { toast.error(errMsg(err)); }
  };
  const inp = "h-[34px] rounded-md border border-[hsl(var(--hairline))] bg-[hsl(var(--surface))] px-2 text-sm text-foreground";

  return (
    <div className="space-y-4 max-w-[760px]">
      <p className="text-sm text-2">
        Jenis dokumen dipilih staff di setiap lampiran kartu. Jenis yang <b>wajib</b> dihitung di kolom
        &quot;Dokumen wajib&quot;. Grup menentukan tempatnya: <b>Dokumen dari Klien</b> &amp; <b>Lainnya</b> masuk folder
        data mentah (internal, tidak dibagikan); <b>Dokumen Hasil</b> masuk folder dokumen hasil, link-nya bisa dibuka klien
        dan dikirim ke dashboard sesuai kategorinya.
        <br />
        <b>Per pihak</b> = dokumen milik orang, bukan perusahaan (KTP, NPWP Pribadi). Kalau wajib, dihitung sekali untuk
        SETIAP pengurus yang didaftarkan di kartu — pendirian PT dengan direktur &amp; komisaris berarti 2 slot KTP dan
        2 slot NPWP Pribadi terpisah. Pihaknya didaftarkan staff di panel &quot;Kelengkapan Dokumen&quot; pada kartu.
      </p>
      <form onSubmit={add} className="flex flex-wrap items-center gap-2 rounded-xl border border-[hsl(var(--hairline))] bg-[hsl(var(--elevated))] p-3">
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nama jenis baru, mis. Surat Kuasa" className={`${inp} flex-1 min-w-[180px]`} />
        <select value={form.group} onChange={(e) => setForm({ ...form, group: e.target.value })} className={inp}>
          {GROUPS.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-2">
          <input type="checkbox" checked={form.required} onChange={(e) => setForm({ ...form, required: e.target.checked })} className="accent-[#0C66E4]" /> Wajib
        </label>
        <label className="flex items-center gap-1.5 text-sm text-2" title="Dokumen milik orang (KTP, NPWP Pribadi) — dihitung per pengurus">
          <input type="checkbox" checked={form.per_party} onChange={(e) => setForm({ ...form, per_party: e.target.checked })} className="accent-[#0C66E4]" /> Per pihak
        </label>
        <button className="inline-flex h-[34px] items-center gap-1 rounded-md bg-[#0C66E4] px-3 text-sm font-semibold text-white"><Plus size={14} /> Tambah</button>
      </form>

      <div className="rounded-xl border border-[hsl(var(--hairline))] bg-[hsl(var(--elevated))] overflow-x-auto">
        <table className="w-full border-collapse text-sm min-w-[760px]">
          <thead className="bg-[hsl(var(--muted))] text-[12px] uppercase tracking-wide text-3">
            <tr><th className="px-3 py-2 text-left">Nama</th><th className="px-3 py-2 text-left">Grup</th><th className="px-3 py-2 text-left">Kategori dashboard / subfolder</th><th className="px-3 py-2 text-center">Wajib</th><th className="px-3 py-2 text-center" title="Dokumen milik orang — dihitung sekali per pengurus">Per pihak</th><th className="px-3 py-2 text-center">Aktif</th></tr>
          </thead>
          <tbody>
            {(types || []).map((t) => (
              <tr key={t.id} className={`border-t border-[hsl(var(--hairline))] ${t.is_active ? "" : "opacity-50"}`}>
                <td className="px-3 py-1.5">
                  <input defaultValue={t.name} onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== t.name && patch(t.id, { name: e.target.value.trim() })}
                    className={`${inp} w-full`} />
                </td>
                <td className="px-3 py-1.5">
                  <select value={t.group} onChange={(e) => patch(t.id, { group: e.target.value })} className={inp}>
                    {GROUPS.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
                  </select>
                </td>
                <td className="px-3 py-1.5">
                  {t.group === "HASIL" ? (
                    <select value={t.dashboard_category || ""} onChange={(e) => patch(t.id, { dashboard_category: e.target.value || null })} className={inp} title="Tab di dashboard klien">
                      <option value="">—</option>
                      {DASH_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  ) : t.group === "KLIEN" ? (
                    <input defaultValue={t.subfolder || ""} placeholder="(tanpa subfolder)" title="Subfolder di folder data mentah, mis. Foto TTD"
                      onBlur={(e) => e.target.value.trim() !== (t.subfolder || "") && patch(t.id, { subfolder: e.target.value.trim() || null })} className={`${inp} w-full`} />
                  ) : <span className="text-3">—</span>}
                </td>
                <td className="px-3 py-1.5 text-center"><input type="checkbox" checked={t.required} onChange={(e) => patch(t.id, { required: e.target.checked })} className="h-4 w-4 accent-[#0C66E4]" /></td>
                <td className="px-3 py-1.5 text-center" title="Dokumen milik orang (KTP, NPWP Pribadi) — dihitung sekali per pengurus">
                  <input type="checkbox" checked={!!t.per_party} onChange={(e) => patch(t.id, { per_party: e.target.checked })} className="h-4 w-4 accent-[#0C66E4]" />
                </td>
                <td className="px-3 py-1.5 text-center"><input type="checkbox" checked={t.is_active} onChange={(e) => patch(t.id, { is_active: e.target.checked })} className="h-4 w-4 accent-[#0C66E4]" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-3">Jenis yang dinonaktifkan tidak muncul lagi di pilihan kartu, tapi file lama yang sudah ditandai tetap tersimpan dengan jenis itu.</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  TAB: INTEGRASI (Google Drive + dashboard klien)
// ═══════════════════════════════════════════════════════════════════════
function Step({ n, children }) {
  return (
    <li className="flex gap-2">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0C66E4] text-[11px] font-bold text-white">{n}</span>
      <span className="min-w-0">{children}</span>
    </li>
  );
}

function IntegrationsTab({ isSuper }) {
  const qc = useQueryClient();
  const { data, refetch, isLoading } = useQuery({
    queryKey: ["archive-integrations"],
    queryFn: () => api.get("/archive/integrations").then((r) => r.data),
    refetchInterval: 20000,
  });
  const [webhook, setWebhook] = useState(null);
  const [newKey, setNewKey] = useState(null);
  const [busy, setBusy] = useState(false);
  if (isLoading || !data) return <p className="text-2 text-sm">Memuat…</p>;
  const d = data.drive;
  const dash = data.dashboard;

  const act = async (fn, ok) => {
    setBusy(true);
    try { await fn(); if (ok) toast.success(ok); refetch(); qc.invalidateQueries({ queryKey: ["archive-jobs"] }); }
    catch (e) { toast.error(errMsg(e)); }
    finally { setBusy(false); }
  };
  const card = "rounded-xl border border-[hsl(var(--hairline))] bg-[hsl(var(--elevated))] p-4 space-y-3 text-sm";
  const btn = "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-50";
  const pct = d.quota?.limit ? Math.min(100, Math.round((d.quota.usage / d.quota.limit) * 100)) : null;

  return (
    <div className="grid lg:grid-cols-2 gap-4 items-start">
      {/* ── Google Drive ── */}
      <section className={card} data-testid="integration-drive">
        <h2 className="font-heading font-bold text-foreground flex items-center gap-2"><Cloud size={18} /> Google Drive</h2>
        {!d.configured ? (
          <div className="rounded-lg bg-[#FFF7D6] p-3 text-[#533F04]">
            <b>Belum disiapkan di server.</b> Isi <code>GOOGLE_CLIENT_ID</code> dan <code>GOOGLE_CLIENT_SECRET</code> di file <code>.env</code> server,
            lalu restart aplikasi. Panduan langkah demi langkah: <code>docs/ARSIP-GOOGLE-DRIVE.md</code>.
            <div className="mt-2 text-xs">Redirect URI yang didaftarkan di Google: <code className="break-all">{d.redirect_uri}</code></div>
          </div>
        ) : d.connected ? (
          <>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-[#DCFFF1] px-2 py-0.5 text-xs font-bold text-[#216E4E]"><CheckCircle2 size={12} /> Terhubung</span>
              <span className="font-semibold text-foreground">{d.email}</span>
            </div>
            {d.error && <p className="rounded-lg bg-[#FFECEB] p-2 text-[#AE2E24]">{d.error}</p>}
            {pct != null && (
              <div>
                <div className="flex justify-between text-xs text-2"><span>Kuota Google Drive</span><span>{fmtBytes(d.quota.usage)} / {fmtBytes(d.quota.limit)} ({pct}%)</span></div>
                <div className="mt-1 h-2 rounded-full bg-[hsl(var(--muted))]"><div className={`h-2 rounded-full ${pct > 90 ? "bg-[#C9372C]" : pct > 75 ? "bg-[#E56910]" : "bg-[#0C66E4]"}`} style={{ width: `${pct}%` }} /></div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-[hsl(var(--muted))] p-2"><div className="text-3">Menunggu dikirim</div><div className="text-lg font-bold text-foreground">{d.pending_files}</div></div>
              <div className="rounded-lg bg-[hsl(var(--muted))] p-2"><div className="text-3">Gagal</div><div className={`text-lg font-bold ${d.error_files ? "text-[#C9372C]" : "text-foreground"}`}>{d.error_files}</div></div>
            </div>
            <p className="text-xs text-3">Sinkron otomatis tiap 5 menit, dan ±5 detik setelah ada file baru. {d.last_sweep_at && `Terakhir: ${fmtDateTime(d.last_sweep_at)}.`}</p>
            <div className="flex flex-wrap gap-2 text-xs">
              {d.root_url && <a href={d.root_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md bg-[hsl(var(--muted))] px-2 py-1 font-semibold text-foreground hover:underline"><FolderCheck size={11} /> Folder arsip</a>}
              {d.raw_url && <a href={d.raw_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md bg-[hsl(var(--muted))] px-2 py-1 font-semibold text-foreground hover:underline"><Lock size={11} /> A. Data mentah</a>}
              {d.out_url && <a href={d.out_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md bg-[hsl(var(--muted))] px-2 py-1 font-semibold text-foreground hover:underline"><Link2 size={11} /> B. Dokumen hasil</a>}
            </div>
            <div className="flex flex-wrap gap-2">
              <button disabled={busy} onClick={() => act(() => api.post("/archive/drive/sync-all"), "Sinkron dimulai — cek lagi beberapa menit lagi")}
                className={`${btn} bg-[#0C66E4] text-white`}><RefreshCw size={14} /> Sinkron semua sekarang</button>
              {isSuper && (
                <button disabled={busy} onClick={() => window.confirm("Putuskan Google Drive? File yang sudah ada di Drive tetap aman, tapi file baru tidak dikirim lagi.") && act(() => api.post("/archive/drive/disconnect"), "Google Drive diputus")}
                  className={`${btn} border border-[hsl(var(--hairline))] text-foreground`}>Putuskan</button>
              )}
              {isSuper && <a href={`${API}/integrations/google/connect`} className={`${btn} border border-[hsl(var(--hairline))] text-foreground`}>Hubungkan ulang</a>}
            </div>
          </>
        ) : (
          <>
            {d.error && <p className="rounded-lg bg-[#FFECEB] p-2 text-[#AE2E24]">{d.error}</p>}
            <ol className="space-y-2 text-2">
              <Step n={1}>Klik tombol di bawah, lalu login dengan <b>info.akseslegal.id@gmail.com</b>.</Step>
              <Step n={2}>Izinkan akses. Aplikasi hanya bisa melihat file yang ia buat sendiri; folder lain di Drive Anda tidak tersentuh.</Step>
              <Step n={3}>Folder <b>AKSES LEGAL - ARSIP</b> otomatis dibuat, dan semua file lama mulai dikirim.</Step>
            </ol>
            {isSuper ? (
              <a href={`${API}/integrations/google/connect`} className={`${btn} bg-[#0C66E4] text-white w-fit`} data-testid="drive-connect"><Plug size={14} /> Hubungkan Google Drive</a>
            ) : (
              <p className="text-xs text-3">Hanya super admin yang bisa menghubungkan akun Google.</p>
            )}
          </>
        )}
        <details className="text-xs text-2">
          <summary className="cursor-pointer font-semibold">Susunan folder di Google Drive</summary>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-[hsl(var(--muted))] p-2 text-[11px] leading-relaxed">{`AKSES LEGAL - ARSIP/
├─ A. DATA MENTAH (INTERNAL)/   🔒 tidak dibagikan
│   ├─ _SEDANG BERJALAN/<Perusahaan - Layanan [AL-XXXXXX]>/
│   └─ 2026/02 - Februari/<...>/   ← dipindah saat FINISH
│        Catatan Klien, KTP - ..., NPWP - ..., Foto TTD/
└─ B. DOKUMEN HASIL (DASHBOARD KLIEN)/
    └─ 2026/02 - Februari/<...>/
         Akta Pendirian - PT X.pdf, SK ..., NPWP ..., NIB ...`}</pre>
        </details>
      </section>

      {/* ── Dashboard klien ── */}
      <section className={card} data-testid="integration-dashboard">
        <h2 className="font-heading font-bold text-foreground flex items-center gap-2"><Plug size={18} /> Dashboard Klien (akseslegal.id)</h2>
        <p className="text-2">
          Dashboard bisa <b>mengambil</b> daftar dokumen + link Drive lewat API, atau <b>menerima kiriman otomatis</b> (webhook)
          setiap pekerjaan selesai dan semua dokumen hasilnya sudah di Drive. Spesifikasi lengkap untuk developer dashboard: <code>docs/INTEGRASI-DASHBOARD.md</code>.
        </p>

        <div className="space-y-1">
          <div className="text-xs font-semibold text-3">API key</div>
          {newKey ? (
            <div className="rounded-lg border border-[#F5CD47] bg-[#FFF7D6] p-2 text-[#533F04]">
              <div className="text-xs font-semibold">Simpan sekarang — key ini hanya ditampilkan sekali:</div>
              <div className="mt-1 flex items-center gap-2">
                <code className="min-w-0 flex-1 break-all text-xs">{newKey}</code>
                <button onClick={() => copyText(newKey, "API key disalin")} className="shrink-0 rounded-md bg-[#533F04] px-2 py-1 text-xs font-semibold text-white"><Copy size={12} /></button>
              </div>
            </div>
          ) : (
            <div className="text-foreground">{dash.has_key ? <code>{dash.key_preview}</code> : <span className="text-3">Belum dibuat</span>}</div>
          )}
          {isSuper && (
            <button disabled={busy}
              onClick={() => (!dash.has_key || window.confirm("Buat API key baru? Key lama langsung tidak berlaku — dashboard harus memakai key baru.")) &&
                act(async () => { const r = await api.post("/archive/dashboard/key"); setNewKey(r.data.api_key); }, "API key dibuat")}
              className={`${btn} border border-[hsl(var(--hairline))] text-foreground`}><KeyRound size={14} /> {dash.has_key ? "Buat key baru" : "Buat API key"}</button>
          )}
        </div>

        <div className="space-y-1">
          <div className="text-xs font-semibold text-3">Alamat API (untuk dashboard mengambil data)</div>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded-md bg-[hsl(var(--muted))] px-2 py-1 text-xs">{dash.api_base}/companies</code>
            <button onClick={() => copyText(`${dash.api_base}/companies`, "Alamat API disalin")} className="shrink-0 rounded-md border border-[hsl(var(--hairline))] px-2 py-1 text-xs"><Copy size={12} /></button>
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-xs font-semibold text-3">Webhook dashboard (opsional — kiriman otomatis)</div>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); act(() => api.put("/archive/dashboard/webhook", { url: webhook ?? dash.webhook_url ?? "" }), "Webhook disimpan"); }}>
            <input value={webhook ?? dash.webhook_url ?? ""} onChange={(e) => setWebhook(e.target.value)} disabled={!isSuper}
              placeholder="https://akseslegal.id/api/giant-webhook"
              className="h-9 min-w-0 flex-1 rounded-md border border-[hsl(var(--hairline))] bg-[hsl(var(--surface))] px-2 text-sm" />
            {isSuper && <button disabled={busy} className={`${btn} bg-[#0C66E4] text-white`}>Simpan</button>}
          </form>
          {isSuper && dash.webhook_url && (
            <button disabled={busy} onClick={() => act(() => api.post("/archive/dashboard/test"), "Dashboard menjawab — webhook berfungsi")}
              className="text-xs text-[#0C66E4] underline">Kirim tes</button>
          )}
          {dash.last_push_at && <p className="text-xs text-2">Kiriman terakhir: {fmtDateTime(dash.last_push_at)}</p>}
          {dash.last_push_error && <p className="text-xs text-[#C9372C]">Error terakhir: {dash.last_push_error}</p>}
        </div>
      </section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  HALAMAN
// ═══════════════════════════════════════════════════════════════════════
export default function Archive() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState(() => params.get("tab") || "ringkasan");
  const [filters, setFilters] = useState({});
  const [openJob, setOpenJob] = useState(null);

  const { data: myPerms, isLoading } = useQuery({
    queryKey: ["my-permissions"],
    queryFn: () => api.get("/my-permissions").then((r) => r.data),
  });
  const perms = new Set(myPerms?.permissions || []);
  const isSuper = user?.role === "super_admin";
  const canView = isSuper || perms.has("archive.view");
  const canDownload = isSuper || perms.has("archive.download");
  const canManage = isSuper || perms.has("archive.manage");

  // Kembali dari halaman izin Google (?drive=ok|error) → beri tahu hasilnya sekali.
  useEffect(() => {
    const d = params.get("drive");
    if (!d) return;
    if (d === "ok") toast.success("Google Drive terhubung — file mulai dikirim ke Drive");
    else toast.error(`Gagal menghubungkan Google Drive${params.get("msg") ? `: ${params.get("msg")}` : ""}`);
    setParams({ tab: params.get("tab") || "integrasi" }, { replace: true });
  }, [params, setParams]);

  if (isLoading) return <p className="p-10 text-2">Memuat…</p>;
  if (!canView) {
    return (
      <div className="p-10 text-center" data-testid="archive-forbidden">
        <p className="text-2">Halaman Arsip hanya untuk super admin / peran dengan izin &quot;Buka halaman Arsip &amp; Backup&quot;.</p>
      </div>
    );
  }

  const tabs = [
    { id: "ringkasan", label: "Ringkasan" },
    { id: "pekerjaan", label: "Daftar Pekerjaan" },
    { id: "riwayat", label: "Riwayat Download" },
    ...(canManage ? [{ id: "jenis", label: "Jenis Dokumen" }, { id: "integrasi", label: "Integrasi Drive & Dashboard" }] : []),
  ];

  return (
    <div className="mx-auto max-w-[1200px] p-5 sm:p-7 space-y-5" data-testid="archive-page">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2"><ArchiveIcon size={24} /> Arsip Dokumen</h1>
        <p className="text-sm text-2 mt-1">
          Semua file per pekerjaan (KTP, NPWP, Akta, SK, NIB, …), kelengkapannya, dan pemakaian penyimpanan. Download satu pekerjaan sekaligus dalam satu ZIP yang sudah tersusun rapi.
        </p>
      </div>

      <div className="flex border-b border-[hsl(var(--hairline))] overflow-x-auto">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} data-testid={`archive-tab-${t.id}`}
            className={`px-4 py-2 font-semibold text-sm border-b-2 whitespace-nowrap transition-colors ${
              tab === t.id ? "border-[#0C66E4] text-[#0C66E4]" : "border-transparent text-2 hover:text-foreground"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "ringkasan" && <SummaryTab onOpenJob={setOpenJob} onFilter={(f) => { setFilters(f); setTab("pekerjaan"); }} />}
      {tab === "pekerjaan" && <JobsTab filters={filters} setFilters={setFilters} onOpenJob={setOpenJob} canDownload={canDownload} />}
      {tab === "riwayat" && <DownloadsTab onOpenJob={setOpenJob} />}
      {tab === "jenis" && canManage && <TypesTab />}
      {tab === "integrasi" && canManage && <IntegrationsTab isSuper={isSuper} />}

      {openJob && (
        <JobDrawer key={openJob} jobKey={openJob} onClose={() => setOpenJob(null)} onKeyChange={setOpenJob}
          canDownload={canDownload} canManage={canManage} />
      )}
    </div>
  );
}
