const fs = require("fs");
let code = fs.readFileSync("src/views/Reports.jsx", "utf-8");

const ringkasanJSX = `
          {activeTab === "ringkasan" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard icon={<Wallet size={15} />} label="Uang masuk (periode)" value={rp(fin?.total_in)} sub={\`\${(fin?.by_day || []).length} hari ada transaksi\`} tone="green" />
                <StatCard icon={<CheckCircle2 size={15} />} label="Job jadi LUNAS (periode)" value={fin?.count_lunas_period ?? 0} sub={\`Total lunas keseluruhan: \${fin?.count_lunas_total ?? 0}\`} tone="blue" />
                <StatCard icon={<Clock size={15} />} label="Job masih DP" value={fin?.count_dp ?? 0} sub="Sudah bayar sebagian" tone="amber" />
                <StatCard icon={<AlertTriangle size={15} />} label="Job belum bayar" value={fin?.count_belum ?? 0} sub="Harga sudah diisi, Rp 0 masuk" tone="red" />
              </div>
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
`;

const perOrangJSX = `
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
                            <td className="py-3 pl-8">
                               <div className="flex items-center gap-2">
                                 <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                   <div className="h-full bg-green-600" style={{ width: \`\${pct}%\` }}></div>
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
                              <div className="h-full bg-green-600" style={{width: \`\${pct}%\`}}></div>
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
`;

const dataCsJSX = `
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
`;

code = code.replace(/\{isLoading \? \([\s\S]*?<\/div> \/\/ end Reports return/m, 
`{isLoading ? (
        <p className="text-2 text-sm">Memuat…</p>
      ) : (
        <>
${ringkasanJSX}
${perOrangJSX}
${dataCsJSX}
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
      {openCard && (
        <CardModal
          itemId={openCard}
          onClose={() => setOpenCard(null)}
        />
      )}
    </div> // end Reports return`
);

fs.writeFileSync("src/views/Reports.jsx", code);
