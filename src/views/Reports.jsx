import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, Wallet, CheckCircle2, Clock, AlertTriangle, X, ArrowUpNarrowWide } from "lucide-react";
import { api, fmtDate } from "../lib/api";
import CardModal from "../components/kanban/CardModalWrapper";

const rp = (n) =>
  n == null ? "—" : "Rp " + Math.round(n).toLocaleString("id-ID");

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
        <p className="text-2">Halaman ini hanya untuk super admin / peran dengan izin "Rekap & Performa".</p>
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

      {isLoading ? (
        <p className="text-2 text-sm">Memuat…</p>
      ) : (
        <>
          {/* Ringkasan keuangan */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              icon={<Wallet size={15} />}
              label="Uang masuk (periode)"
              value={rp(fin?.total_in)}
              sub={`${(fin?.by_day || []).length} hari ada transaksi`}
              tone="green"
            />
            <StatCard
              icon={<CheckCircle2 size={15} />}
              label="Job jadi LUNAS (periode)"
              value={fin?.count_lunas_period ?? 0}
              sub={`Total lunas keseluruhan: ${fin?.count_lunas_total ?? 0}`}
              tone="blue"
            />
            <StatCard
              icon={<Clock size={15} />}
              label="Job masih DP"
              value={fin?.count_dp ?? 0}
              sub="Sudah bayar sebagian"
              tone="amber"
            />
            <StatCard
              icon={<AlertTriangle size={15} />}
              label="Job belum bayar"
              value={fin?.count_belum ?? 0}
              sub="Harga sudah diisi, Rp 0 masuk"
              tone="red"
            />
          </div>

          {/* Performa per user */}
          <section className="rounded-xl border border-[hsl(var(--hairline))] bg-[hsl(var(--elevated))] overflow-hidden">
            <header className="px-4 py-3 border-b border-[hsl(var(--hairline))]">
              <h2 className="font-heading font-bold text-foreground">Performa per User</h2>
              <p className="text-xs text-3 mt-0.5">
                List / Doing / Done = posisi kartu sekarang. "Selesai (periode)" = kartu yang dituntaskan dalam periode. Klik baris untuk rincian.
              </p>
            </header>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="bg-[hsl(var(--muted))]">
                  <tr>
                    <Th>Nama</Th>
                    <Th>Divisi</Th>
                    <Th className="text-right">Total kartu</Th>
                    <Th className="text-right">List</Th>
                    <Th className="text-right">Doing</Th>
                    <Th className="text-right">Done (skrg)</Th>
                    <Th className="text-right">Selesai (periode)</Th>
                    <Th className="text-right">Omzet (periode)</Th>
                    <Th className="text-right">Lunas (periode)</Th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.by_user || []).map((u) => (
                    <tr
                      key={u.user_id}
                      data-testid={`report-user-${u.user_id}`}
                      onClick={() => setOpenUser(u.user_id)}
                      className="border-t border-[hsl(var(--hairline))] hover:bg-[hsl(var(--muted))] cursor-pointer"
                    >
                      <Td className="font-semibold">{u.name}</Td>
                      <Td className="text-2">{u.division_name || "—"}</Td>
                      <Td className="text-right">{u.cards_total}</Td>
                      <Td className="text-right">{u.list}</Td>
                      <Td className="text-right">{u.doing}</Td>
                      <Td className="text-right">{u.done_now}</Td>
                      <Td className="text-right font-semibold text-[#1F845A]">{u.done_period}</Td>
                      <Td className="text-right font-semibold">{u.revenue_period ? rp(u.revenue_period) : "—"}</Td>
                      <Td className="text-right">{u.lunas_period || "—"}</Td>
                    </tr>
                  ))}
                  {(data?.by_user || []).length === 0 && (
                    <tr><Td className="text-3 py-4" >Belum ada data pada periode ini.</Td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Performa per divisi */}
          <section className="rounded-xl border border-[hsl(var(--hairline))] bg-[hsl(var(--elevated))] overflow-hidden">
            <header className="px-4 py-3 border-b border-[hsl(var(--hairline))]">
              <h2 className="font-heading font-bold text-foreground">Performa per Divisi</h2>
              <p className="text-xs text-3 mt-0.5">Omzet diatribusikan ke divisi PIC CS (Julia dst). Divisi lain dinilai dari jumlah kartu selesai.</p>
            </header>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="bg-[hsl(var(--muted))]">
                  <tr>
                    <Th>Divisi</Th>
                    <Th className="text-right">Anggota</Th>
                    <Th className="text-right">Total kartu</Th>
                    <Th className="text-right">List</Th>
                    <Th className="text-right">Doing</Th>
                    <Th className="text-right">Done (skrg)</Th>
                    <Th className="text-right">Selesai (periode)</Th>
                    <Th className="text-right">Omzet (periode)</Th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.by_division || []).map((d) => (
                    <tr key={d.division_id || "none"} className="border-t border-[hsl(var(--hairline))]">
                      <Td className="font-semibold">{d.name}</Td>
                      <Td className="text-right">{d.users}</Td>
                      <Td className="text-right">{d.cards_total}</Td>
                      <Td className="text-right">{d.list}</Td>
                      <Td className="text-right">{d.doing}</Td>
                      <Td className="text-right">{d.done_now}</Td>
                      <Td className="text-right font-semibold text-[#1F845A]">{d.done_period}</Td>
                      <Td className="text-right font-semibold">{d.revenue_period ? rp(d.revenue_period) : "—"}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* CS harian */}
          <section className="grid lg:grid-cols-2 gap-4">
            <div className="rounded-xl border border-[hsl(var(--hairline))] bg-[hsl(var(--elevated))] overflow-hidden">
              <header className="px-4 py-3 border-b border-[hsl(var(--hairline))]">
                <h2 className="font-heading font-bold text-foreground flex items-center gap-2">
                  <ArrowUpNarrowWide size={16} /> CS — Skor Dinaikkan (periode)
                </h2>
              </header>
              <table className="w-full border-collapse">
                <thead className="bg-[hsl(var(--muted))]">
                  <tr><Th>CS</Th><Th className="text-right">Skor naik</Th><Th className="text-right">Kartu mandek</Th></tr>
                </thead>
                <tbody>
                  {(data?.cs?.daily || []).map((u) => (
                    <tr key={u.user_id} className="border-t border-[hsl(var(--hairline))]">
                      <Td className="font-semibold">{u.name}</Td>
                      <Td className="text-right font-bold text-[#0C66E4]">{u.skor_up}</Td>
                      <Td className="text-right">{u.stuck_count || "—"}</Td>
                    </tr>
                  ))}
                  {(data?.cs?.daily || []).length === 0 && (
                    <tr><Td className="text-3 py-3">Tidak ada user CS.</Td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="rounded-xl border border-[hsl(var(--hairline))] bg-[hsl(var(--elevated))] overflow-hidden">
              <header className="px-4 py-3 border-b border-[hsl(var(--hairline))]">
                <h2 className="font-heading font-bold text-foreground flex items-center gap-2">
                  <AlertTriangle size={16} className="text-[#C9372C]" /> Kartu CS Mandek (≥ {data?.cs?.skor_stuck_threshold_days ?? 3} hari)
                </h2>
              </header>
              <div className="max-h-[320px] overflow-y-auto minimal-scrollbar">
                <table className="w-full border-collapse">
                  <thead className="bg-[hsl(var(--muted))] sticky top-0">
                    <tr><Th>Kartu</Th><Th>Skor / List</Th><Th>PIC</Th><Th className="text-right">Hari</Th></tr>
                  </thead>
                  <tbody>
                    {(data?.cs?.stuck || []).map((s) => (
                      <tr
                        key={s.id}
                        onClick={() => setOpenCard(s.id)}
                        className="border-t border-[hsl(var(--hairline))] hover:bg-[hsl(var(--muted))] cursor-pointer"
                      >
                        <Td className="font-medium">{s.title}{s.client ? <span className="text-3"> · {s.client}</span> : null}</Td>
                        <Td className="text-2">{s.list_name}</Td>
                        <Td className="text-2">{s.pic_name || "—"}</Td>
                        <Td className={`text-right font-bold ${s.days >= 7 ? "text-[#C9372C]" : "text-[#B65C02]"}`}>{s.days}</Td>
                      </tr>
                    ))}
                    {(data?.cs?.stuck || []).length === 0 && (
                      <tr><Td className="text-3 py-3">Tidak ada kartu mandek. 🎉</Td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
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

function UserDetail({ userId, period, date, onClose, onOpenCard }) {
  const { data, isLoading } = useQuery({
    queryKey: ["reports-user", userId, period, date],
    queryFn: () =>
      api.get(`/reports/user/${userId}`, { params: { period, date } }).then((r) => r.data),
  });

  const badge = {
    lunas: "bg-[#DCFFF1] text-[#1F845A]",
    dp: "bg-[#FFF7D6] text-[#B65C02]",
    belum: "bg-[#FFECEB] text-[#C9372C]",
    no_price: "bg-[hsl(var(--muted))] text-3",
  };
  const bucketBadge = {
    list: "bg-[hsl(var(--muted))] text-2",
    doing: "bg-[#E9F2FF] text-[#0C66E4]",
    done: "bg-[#DCFFF1] text-[#1F845A]",
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div
        className="h-full w-full max-w-[640px] bg-[hsl(var(--elevated))] shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
        data-testid="report-user-detail"
      >
        <header className="px-5 py-4 border-b border-[hsl(var(--hairline))] flex items-start justify-between">
          <div>
            <h3 className="font-heading text-lg font-bold text-foreground">{data?.user?.name || "…"}</h3>
            <p className="text-xs text-3">{data?.user?.division || "—"} · {data?.user?.role}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-[hsl(var(--muted))] text-2"><X size={18} /></button>
        </header>

        {isLoading ? (
          <p className="p-5 text-2 text-sm">Memuat…</p>
        ) : (
          <div className="flex-1 overflow-y-auto minimal-scrollbar p-5 space-y-5">
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                ["List", data?.summary?.list],
                ["Doing", data?.summary?.doing],
                ["Done skrg", data?.summary?.done_now],
                ["Selesai (periode)", data?.summary?.done_period],
                ["Total kartu", data?.summary?.cards_total],
                ["Omzet (periode)", rp(data?.summary?.revenue_period)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg border border-[hsl(var(--hairline))] p-2">
                  <div className="text-[11px] text-3">{k}</div>
                  <div className="text-base font-bold text-foreground">{v ?? 0}</div>
                </div>
              ))}
            </div>

            <div>
              <h4 className="font-bold text-sm text-foreground mb-2">Pembayaran masuk (periode)</h4>
              {(data?.payments || []).length === 0 ? (
                <p className="text-xs text-3">Tidak ada pembayaran diatribusikan ke user ini pada periode ini.</p>
              ) : (
                <ul className="space-y-1.5">
                  {data.payments.map((p) => (
                    <li key={p.id} className="flex items-center justify-between rounded-lg border border-[hsl(var(--hairline))] px-3 py-2 text-sm">
                      <span className="min-w-0">
                        <span className="font-semibold text-foreground">{rp(p.amount)}</span>
                        <span className="text-3"> · {p.job_title}{p.job_client ? ` (${p.job_client})` : ""}</span>
                      </span>
                      <span className="shrink-0 text-xs text-3">{fmtDate(p.paid_at)} · {p.kind}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h4 className="font-bold text-sm text-foreground mb-2">Daftar kerjaan ({data?.cards?.length || 0})</h4>
              <ul className="space-y-1.5">
                {(data?.cards || []).map((c) => (
                  <li
                    key={c.id}
                    onClick={() => onOpenCard(c.id)}
                    className="rounded-lg border border-[hsl(var(--hairline))] px-3 py-2 hover:bg-[hsl(var(--muted))] cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-foreground text-sm min-w-0 truncate">{c.title}</span>
                      <span className={`shrink-0 text-[11px] font-bold px-1.5 py-0.5 rounded ${bucketBadge[c.bucket]}`}>{c.bucket}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-3">
                      {c.client && <span>{c.client}</span>}
                      <span>· {c.board_name}</span>
                      {c.list_name && <span>· {c.list_name}</span>}
                      {c.done_in_period && <span className="text-[#1F845A] font-semibold">· selesai {fmtDate(c.completed_at)}</span>}
                      <span className={`ml-auto px-1.5 py-0.5 rounded font-bold ${badge[c.pay_status]}`}>
                        {c.pay_status === "no_price" ? "belum ada harga" : `${c.pay_status} · ${rp(c.price)}`}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
