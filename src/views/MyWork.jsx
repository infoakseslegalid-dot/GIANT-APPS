import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Briefcase, CheckCircle2, Send, Clock } from "lucide-react";
import { api, fmtDate } from "../lib/api";
import { StatusBadge, PriorityFlag } from "../components/common";
import CardModal from "../components/CardModal";

export default function MyWork() {
  const [openItem, setOpenItem] = useState(null);
  const navigate = useNavigate();
  const { data: items, isLoading } = useQuery({
    queryKey: ["my-work"],
    queryFn: () => api.get("/my-work").then((r) => r.data),
  });

  const groups = [
    { key: "active", label: "Sedang Dikerjakan", icon: <Briefcase size={16} className="text-[#0C66E4]" />, items: (items || []).filter((i) => i.status === "active") },
    { key: "submitted", label: "Menunggu Persetujuan", icon: <Send size={16} className="text-[#9F8FEF]" />, items: (items || []).filter((i) => i.status === "submitted") },
    { key: "done", label: "Selesai", icon: <CheckCircle2 size={16} className="text-[#22A06B]" />, items: (items || []).filter((i) => i.status === "done") },
  ];

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="p-6 max-w-5xl mx-auto" data-testid="my-work-page">
      <div className="mb-6">
        <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-[#172B4D]">Pekerjaan Saya</h1>
        <p className="text-sm text-[#44546F] mt-1">
          {(items || []).length} pekerjaan di mana Anda menjadi PIC.
        </p>
      </div>

      {isLoading && <p className="text-sm text-[#44546F]">Memuat...</p>}

      {groups.map((g) => (
        <div key={g.key} className="mb-8" data-testid={`mywork-group-${g.key}`}>
          <div className="flex items-center gap-2 mb-3">
            {g.icon}
            <h2 className="font-heading text-base font-bold text-[#172B4D]">{g.label}</h2>
            <span className="text-xs font-bold text-[#44546F] bg-[#DFE1E6] rounded-full px-2 py-0.5">{g.items.length}</span>
          </div>
          {g.items.length === 0 ? (
            <p className="text-sm text-[#8590A2] pl-6">Tidak ada pekerjaan.</p>
          ) : (
            <div className="grid md:grid-cols-2 gap-3">
              {g.items.map((item, i) => {
                const overdue = item.due_date && item.due_date < today && item.status !== "done";
                return (
                  <button
                    key={item.id}
                    data-testid={`mywork-card-${item.id}`}
                    onClick={() => setOpenItem(item.id)}
                    className="bg-white rounded-xl border border-[#DFE1E6] p-4 text-left shadow-sm hover:shadow-md hover:border-[#0C66E4] transition-all stagger-item"
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-sm font-semibold text-[#172B4D] leading-snug">{item.title}</p>
                      <StatusBadge status={item.status} />
                    </div>
                    {item.client_name && <p className="text-xs text-[#44546F] mb-2">Klien: {item.client_name}</p>}
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      {item.board_name && (
                        <button
                          data-testid={`mywork-board-link-${item.id}`}
                          onClick={(e) => { e.stopPropagation(); navigate(`/board/${item.board_id}`); }}
                          className="px-1.5 py-0.5 rounded text-white font-semibold"
                          style={{ backgroundColor: item.board_background || "#0079bf" }}
                        >
                          {item.board_name}
                        </button>
                      )}
                      {item.list_name && <span className="px-1.5 py-0.5 rounded bg-[#F1F2F4] text-[#44546F] font-medium">{item.list_name}</span>}
                      <PriorityFlag priority={item.priority} />
                      {item.due_date && (
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-semibold ${overdue ? "bg-[#FFECE8] text-[#CA3521]" : "bg-[#F1F2F4] text-[#44546F]"}`}>
                          <Clock size={11} /> {fmtDate(item.due_date)}{overdue && " · Terlambat"}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ))}

      {openItem && <CardModal itemId={openItem} onClose={() => setOpenItem(null)} />}
    </div>
  );
}
