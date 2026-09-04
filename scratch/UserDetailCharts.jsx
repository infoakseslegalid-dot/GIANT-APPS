import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RTooltip, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, ComposedChart } from "recharts";

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
