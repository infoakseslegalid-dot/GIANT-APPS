import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, AlertTriangle, Eye } from "lucide-react";
import { api, fmtDate } from "../lib/api";
import { Avatar, PriorityFlag } from "../components/common";
import CardModal from "../components/kanban/CardModalWrapper";

const SKOR_COLUMNS = [
  { key: "1", title: "SKOR 1", desc: "Board CS · kata pembuka / pengumpulan awal", color: "#6CC3E0" },
  { key: "2", title: "SKOR 2", desc: "Board Admin Legal · draft & revisi draft", color: "#579DFF" },
  { key: "3", title: "SKOR 3", desc: "Admin Legal (draft final/TTD) + tampil di CS", color: "#1D7AFC" },
  { key: "4", title: "SKOR 4", desc: "Board CS · pembayaran & konfirmasi klien", color: "#F5CD47" },
  { key: "5", title: "SKOR 5", desc: "Board Global Admin · proses HARI 1-7", color: "#E56910" },
  { key: "6", title: "SKOR 6", desc: "Finish · penyerahan", color: "#22A06B" },
];

export default function GlobalSkor() {
  const [openItem, setOpenItem] = useState(null);

  const { data: buckets, isLoading, isError } = useQuery({
    queryKey: ["global-skor"],
    queryFn: () => api.get("/global/skor").then((r) => r.data),
    retry: false,
  });
  const { data: users } = useQuery({ queryKey: ["users"], queryFn: () => api.get("/users").then((r) => r.data) });
  const usersById = Object.fromEntries((users || []).map((u) => [u.id, u]));

  if (isError) {
    return (
      <div className="p-10 text-center" data-testid="global-skor-forbidden">
        <p className="text-[#44546F]">Halaman ini hanya untuk tim CS, supervisor, dan admin.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#0b4f6c]" data-testid="global-skor-page">
      <div className="px-5 py-4 shrink-0 flex items-start justify-between">
        <div>
          <h1 className="font-heading text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <BarChart3 size={22} /> Peta Skor Global — Seluruh Klien CS
          </h1>
          <p className="text-xs text-white/70 mt-1">Agregasi posisi setiap pekerjaan lintas board. Kartu yang mandek ≥3 hari ditandai merah.</p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-white bg-white/15 rounded-full px-3 py-1.5" data-testid="global-skor-readonly-badge">
          <Eye size={12} /> Read-only
        </span>
      </div>
      <div className="flex-1 overflow-x-auto overflow-y-hidden px-4 pb-4 minimal-scrollbar">
        {isLoading ? (
          <p className="text-white/80 text-sm">Memuat...</p>
        ) : (
          <div className="flex items-start gap-3 h-full">
            {SKOR_COLUMNS.map((col) => {
              const cards = buckets?.[col.key] || [];
              return (
                <div key={col.key} className="w-72 shrink-0 bg-[#f1f2f4] rounded-xl flex flex-col max-h-full shadow-sm" data-testid={`skor-column-${col.key}`}>
                  <div className="p-3 pb-2 shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: col.color }} />
                      <h2 className="font-heading font-bold text-sm text-[#172B4D]">{col.title}</h2>
                      <span className="text-xs text-[#8590A2]">{cards.length}</span>
                    </div>
                    <p className="text-[10px] text-[#44546F] mt-0.5">{col.desc}</p>
                  </div>
                  <div className="flex-1 overflow-y-auto minimal-scrollbar px-2 pb-2 space-y-2">
                    {cards.map((item) => {
                      const members = (item.member_ids || []).map((id) => usersById[id]).filter(Boolean);
                      return (
                        <button
                          key={item.id}
                          data-testid={`skor-card-${item.id}`}
                          onClick={() => setOpenItem(item.id)}
                          className="w-full text-left bg-white rounded-lg shadow-sm hover:bg-gray-50 border-b border-gray-300 p-3 flex flex-col gap-1.5 transition-colors"
                        >
                          <p className="text-sm font-medium text-[#172B4D] leading-snug">{item.title}</p>
                          {item.client_name && <p className="text-xs text-[#44546F]">{item.client_name}</p>}
                          <div className="flex flex-wrap items-center gap-1.5">
                            {item.board_name && (
                              <span className="text-[10px] font-bold text-white px-1.5 py-0.5 rounded" style={{ backgroundColor: item.board_background || "#0079bf" }}>
                                {item.board_name}
                              </span>
                            )}
                            {item.list_name && (
                              <span className="text-[10px] font-semibold text-[#44546F] bg-[#F1F2F4] px-1.5 py-0.5 rounded">{item.list_name}</span>
                            )}
                            {item.hari_stage ? (
                              <span className="text-[10px] font-bold text-white px-1.5 py-0.5 rounded bg-[#E56910]">HARI {item.hari_stage}</span>
                            ) : null}
                            {item.is_stalled && item.status !== "done" && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-white px-1.5 py-0.5 rounded bg-[#CA3521]" data-testid={`skor-stalled-${item.id}`}>
                                <AlertTriangle size={10} /> Mandek {item.days_in_stage}h
                              </span>
                            )}
                            <PriorityFlag priority={item.priority} />
                            {item.due_date && <span className="text-[10px] text-[#44546F]">Due {fmtDate(item.due_date)}</span>}
                          </div>
                          <div className="flex -space-x-1.5 justify-end">
                            {members.slice(0, 4).map((m) => <Avatar key={m.id} name={m.name} color={m.avatar_color} size="h-6 w-6 text-[10px]" />)}
                          </div>
                        </button>
                      );
                    })}
                    {cards.length === 0 && <p className="text-[11px] text-[#8590A2] text-center py-3">Kosong</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {openItem && <CardModal itemId={openItem} onClose={() => setOpenItem(null)} />}
    </div>
  );
}
