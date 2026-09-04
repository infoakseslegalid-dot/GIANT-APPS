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
