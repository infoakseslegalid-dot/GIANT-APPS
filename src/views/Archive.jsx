import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip } from "recharts";
import {
  Archive as ArchiveIcon, HardDrive, Files, FolderCheck, AlertTriangle, Download, X, Search,
  ExternalLink, Phone, CheckCircle2, Circle, Plus, History, Tags, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { api, errMsg, fmtDateTime, API } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import CardModal from "../components/kanban/CardModalWrapper";

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
            placeholder="Cari pekerjaan, klien, no. telepon…" data-testid="archive-search"
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
        <table className="w-full border-collapse text-sm min-w-[820px]">
          <thead className="bg-[hsl(var(--muted))] text-[12px] uppercase tracking-wide text-3">
            <tr>
              <th className="px-3 py-2 text-left">Pekerjaan</th>
              <th className="px-3 py-2 text-left">Klien</th>
              <th className="px-3 py-2 text-left">Dokumen wajib</th>
              <th className="px-3 py-2 text-right">File</th>
              <th className="px-3 py-2 text-right">Ukuran</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={7} className="p-4 text-2">Memuat…</td></tr>}
            {!isLoading && !jobs?.length && <tr><td colSpan={7} className="p-6 text-center text-2">Tidak ada pekerjaan yang cocok.</td></tr>}
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
function JobDrawer({ jobKey, onClose, canDownload, canManage, onKeyChange }) {
  const qc = useQueryClient();
  const [openCard, setOpenCard] = useState(null);
  const [phone, setPhone] = useState(null); // null = tidak sedang diedit
  const { data: job, isLoading } = useQuery({
    queryKey: ["archive-job", jobKey],
    queryFn: () => api.get(`/archive/jobs/${encodeURIComponent(jobKey)}`).then((r) => r.data),
  });

  const savePhone = async () => {
    try {
      const r = await api.patch(`/archive/jobs/${encodeURIComponent(jobKey)}`, { client_phone: phone });
      toast.success("No. telepon klien disimpan");
      setPhone(null);
      qc.invalidateQueries({ queryKey: ["archive-jobs"] });
      if (r.data.key && r.data.key !== jobKey) onKeyChange(r.data.key);
      else qc.invalidateQueries({ queryKey: ["archive-job", jobKey] });
    } catch (e) { toast.error(errMsg(e)); }
  };

  const grouped = useMemo(() => {
    const files = job?.files || [];
    return [
      ...GROUPS.map((g) => ({ ...g, files: files.filter((f) => f.document_group === g.key) })),
      { key: "NONE", label: "Belum ditandai jenisnya", hint: "masuk folder \"File Lainnya\" saat di-download", files: files.filter((f) => !f.document_group) },
    ].filter((g) => g.files.length);
  }, [job]);

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/40" onClick={onClose}>
      <aside
        className="h-full w-full max-w-[720px] overflow-y-auto bg-[hsl(var(--surface))] shadow-2xl"
        onClick={(e) => e.stopPropagation()} data-testid="archive-job-drawer"
      >
        {isLoading || !job ? (
          <p className="p-6 text-2">Memuat…</p>
        ) : (
          <div className="p-5 space-y-5">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="font-heading text-xl font-bold text-foreground break-words">{job.title}</h2>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-2">
                  <StatusBadge done={job.done} />
                  <span>{job.file_count} file · {fmtBytes(job.total_bytes)}</span>
                  {job.divisions?.length > 0 && <span>· {job.divisions.map((d) => d.name).join(", ")}</span>}
                </div>
              </div>
              <button onClick={onClose} className="rounded-md p-1.5 text-2 hover:bg-[hsl(var(--muted))]" aria-label="Tutup"><X size={18} /></button>
            </div>

            <div className="flex flex-wrap gap-2">
              {canDownload && job.file_count > 0 && (
                <a href={downloadUrl(job.key)} onClick={() => setTimeout(() => qc.invalidateQueries({ queryKey: ["archive-job", jobKey] }), 3000)}
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

            {/* Data klien */}
            <div className="grid sm:grid-cols-3 gap-3 rounded-xl border border-[hsl(var(--hairline))] bg-[hsl(var(--elevated))] p-4 text-sm">
              <div><div className="text-xs text-3">Klien</div><div className="font-semibold text-foreground">{job.client || "—"}</div></div>
              <div>
                <div className="text-xs text-3 flex items-center gap-1"><Phone size={11} /> No. telepon / WA</div>
                {phone === null ? (
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">{job.client_phone || "—"}</span>
                    {canManage && <button className="text-xs text-[#0C66E4] underline" onClick={() => setPhone(job.client_phone || "")}>ubah</button>}
                  </div>
                ) : (
                  <form className="flex items-center gap-1 mt-0.5" onSubmit={(e) => { e.preventDefault(); savePhone(); }}>
                    <input autoFocus value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08xx…"
                      className="h-8 w-full min-w-0 rounded-md border border-[hsl(var(--hairline))] bg-[hsl(var(--surface))] px-2 text-sm" />
                    <button className="h-8 rounded-md bg-[#0C66E4] px-2 text-xs font-semibold text-white">Simpan</button>
                    <button type="button" className="h-8 px-1 text-xs text-2" onClick={() => setPhone(null)}>Batal</button>
                  </form>
                )}
              </div>
              <div><div className="text-xs text-3">Owner (CS)</div><div className="font-semibold text-foreground">{job.owner_name || "—"}</div></div>
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
                    {t.count ? <CheckCircle2 size={12} /> : <Circle size={12} />} {t.name}{t.count > 1 ? ` ×${t.count}` : ""}
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
                      <div className="min-w-0 flex-1">
                        <a href={`${API}/attachments/${f.id}/download`} target="_blank" rel="noreferrer" className="block truncate font-semibold text-foreground hover:underline" title={f.original_filename}>
                          {f.original_filename}
                        </a>
                        <div className="text-xs text-3 truncate">
                          {f.document_type_name && <span className="mr-1 rounded bg-[#E9F2FF] px-1.5 py-px font-semibold text-[#0055CC]">{f.document_type_name}</span>}
                          {f.uploaded_by_name || "—"} · {f.division_name || f.card_title} · {fmtDateTime(f.created_at)}
                        </div>
                      </div>
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
  const [form, setForm] = useState({ name: "", group: "KLIEN", required: false });
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
      setForm({ name: "", group: form.group, required: false });
      refresh();
    } catch (err) { toast.error(errMsg(err)); }
  };
  const inp = "h-[34px] rounded-md border border-[hsl(var(--hairline))] bg-[hsl(var(--surface))] px-2 text-sm text-foreground";

  return (
    <div className="space-y-4 max-w-[760px]">
      <p className="text-sm text-2">
        Jenis dokumen dipilih staff di setiap lampiran kartu. Jenis yang <b>wajib</b> dihitung di kolom
        &quot;Dokumen wajib&quot;. Grup menentukan folder saat di-download: <i>1. Dokumen Klien</i>, <i>2. Dokumen Hasil</i>, atau <i>3. File Lainnya</i>.
      </p>
      <form onSubmit={add} className="flex flex-wrap items-center gap-2 rounded-xl border border-[hsl(var(--hairline))] bg-[hsl(var(--elevated))] p-3">
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nama jenis baru, mis. Surat Kuasa" className={`${inp} flex-1 min-w-[180px]`} />
        <select value={form.group} onChange={(e) => setForm({ ...form, group: e.target.value })} className={inp}>
          {GROUPS.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-2">
          <input type="checkbox" checked={form.required} onChange={(e) => setForm({ ...form, required: e.target.checked })} className="accent-[#0C66E4]" /> Wajib
        </label>
        <button className="inline-flex h-[34px] items-center gap-1 rounded-md bg-[#0C66E4] px-3 text-sm font-semibold text-white"><Plus size={14} /> Tambah</button>
      </form>

      <div className="rounded-xl border border-[hsl(var(--hairline))] bg-[hsl(var(--elevated))] overflow-x-auto">
        <table className="w-full border-collapse text-sm min-w-[520px]">
          <thead className="bg-[hsl(var(--muted))] text-[12px] uppercase tracking-wide text-3">
            <tr><th className="px-3 py-2 text-left">Nama</th><th className="px-3 py-2 text-left">Grup</th><th className="px-3 py-2 text-center">Wajib</th><th className="px-3 py-2 text-center">Aktif</th></tr>
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
                <td className="px-3 py-1.5 text-center"><input type="checkbox" checked={t.required} onChange={(e) => patch(t.id, { required: e.target.checked })} className="h-4 w-4 accent-[#0C66E4]" /></td>
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
//  HALAMAN
// ═══════════════════════════════════════════════════════════════════════
export default function Archive() {
  const { user } = useAuth();
  const [tab, setTab] = useState("ringkasan");
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
    ...(canManage ? [{ id: "jenis", label: "Jenis Dokumen" }] : []),
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

      {openJob && (
        <JobDrawer key={openJob} jobKey={openJob} onClose={() => setOpenJob(null)} onKeyChange={setOpenJob}
          canDownload={canDownload} canManage={canManage} />
      )}
    </div>
  );
}
