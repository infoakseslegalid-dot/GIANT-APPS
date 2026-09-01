import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Briefcase, Inbox, Loader, AlarmClock, CheckCircle2, Send } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Avatar } from "../components/common";

export default function Dashboard() {
  const { user } = useAuth();
  const { data: stats } = useQuery({ queryKey: ["stats"], queryFn: () => api.get("/stats").then((r) => r.data) });
  const { data: boards } = useQuery({ queryKey: ["boards"], queryFn: () => api.get("/boards").then((r) => r.data) });

  const cards = [
    { label: "Pekerjaan Aktif", value: stats?.total_active, icon: <Briefcase size={20} />, color: "#0C66E4", testid: "stat-active" },
    { label: "Belum Diambil", value: stats?.unassigned, icon: <Inbox size={20} />, color: "#E56910", testid: "stat-unassigned" },
    { label: "Sedang Dikerjakan", value: stats?.in_progress, icon: <Loader size={20} />, color: "#9F8FEF", testid: "stat-progress" },
    { label: "Overdue", value: stats?.overdue, icon: <AlarmClock size={20} />, color: "#CA3521", testid: "stat-overdue" },
    { label: "Menunggu Approval", value: stats?.submitted, icon: <Send size={20} />, color: "#F5CD47", testid: "stat-submitted" },
    { label: "Selesai Hari Ini", value: stats?.done_today, icon: <CheckCircle2 size={20} />, color: "#22A06B", testid: "stat-done-today" },
  ];

  const maxDiv = Math.max(1, ...(stats?.by_division || []).map((d) => d.count));
  const maxUser = Math.max(1, ...(stats?.by_user || []).map((u) => u.count));

  return (
    <div className="p-6 max-w-7xl mx-auto" data-testid="dashboard-page">
      <div className="mb-6">
        <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-[#172B4D]">
          Selamat datang, {user?.name?.split(" ")[0]}
        </h1>
        <p className="text-sm text-[#44546F] mt-1">Ringkasan seluruh pekerjaan ALI hari ini.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-8">
        {cards.map((c, i) => (
          <div
            key={c.label}
            data-testid={c.testid}
            className="bg-white rounded-xl border border-[#DFE1E6] p-4 shadow-sm stagger-item"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white mb-3" style={{ backgroundColor: c.color }}>
              {c.icon}
            </div>
            <p className="font-heading text-2xl font-bold text-[#172B4D]">{c.value ?? "—"}</p>
            <p className="text-xs text-[#44546F] font-medium">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-[#DFE1E6] p-5 shadow-sm" data-testid="workload-division">
          <h2 className="font-heading text-base font-bold text-[#172B4D] mb-4">Beban Kerja per Divisi</h2>
          <div className="space-y-3">
            {(stats?.by_division || []).map((d) => (
              <div key={d.id}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-[#172B4D]">{d.name}</span>
                  <span className="font-bold text-[#44546F]">{d.count}</span>
                </div>
                <div className="h-2.5 rounded-full bg-[#F1F2F4] overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${(d.count / maxDiv) * 100}%`, backgroundColor: d.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-[#DFE1E6] p-5 shadow-sm" data-testid="workload-user">
          <h2 className="font-heading text-base font-bold text-[#172B4D] mb-4">Beban Kerja per User</h2>
          <div className="space-y-3">
            {(stats?.by_user || []).map((u) => (
              <div key={u.id} className="flex items-center gap-3">
                <Avatar name={u.name} color={u.color} size="h-7 w-7 text-[10px]" />
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-[#172B4D]">{u.name}</span>
                    <span className="font-bold text-[#44546F]">{u.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-[#F1F2F4] overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${(u.count / maxUser) * 100}%`, backgroundColor: u.color }} />
                  </div>
                </div>
              </div>
            ))}
            {(stats?.by_user || []).length === 0 && <p className="text-sm text-[#8590A2]">Belum ada pekerjaan yang ditugaskan.</p>}
          </div>
        </div>
      </div>

      <div>
        <h2 className="font-heading text-base font-bold text-[#172B4D] mb-3">Board Anda</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3" data-testid="dashboard-boards-grid">
          {(boards || []).map((b, i) => (
            <Link
              key={b.id}
              to={`/board/${b.id}`}
              data-testid={`dashboard-board-${b.id}`}
              className="rounded-xl p-4 h-24 flex flex-col justify-between text-white shadow-sm hover:shadow-md hover:scale-[1.02] transition-all stagger-item"
              style={{ backgroundColor: b.background, animationDelay: `${i * 40}ms` }}
            >
              <p className="font-heading font-bold text-sm leading-snug">{b.name}</p>
              <div className="flex items-center justify-between">
                {b.division_name && (
                  <span className="text-[10px] font-bold bg-white/20 rounded-full px-2 py-0.5">{b.division_name}</span>
                )}
                <span className="text-[10px] opacity-80">{b.card_count} kartu</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
