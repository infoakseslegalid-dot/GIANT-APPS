const fs = require("fs");
let code = fs.readFileSync("src/views/Reports.jsx", "utf-8");

const eksekutifJSX = `
          {activeTab === "eksekutif" && (
            <div className="space-y-6">
              {/* Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                 <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm border-t-4 border-t-blue-600">
                    <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2 flex justify-between">Total Omzet <TrendingUp size={14} className="text-blue-500"/></div>
                    <div className="text-2xl lg:text-3xl font-extrabold text-slate-900">{rp(fin?.total_in)}</div>
                    <div className="text-xs text-slate-500 mt-2"><span className="text-green-600 font-bold">+{fin?.count_lunas_period || 0}</span> Job Lunas Periode Ini</div>
                 </div>
                 <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm border-t-4 border-t-red-500">
                    <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2 flex justify-between">Total Piutang <AlertTriangle size={14} className="text-red-500"/></div>
                    <div className="text-2xl lg:text-3xl font-extrabold text-slate-900">{rp(fin?.total_piutang)}</div>
                    <div className="text-xs text-slate-500 mt-2"><span className="text-red-500 font-bold">{fin?.piutang_cards || 0}</span> Job masih DP/Belum Bayar</div>
                 </div>
                 <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm border-t-4 border-t-green-600">
                    <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2 flex justify-between">Pekerjaan Selesai <CheckCircle2 size={14} className="text-green-500"/></div>
                    <div className="text-2xl lg:text-3xl font-extrabold text-slate-900">
                      {(data?.by_user || []).reduce((a,b)=>a+b.done_period, 0)} <span className="text-sm font-normal text-slate-500">job</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-2">Dikerjakan dalam periode ini</div>
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
                    <p className="text-xs text-slate-500 mb-6">Melihat korelasi pemasukan harian dengan jumlah pekerjaan yang diselesaikan tim (Data Dummy Harian).</p>
                    <div className="h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={
                          Object.entries(fin?.by_day || {}).map(([date, amount]) => ({
                             date: date.slice(5),
                             omzet: amount,
                             selesai: Math.floor(Math.random() * 5) + 1 // We don't have jobs_done_by_day in overview, so mockup or zero
                          })).sort((a,b) => a.date.localeCompare(b.date))
                        }>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="date" tick={{fontSize: 10}} />
                          <YAxis yAxisId="left" tick={{fontSize: 10}} tickFormatter={(v) => (v/1000000).toFixed(0)+"jt"} />
                          <YAxis yAxisId="right" orientation="right" tick={{fontSize: 10}} />
                          <RTooltip formatter={(v, name) => name === "omzet" ? rp(v) : v} />
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
            </div>
          )}
`;

code = code.replace(
  '{activeTab === "ringkasan" && (',
  eksekutifJSX + '\n          {activeTab === "ringkasan" && ('
);

fs.writeFileSync("src/views/Reports.jsx", code);
