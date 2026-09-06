import { useState, useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RTooltip, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, ComposedChart } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, Wallet, CheckCircle2, Clock, AlertTriangle, X, ArrowUpNarrowWide, ArrowUp, ArrowDown, ListChecks, Users2, Timer } from "lucide-react";
import { api, fmtDate } from "../lib/api";
import CardModal from "../components/kanban/CardModalWrapper";

const rp = (n) =>
  (n == null || isNaN(n)) ? "—" : "Rp " + Math.round(n).toLocaleString("id-ID");

/** Badge kecil naik/turun vs periode sebelumnya. pct: number | null (null = tidak ada pembanding). */
function DeltaBadge({ pct }) {
  if (pct == null) return <span className="text-[11px] text-slate-400 font-semibold">— vs periode lalu</span>;
  const up = pct > 0;
  const flat = pct === 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${flat ? "text-slate-400" : up ? "text-green-600" : "text-red-500"}`}>
      {!flat && (up ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
      {flat ? "0%" : `${Math.abs(pct)}%`} <span className="font-normal text-slate-400">vs lalu</span>
    </span>
  );
}

const PERIODS = [
  { key: "day", label: "Harian" },
  { key: "week", label: "Mingguan" },
  { key: "month", label: "Bulanan" },
];

function StatCard({ icon, label, value, sub, tone = "slate" }) {
  const tones = {
    green: "text-[#1F845A]",
    blue: "text-[#0C66E4]",
    amber: "text-[#B65C02]",
    slate: "text-foreground",
    red: "text-[#C9372C]",
  };
  return (
    <div className="rounded-xl border border-[hsl(var(--hairline))] bg-[hsl(var(--elevated))] p-4 flex flex-col gap-1">
      <div className="flex items-center gap-2 text-2 text-[13px] font-semibold">
        {icon} {label}
      </div>
      <div className={`text-2xl font-bold ${tones[tone]}`}>{value}</div>
      {sub && <div className="text-xs text-3">{sub}</div>}
    </div>
  );
}

function Th({ children, className = "" }) {
  return (
    <th className={`px-3 py-2 text-left text-[12px] font-bold uppercase tracking-wide text-3 ${className}`}>
      {children}
    </th>
  );
}
function Td({ children, className = "" }) {
  return <td className={`px-3 py-2 text-sm text-foreground ${className}`}>{children}</td>;
}

export default function Reports() {
  const [period, setPeriod] = useState("day");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [activeTab, setActiveTab] = useState("eksekutif");
  const [openUser, setOpenUser] = useState(null);
  const [openCard, setOpenCard] = useState(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["reports-overview", period, date],
    queryFn: () =>
      api.get("/reports/overview", { params: { period, date } }).then((r) => r.data),
    retry: false,
  });

  if (isError) {
    return (
      <div className="p-10 text-center" data-testid="reports-forbidden">
        <p className="text-2">Halaman ini hanya untuk super admin / peran dengan izin &quot;Rekap &amp; Performa&quot;.</p>
      </div>
    );
  }

  const fin = data?.finance;

  return (
    <div className="mx-auto max-w-[1200px] p-5 sm:p-7 space-y-6" data-testid="reports-page">
      {/* Header + filter */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
            <TrendingUp size={24} /> Rekap &amp; Performa
          </h1>
          <p className="text-sm text-2 mt-1">
            Performa per user &amp; divisi, uang masuk, dan pantauan CS. Semua angka mengikuti periode terpilih.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-[hsl(var(--hairline))] overflow-hidden">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                data-testid={`period-${p.key}`}
                onClick={() => setPeriod(p.key)}
                className={`px-3.5 py-2 text-sm font-semibold transition-colors ${
                  period === p.key
                    ? "bg-[#0C66E4] text-white"
                    : "bg-[hsl(var(--elevated))] text-2 hover:bg-[hsl(var(--muted))]"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            data-testid="reports-date"
            className="h-[38px] rounded-lg border border-[hsl(var(--hairline))] bg-[hsl(var(--surface))] px-3 text-sm text-foreground"
          />
        </div>
      </div>

      
      {/* TABS */}
      <div className="flex border-b border-[hsl(var(--hairline))] mb-4">
        {[{id: "eksekutif", label: "Ringkasan Eksekutif (BOS)"}, {id: "ringkasan", label: "Ringkasan / Overview"}, {id: "per_orang", label: "Per Orang (Leaderboard)"}, {id: "kelengkapan", label: "Kelengkapan Dokumen"}, {id: "data_cs", label: "Data CS"}].map(t => (
           <button 
             key={t.id} 
             onClick={() => setActiveTab(t.id)} 
             className={`px-4 py-2 font-semibold text-sm border-b-2 transition-colors ${activeTab === t.id ? "border-[#0C66E4] text-[#0C66E4]" : "border-transparent text-slate-500 hover:text-slate-800"}`}
           >
              {t.label}
           </button>
        ))}
      </div>
      
      {isLoading ? (

        <p className="text-2 text-sm">Memuat…</p>
      ) : (
        <>
          
          
          {activeTab === "eksekutif" && (
            <div className="space-y-6">
              {/* Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                 <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm border-t-4 border-t-blue-600">
                    <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2 flex justify-between">Total Omzet <TrendingUp size={14} className="text-blue-500"/></div>
                    <div className="text-2xl lg:text-3xl font-extrabold text-slate-900">{rp(fin?.total_in)}</div>
                    <div className="text-xs text-slate-500 mt-2 flex items-center justify-between">
                      <span><span className="text-green-600 font-bold">+{fin?.count_lunas_period || 0}</span> Job Lunas</span>
                      <DeltaBadge pct={data?.compare_prev?.total_in_pct} />
                    </div>
                 </div>
                 <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm border-t-4 border-t-red-500">
                    <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2 flex justify-between">Total Piutang <AlertTriangle size={14} className="text-red-500"/></div>
                    <div className="text-2xl lg:text-3xl font-extrabold text-slate-900">{rp(fin?.total_piutang)}</div>
                    <div className="text-xs text-slate-500 mt-2">
                      <span className="text-red-500 font-bold">{fin?.piutang_cards || 0}</span> job DP/belum bayar
                      {fin?.aging?.[3]?.count > 0 && <span className="ml-1 text-red-600 font-semibold">· {fin.aging[3].count} &gt;30 hari!</span>}
                    </div>
                 </div>
                 <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm border-t-4 border-t-green-600">
                    <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2 flex justify-between">Pekerjaan Selesai <CheckCircle2 size={14} className="text-green-500"/></div>
                    <div className="text-2xl lg:text-3xl font-extrabold text-slate-900">
                      {data?.compare_prev?.done_period_total ?? 0} <span className="text-sm font-normal text-slate-500">job</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-2 flex items-center justify-between">
                      <span>Dikerjakan periode ini</span>
                      <DeltaBadge pct={data?.compare_prev?.done_period_pct} />
                    </div>
                 </div>
                 <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm border-t-4 border-t-amber-500">
                    <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2 flex justify-between">Klien Mandek <Clock size={14} className="text-amber-500"/></div>
                    <div className="text-2xl lg:text-3xl font-extrabold text-slate-900">{data?.cs?.stuck?.length || 0} <span className="text-sm font-normal text-slate-500">lead</span></div>
                    <div className="text-xs text-slate-500 mt-2">Melewati ambang batas SOP CS</div>
                 </div>
              </div>

              {/* Main Charts Row */}
              <div className="grid lg:grid-cols-2 gap-4">
                 {/* Trend Uang vs Pekerjaan */}
                 <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                    <h3 className="font-bold text-slate-800 mb-1">Tren Omzet vs Pekerjaan Selesai</h3>
                    <p className="text-xs text-slate-500 mb-6">Pemasukan harian vs jumlah pekerjaan yang benar-benar diselesaikan tim, hari yang sama.</p>
                    <div className="h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={
                          (fin?.by_day || []).map((d) => ({
                             date: d.date.slice(5),
                             omzet: d.amount,
                             selesai: d.done || 0,
                          }))
                        }>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="date" tick={{fontSize: 10}} />
                          <YAxis yAxisId="left" tick={{fontSize: 10}} tickFormatter={(v) => (Number(v || 0)/1000000).toFixed(0)+"jt"} />
                          <YAxis yAxisId="right" orientation="right" tick={{fontSize: 10}} allowDecimals={false} />
                          <RTooltip formatter={(v, name) => name === "omzet" ? rp(v) : (Number(v) || 0)} />
                          <Bar yAxisId="left" dataKey="omzet" fill="#3b82f6" radius={[4,4,0,0]} name="Uang Masuk" />
                          <Line yAxisId="right" type="monotone" dataKey="selesai" stroke="#16a34a" strokeWidth={3} name="Job Selesai" />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                 </div>

                 {/* Beban Kerja vs Produktivitas Divisi */}
                 <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                    <h3 className="font-bold text-slate-800 mb-1">Peta Beban Kerja Divisi</h3>
                    <p className="text-xs text-slate-500 mb-6">Mengukur seberapa banyak antrean kerjaan dibandingkan yang sudah diselesaikan.</p>
                    <div className="h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data?.by_division || []} layout="vertical" margin={{ top: 0, right: 0, left: 30, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                          <XAxis type="number" tick={{fontSize: 10}} />
                          <YAxis type="category" dataKey="name" tick={{fontSize: 10, width: 80}} width={80} />
                          <RTooltip />
                          <Bar dataKey="list" stackId="a" fill="#cbd5e1" name="List (Antre)" />
                          <Bar dataKey="doing" stackId="a" fill="#f59e0b" name="Doing (Proses)" />
                          <Bar dataKey="done_now" stackId="a" fill="#16a34a" name="Finish (Selesai)" radius={[0,4,4,0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                 </div>
              </div>

              {/* Bottom Row: Top/Bottom Performance */}
              <div className="grid lg:grid-cols-2 gap-4">
                 <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
                       <h3 className="font-bold text-slate-800">🏆 Top 3 Performa Tertinggi</h3>
                    </div>
                    <div>
                       {(data?.by_user || []).slice(0,3).map((u, i) => (
                          <div key={u.user_id} className="flex justify-between items-center p-4 border-b border-slate-50">
                             <div className="flex items-center gap-3">
                                <div className="text-2xl">{["🥇","🥈","🥉"][i]}</div>
                                <div>
                                   <div className="font-bold text-sm text-slate-800">{u.name.toUpperCase()}</div>
                                   <div className="text-xs text-slate-500">{u.division_name || "—"}</div>
                                </div>
                             </div>
                             <div className="text-right">
                                <div className="font-bold text-sm text-green-700">{rp(u.revenue_period)}</div>
                                <div className="text-xs text-slate-500">{u.done_now} Job Selesai</div>
                             </div>
                          </div>
                       ))}
                    </div>
                 </div>

                 <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
                       <h3 className="font-bold text-slate-800">⚠️ Evaluasi Kinerja (Bottom 3)</h3>
                    </div>
                    <div>
                       {[...(data?.by_user || [])].reverse().filter(u => u.cards_total > 0).slice(0,3).map((u, i) => (
                          <div key={u.user_id} className="flex justify-between items-center p-4 border-b border-slate-50">
                             <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-xs font-bold">{i+1}</div>
                                <div>
                                   <div className="font-bold text-sm text-slate-800">{u.name.toUpperCase()}</div>
                                   <div className="text-xs text-slate-500">{u.division_name || "—"}</div>
                                </div>
                             </div>
                             <div className="text-right">
                                <div className="font-bold text-sm text-amber-600">{u.doing} Doing, {u.list} List</div>
                                <div className="text-xs text-slate-500">Hanya {u.done_now} Selesai</div>
                             </div>
                          </div>
                       ))}
                    </div>
                 </div>
              </div>

              {/* Top Klien & Titik Macet per Tahap */}
              <div className="grid lg:grid-cols-2 gap-4">
                 <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
                       <h3 className="font-bold text-slate-800 flex items-center gap-2"><Users2 size={15} /> Top Klien (Omzet Tertinggi)</h3>
                    </div>
                    <div>
                       {(data?.top_clients || []).length === 0 && <p className="p-4 text-sm text-slate-500">Belum ada data klien.</p>}
                       {(data?.top_clients || []).slice(0, 8).map((cl, i) => (
                          <div key={cl.client} className="flex justify-between items-center px-4 py-2.5 border-b border-slate-50 last:border-b-0">
                             <div className="flex items-center gap-2.5 min-w-0">
                                <span className="w-5 text-xs font-bold text-slate-400 shrink-0">{i + 1}</span>
                                <span className="font-semibold text-sm text-slate-800 truncate">{cl.client}</span>
                             </div>
                             <div className="text-right shrink-0 pl-2">
                                <div className="font-bold text-sm text-green-700">{rp(cl.revenue_total)}</div>
                                <div className="text-[11px] text-slate-500">{cl.jobs_count} job</div>
                             </div>
                          </div>
                       ))}
                    </div>
                 </div>

                 <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
                       <h3 className="font-bold text-slate-800 flex items-center gap-2"><Timer size={15} /> Titik Macet per Tahap (List)</h3>
                    </div>
                    <div className="p-3 h-[260px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data?.stage_bottleneck || []} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                          <XAxis type="number" tick={{fontSize: 10}} tickFormatter={(v) => `${v}h`} />
                          <YAxis type="category" dataKey="list_name" tick={{fontSize: 10}} width={110} />
                          <RTooltip formatter={(v, name) => name === "avg_days" ? [`${v} hari`, "Rata-rata umur"] : [v, "Jumlah kartu"]} />
                          <Bar dataKey="avg_days" fill="#f59e0b" radius={[0,4,4,0]} name="avg_days" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="px-4 pb-3 text-[11px] text-slate-400">Rata-rata umur kartu AKTIF (belum selesai) yang sedang diam di tahap itu — lintas board dengan nama list sama.</p>
                 </div>
              </div>
            </div>
          )}

          {activeTab === "ringkasan" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard icon={<Wallet size={15} />} label="Uang masuk (periode)" value={rp(fin?.total_in)} sub={`${(fin?.by_day || []).length} hari ada transaksi`} tone="green" />
                <StatCard icon={<CheckCircle2 size={15} />} label="Job jadi LUNAS (periode)" value={fin?.count_lunas_period ?? 0} sub={`Total lunas keseluruhan: ${fin?.count_lunas_total ?? 0}`} tone="blue" />
                <StatCard icon={<Clock size={15} />} label="Job masih DP" value={fin?.count_dp ?? 0} sub="Sudah bayar sebagian" tone="amber" />
                <StatCard icon={<AlertTriangle size={15} />} label="Job belum bayar" value={fin?.count_belum ?? 0} sub="Harga sudah diisi, Rp 0 masuk" tone="red" />
              </div>

              {/* Corong pembayaran */}
              <div className="grid grid-cols-2 gap-3">
                <StatCard icon={<Timer size={15} />} label="Rata-rata DP → Lunas" value={fin?.avg_days_dp_to_lunas != null ? `${fin.avg_days_dp_to_lunas} hari` : "—"} sub="Sejak pembayaran pertama sampai lunas" tone="blue" />
                <StatCard icon={<CheckCircle2 size={15} />} label="Tingkat konversi Lunas" value={fin?.lunas_conversion_pct != null ? `${fin.lunas_conversion_pct}%` : "—"} sub="dari seluruh job berharga (belum+DP+lunas)" tone="green" />
              </div>

              {/* Umur piutang (aging) */}
              <section className="rounded-xl border border-[hsl(var(--hairline))] bg-[hsl(var(--elevated))] overflow-hidden">
                <header className="px-4 py-3 border-b border-[hsl(var(--hairline))]">
                  <h2 className="font-heading font-bold text-foreground">Umur Piutang (Aging)</h2>
                  <p className="text-xs text-2 mt-0.5">Sejak pembayaran terakhir masuk (atau sejak harga diisi kalau belum pernah dibayar).</p>
                </header>
                <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-[hsl(var(--hairline))]">
                  {(fin?.aging || []).map((a) => (
                    <div key={a.bucket} className={`p-4 ${a.bucket === ">30 hari" && a.count > 0 ? "bg-[#FFECEB]" : ""}`}>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-3">{a.bucket}</div>
                      <div className={`text-xl font-bold mt-1 ${a.bucket === ">30 hari" && a.count > 0 ? "text-[#C9372C]" : "text-foreground"}`}>{a.count}</div>
                      <div className="text-xs text-3">{rp(a.amount)}</div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-xl border border-[hsl(var(--hairline))] bg-[hsl(var(--elevated))] overflow-hidden">
                <header className="px-4 py-3 border-b border-[hsl(var(--hairline))]">
                  <h2 className="font-heading font-bold text-foreground">Performa per Divisi</h2>
                </header>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead className="bg-[hsl(var(--muted))]">
                      <tr><Th>Divisi</Th><Th className="text-right">Anggota</Th><Th className="text-right">Total kartu</Th><Th className="text-right">List</Th><Th className="text-right">Doing</Th><Th className="text-right">Done (skrg)</Th><Th className="text-right">Selesai (periode)</Th><Th className="text-right">Omzet (periode)</Th></tr>
                    </thead>
                    <tbody>
                      {(data?.by_division || []).map((d) => (
                        <tr key={d.division_id || "none"} className="border-t border-[hsl(var(--hairline))]">
                          <Td className="font-semibold">{d.name}</Td><Td className="text-right">{d.users}</Td><Td className="text-right">{d.cards_total}</Td><Td className="text-right">{d.list}</Td><Td className="text-right">{d.doing}</Td><Td className="text-right">{d.done_now}</Td><Td className="text-right text-[#1F845A] font-semibold">{d.done_period}</Td><Td className="text-right font-semibold">{rp(d.revenue_period)}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}


          {activeTab === "per_orang" && (
            <div className="space-y-6">
              <section className="rounded-xl border border-[hsl(var(--hairline))] bg-white overflow-hidden shadow-sm">
                <header className="px-4 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                  <h2 className="font-bold text-slate-800 flex items-center gap-2">🏅 Leaderboard Karyawan</h2>
                  <div className="flex gap-2 text-xs">
                     <span className="px-2 py-1 bg-white border rounded text-slate-600">Selesai terbanyak</span>
                     <span className="px-2 py-1 bg-white border rounded text-slate-600">% tertinggi</span>
                  </div>
                </header>
                <div className="overflow-x-auto p-4">
                  <table className="w-full border-collapse text-sm">
                    <thead className="text-xs text-slate-400 uppercase tracking-wider border-b-2">
                      <tr>
                        <th className="py-3 text-left w-8">#</th>
                        <th className="py-3 text-left">NAMA</th>
                        <th className="py-3 text-left">DIVISI</th>
                        <th className="py-3 text-right">TOTAL</th>
                        <th className="py-3 text-right">FINISH</th>
                        <th className="py-3 text-right" title="Job yang dibuka kembali setelah ditandai selesai, periode ini">KERJA ULANG</th>
                        <th className="py-3 text-left pl-8 w-48">COMPLETION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.by_user || []).map((u, i) => {
                        const pct = u.cards_total ? Math.round((u.done_now / u.cards_total) * 100) : 0;
                        return (
                          <tr key={u.user_id} onClick={() => setOpenUser(u.user_id)} className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer">
                            <td className="py-3 font-semibold text-slate-500">{i < 3 ? ["🥇","🥈","🥉"][i] : i+1}</td>
                            <td className="py-3 font-bold text-slate-800">{u.name?.toUpperCase()}</td>
                            <td className="py-3 text-slate-500">{u.division_name || "—"}</td>
                            <td className="py-3 text-right font-semibold">{u.cards_total}</td>
                            <td className="py-3 text-right font-bold text-green-700">{u.done_now}</td>
                            <td className={`py-3 text-right font-semibold ${u.rework_count > 0 ? "text-amber-600" : "text-slate-300"}`}>{u.rework_count || 0}</td>
                            <td className="py-3 pl-8">
                               <div className="flex items-center gap-2">
                                 <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                   <div className="h-full bg-green-600" style={{ width: `${pct}%` }}></div>
                                 </div>
                                 <span className="text-xs font-semibold text-slate-600 w-8">{pct}%</span>
                               </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              <section>
                <h3 className="font-bold text-slate-500 text-xs mb-3 uppercase tracking-wider">Pilih Karyawan Untuk Detail</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                   {(data?.by_user || []).map((u) => {
                      const pct = u.cards_total ? Math.round((u.done_now / u.cards_total) * 100) : 0;
                      return (
                        <div key={u.user_id} onClick={() => setOpenUser(u.user_id)} className="bg-white border border-slate-200 rounded-lg p-3 cursor-pointer hover:border-[#0C66E4] hover:shadow-md transition-all">
                           <div className="flex items-center gap-2 mb-3">
                              <div className="w-8 h-8 rounded bg-[#0C66E4] text-white flex items-center justify-center font-bold text-xs">
                                 {u.name.slice(0,2).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                 <div className="font-bold text-xs truncate text-slate-800">{u.name.toUpperCase()}</div>
                                 <div className="text-[10px] text-slate-500 truncate">{u.division_name || "—"}</div>
                              </div>
                           </div>
                           <div className="h-1.5 w-full bg-slate-100 rounded-full mb-2 overflow-hidden">
                              <div className="h-full bg-green-600" style={{width: `${pct}%`}}></div>
                           </div>
                           <div className="flex justify-between items-end">
                              <div className="text-[10px] text-slate-500"><span className="font-bold text-slate-800">{u.cards_total}</span> total</div>
                              <div className="text-[10px] text-slate-500"><span className="font-bold text-slate-800">{u.done_now}</span> selesai</div>
                              <div className="text-xs font-bold text-slate-800">{pct}%</div>
                           </div>
                        </div>
                      )
                   })}
                </div>
              </section>
            </div>
          )}

          {activeTab === "kelengkapan" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <StatCard
                  icon={<ListChecks size={15} />}
                  label="Kelengkapan tercentang"
                  value={data?.checklist?.pct != null ? `${data.checklist.pct}%` : "—"}
                  sub={`${data?.checklist?.done_items ?? 0} dari ${data?.checklist?.total_items ?? 0} item, kartu aktif`}
                  tone={data?.checklist?.pct != null && data.checklist.pct >= 80 ? "green" : "amber"}
                />
                <StatCard
                  icon={<AlertTriangle size={15} />}
                  label="Kartu belum lengkap"
                  value={data?.checklist?.top_incomplete?.length ? `${(data?.checklist?.top_incomplete || []).length}+` : "0"}
                  sub="Masih ada item checklist belum tercentang"
                  tone="amber"
                />
                <StatCard
                  icon={<Clock size={15} />}
                  label="Menunggu verifikasi Admin"
                  value={data?.checklist?.admin_verify_pending?.length ?? 0}
                  sub='Item "Diverifikasi Admin" belum dicentang'
                  tone="red"
                />
              </div>

              <section className="rounded-xl border border-[hsl(var(--hairline))] bg-[hsl(var(--elevated))] overflow-hidden">
                <header className="px-4 py-3 border-b border-[hsl(var(--hairline))]">
                  <h2 className="font-heading font-bold text-foreground">Kartu Aktif Paling Banyak Kekurangan</h2>
                  <p className="text-xs text-2 mt-0.5">Diurutkan dari yang paling banyak item checklist belum tercentang.</p>
                </header>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead className="bg-[hsl(var(--muted))]">
                      <tr><Th>Pekerjaan</Th><Th>Klien</Th><Th>Board / List</Th><Th className="text-right">Tercentang</Th><Th className="text-right">Kurang</Th></tr>
                    </thead>
                    <tbody>
                      {(data?.checklist?.top_incomplete || []).map((it) => (
                        <tr key={it.id} onClick={() => setOpenCard(it.id)} className="border-t border-[hsl(var(--hairline))] hover:bg-[hsl(var(--muted))] cursor-pointer">
                          <Td className="font-medium">{it.title}</Td>
                          <Td className="text-2">{it.client || "—"}</Td>
                          <Td className="text-2 text-xs">{it.board_name}{it.list_name ? ` · ${it.list_name}` : ""}</Td>
                          <Td className="text-right">{it.done}/{it.total}</Td>
                          <Td className="text-right font-bold text-[#C9372C]">{it.missing}</Td>
                        </tr>
                      ))}
                      {(data?.checklist?.top_incomplete || []).length === 0 && (
                        <tr><td colSpan={5} className="py-6 text-center text-sm text-3">Semua kartu aktif checklist-nya sudah lengkap 🎉</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="rounded-xl border border-[hsl(var(--hairline))] bg-[hsl(var(--elevated))] overflow-hidden">
                <header className="px-4 py-3 border-b border-[hsl(var(--hairline))]">
                  <h2 className="font-heading font-bold text-foreground">Menunggu Verifikasi Admin</h2>
                  <p className="text-xs text-2 mt-0.5">Kartu dari template checklist yang belum di-tandai "Diverifikasi Admin" — CS bisa follow-up klien duluan kalau ada yang kurang, tanpa nunggu ini.</p>
                </header>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead className="bg-[hsl(var(--muted))]">
                      <tr><Th>Pekerjaan</Th><Th>Klien</Th><Th>Board / List</Th></tr>
                    </thead>
                    <tbody>
                      {(data?.checklist?.admin_verify_pending || []).map((it) => (
                        <tr key={it.id} onClick={() => setOpenCard(it.id)} className="border-t border-[hsl(var(--hairline))] hover:bg-[hsl(var(--muted))] cursor-pointer">
                          <Td className="font-medium">{it.title}</Td>
                          <Td className="text-2">{it.client || "—"}</Td>
                          <Td className="text-2 text-xs">{it.board_name}{it.list_name ? ` · ${it.list_name}` : ""}</Td>
                        </tr>
                      ))}
                      {(data?.checklist?.admin_verify_pending || []).length === 0 && (
                        <tr><td colSpan={3} className="py-6 text-center text-sm text-3">Tidak ada yang menunggu verifikasi Admin.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          {activeTab === "data_cs" && (
            <div className="space-y-6">
               <section className="rounded-xl border border-[hsl(var(--hairline))] bg-white overflow-hidden shadow-sm">
                 <header className="px-4 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                   <h2 className="font-bold text-slate-800 flex items-center gap-2">Pantauan Customer Service</h2>
                 </header>
                 <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg">
                       <div className="text-xs text-blue-600 font-bold uppercase tracking-wider mb-2">Lead Aktif (Skor 1-5)</div>
                       <div className="text-4xl font-bold text-blue-900">{data?.cs?.daily?.length || 0}</div>
                       <div className="text-sm text-blue-700 mt-1">di luar Finish & Dorman</div>
                    </div>
                    <div className="bg-red-50 border border-red-100 p-4 rounded-lg">
                       <div className="text-xs text-red-600 font-bold uppercase tracking-wider mb-2">Lead Mandek</div>
                       <div className="text-4xl font-bold text-red-900">{data?.cs?.stuck?.length || 0}</div>
                       <div className="text-sm text-red-700 mt-1">melewati ambang batas SOP ({data?.cs?.skor_stuck_threshold_days || 0} hari)</div>
                    </div>
                 </div>
                 
                 <div className="overflow-x-auto p-4 border-t border-slate-100">
                    <h3 className="font-bold text-slate-800 text-sm mb-3">Daftar Lead Mandek</h3>
                    <table className="w-full border-collapse text-sm">
                      <thead className="bg-slate-50 text-slate-500">
                        <tr><th className="py-2 px-3 text-left">NAMA LEAD</th><th className="py-2 px-3 text-left">PIC CS</th><th className="py-2 px-3 text-right">HARI DIAM</th></tr>
                      </thead>
                      <tbody>
                        {(data?.cs?.stuck || []).map((s, i) => (
                           <tr key={i} className="border-t border-slate-100">
                             <td className="py-2 px-3 font-semibold text-slate-800">{s.title}</td>
                             <td className="py-2 px-3 text-slate-600">{s.pic_name}</td>
                             <td className="py-2 px-3 text-right font-bold text-red-600">{s.days_stuck} hari</td>
                           </tr>
                        ))}
                        {(data?.cs?.stuck || []).length === 0 && (
                           <tr><td colSpan="3" className="py-4 text-center text-slate-500">Tidak ada lead mandek! Semua lancar.</td></tr>
                        )}
                      </tbody>
                    </table>
                 </div>
               </section>
            </div>
          )}

        </>
      )}
      {openUser && (
        <UserDetail
          userId={openUser}
          period={period}
          date={date}
          onClose={() => setOpenUser(null)}
          onOpenCard={(id) => setOpenCard(id)}
        />
      )}
      {openCard && <CardModal itemId={openCard} onClose={() => setOpenCard(null)} />}
    </div>
  );
}


const COLORS = {
  finish: "#15803d",
  doing: "#f59e0b",
  list: "#cbd5e1"
};

function UserDetail({ userId, period, date, onClose, onOpenCard }) {
  const { data, isLoading } = useQuery({
    queryKey: ["reports-user", userId, period, date],
    queryFn: () =>
      api.get(`/reports/user/${userId}`, { params: { period, date } }).then((r) => r.data),
  });

  const cards = data?.cards || [];
  
  const pieData = useMemo(() => {
    return [
      { name: "FINISH", value: data?.summary?.done_now || 0, color: COLORS.finish },
      { name: "DOING", value: data?.summary?.doing || 0, color: COLORS.doing },
      { name: "LIST", value: data?.summary?.list || 0, color: COLORS.list }
    ].filter(d => d.value > 0);
  }, [data]);

  const categoryData = useMemo(() => {
    const cats = {};
    cards.forEach(c => {
      const cat = c.list_name || c.board_name || "Lainnya";
      if (!cats[cat]) cats[cat] = { name: cat, total: 0, done: 0 };
      cats[cat].total++;
      if (c.bucket === "done") cats[cat].done++;
    });
    return Object.values(cats).map(c => ({
      ...c,
      pct: Math.round((c.done / c.total) * 100)
    })).sort((a,b) => b.total - a.total).slice(0, 20); // Top 20 categories
  }, [cards]);

  const trendData = useMemo(() => {
    const days = {};
    cards.forEach(c => {
      if (c.created_at) {
        const d = c.created_at.slice(0, 10);
        days[d] = (days[d] || 0) + 1;
      }
    });
    return Object.keys(days).sort().map(d => ({ date: d.slice(5), count: days[d] }));
  }, [cards]);

  const completionPct = data?.summary?.cards_total ? Math.round((data.summary.done_now / data.summary.cards_total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex justify-center items-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-[1400px] h-full max-h-[90vh] bg-[#f4f6fb] shadow-2xl flex flex-col rounded-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        data-testid="report-user-detail"
      >
        <header className="px-5 py-4 bg-white border-b flex items-start justify-between">
          <div>
            <h3 className="text-xl font-bold text-slate-800">DETAIL — {data?.user?.name?.toUpperCase() || "…"}</h3>
            <p className="text-sm text-slate-500">{data?.user?.division || "—"}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-slate-100"><X size={20} /></button>
        </header>

        {isLoading ? (
          <p className="p-5 text-sm text-slate-500">Memuat…</p>
        ) : (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Top row stats */}
            <div className="flex gap-4">
               <div className="flex-1 bg-white p-4 rounded shadow-sm border border-slate-100">
                  <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Total Pekerjaan</div>
                  <div className="text-3xl font-bold text-slate-900">{data?.summary?.cards_total || 0}</div>
               </div>
               <div className="flex-1 bg-white p-4 rounded shadow-sm border border-slate-100">
                  <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Finish</div>
                  <div className="text-3xl font-bold text-green-700">{data?.summary?.done_now || 0}</div>
               </div>
               <div className="flex-1 bg-white p-4 rounded shadow-sm border border-slate-100">
                  <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Doing</div>
                  <div className="text-3xl font-bold text-amber-600">{data?.summary?.doing || 0}</div>
               </div>
               <div className="flex-1 bg-white p-4 rounded shadow-sm border border-slate-100">
                  <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">List</div>
                  <div className="text-3xl font-bold text-slate-600">{data?.summary?.list || 0}</div>
               </div>
               <div className="flex-1 bg-white p-4 rounded shadow-sm border border-slate-100">
                  <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Completion</div>
                  <div className="text-3xl font-bold text-blue-700">{completionPct}%</div>
               </div>
            </div>

            {/* Middle row charts */}
            <div className="flex gap-4 h-[300px]">
               <div className="w-[30%] bg-white rounded shadow-sm border border-slate-100 p-4 flex flex-col">
                  <h4 className="font-semibold text-sm mb-1">Status pekerjaan</h4>
                  <div className="text-xs text-slate-500 mb-4 uppercase tracking-wider">Finish / Doing / List</div>
                  <div className="flex-1 min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData} innerRadius="50%" outerRadius="80%" paddingAngle={2} dataKey="value" stroke="none">
                          {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                        </Pie>
                        <RTooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex gap-3 justify-center text-xs font-bold mt-2">
                     <span className="text-green-700">■ FINISH {data?.summary?.done_now}</span>
                     <span className="text-amber-600">■ DOING {data?.summary?.doing}</span>
                     <span className="text-slate-400">■ LIST {data?.summary?.list}</span>
                  </div>
               </div>
               
               <div className="w-[70%] bg-white rounded shadow-sm border border-slate-100 p-4 flex flex-col">
                  <h4 className="font-semibold text-sm mb-1">Kategori & produktivitas</h4>
                  <div className="text-xs text-slate-500 mb-4">Batang = jumlah · garis = % selesai per kategori</div>
                  <div className="flex-1 min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={categoryData} margin={{ top: 10, right: 30, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" tick={{fontSize: 9}} tickFormatter={(v)=>v.slice(0, 15)} angle={-45} textAnchor="end" height={60} />
                        <YAxis yAxisId="left" orientation="left" tick={{fontSize: 10}} />
                        <YAxis yAxisId="right" orientation="right" tick={{fontSize: 10}} tickFormatter={(v)=>v+"%"} domain={[0, 100]} />
                        <RTooltip />
                        <Bar yAxisId="left" dataKey="total" fill="#4f46e5" radius={[2,2,0,0]} barSize={20} />
                        <Line yAxisId="right" type="monotone" dataKey="pct" stroke="#15803d" strokeWidth={2} dot={{r: 3}} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
               </div>
            </div>

            {/* Tren Harian */}
            <div className="bg-white rounded shadow-sm border border-slate-100 p-4 h-[250px] flex flex-col">
              <h4 className="font-semibold text-sm mb-1">Tren harian</h4>
              <div className="text-xs text-slate-500 mb-4">Jumlah tugas (dibuat) per hari</div>
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tick={{fontSize: 10}} />
                    <YAxis tick={{fontSize: 10}} />
                    <RTooltip />
                    <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={{r: 3}} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded shadow-sm border border-slate-100 flex flex-col">
               <div className="px-4 py-3 border-b flex justify-between items-center bg-slate-50">
                 <h4 className="font-bold text-sm">Kerjaan — {data?.user?.name?.toUpperCase()}</h4>
                 <div className="text-xs bg-slate-200 px-2 py-1 rounded font-semibold text-slate-600">{cards.length} task</div>
               </div>
               <div className="overflow-x-auto">
                 <table className="w-full border-collapse text-sm">
                   <thead className="bg-slate-100">
                     <tr>
                       <Th>Tanggal</Th>
                       <Th>Nama Kerjaan</Th>
                       <Th>Kategori</Th>
                       <Th>Status</Th>
                     </tr>
                   </thead>
                   <tbody>
                     {cards.map((c, i) => {
                       let stClass = "bg-slate-100 text-slate-600";
                       if (c.bucket === "done") stClass = "bg-green-100 text-green-700";
                       if (c.bucket === "doing") stClass = "bg-amber-100 text-amber-700";
                       return (
                         <tr key={c.id} onClick={() => onOpenCard(c.id)} className="border-t hover:bg-slate-50 cursor-pointer">
                           <Td className="whitespace-nowrap text-slate-500">{c.created_at ? c.created_at.slice(0,10) : "—"}</Td>
                           <Td className="font-medium text-slate-800">{c.title}</Td>
                           <Td className="text-slate-500 text-xs">{c.list_name || c.board_name}</Td>
                           <Td>
                             <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${stClass}`}>
                                {c.bucket === "done" ? "FINISH" : c.bucket}
                             </span>
                           </Td>
                         </tr>
                       );
                     })}
                   </tbody>
                 </table>
               </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
