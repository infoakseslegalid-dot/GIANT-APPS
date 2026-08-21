import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  pointerWithin, useDraggable, useDroppable,
} from "@dnd-kit/core";
import { CalendarClock, CheckCircle2, AlertTriangle } from "lucide-react";
import { api, errMsg, fmtDate } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Avatar } from "../components/common";
import CardModal from "../components/CardModal";

const STAGES = [
  { stage: 1, title: "HARI 1", processor: "Admin Draf Input", color: "#0C66E4" },
  { stage: 2, title: "HARI 2", processor: "Admin Draf Input", color: "#1D7AFC" },
  { stage: 3, title: "HARI 3", processor: "Admin Draf Input", color: "#579DFF" },
  { stage: 4, title: "HARI 4", processor: "Admin Pajak & Desain", color: "#E56910", gate: "AKTA & SK" },
  { stage: 5, title: "HARI 5", processor: "Admin Pajak & Desain", color: "#F5CD47" },
  { stage: 6, title: "HARI 6", processor: "Admin Perizinan & Desain", color: "#9F8FEF", gate: "NPWP, Coretax, Suket" },
  { stage: 7, title: "HARI 7", processor: "Admin Perizinan & Desain", color: "#B04632" },
  { stage: 8, title: "FINISH", processor: "Penyerahan", color: "#22A06B", gate: "NIB" },
];

function HariCard({ item, usersById, onClick, overlay }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.id,
    data: { item },
    disabled: overlay,
  });
  const members = (item.member_ids || []).map((id) => usersById[id]).filter(Boolean);
  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined}
      {...(overlay ? {} : { ...attributes, ...listeners })}
      onClick={onClick}
      data-testid={`hari-card-${item.id}`}
      className={`bg-white rounded-lg shadow-sm border-b border-gray-300 p-3 cursor-pointer flex flex-col gap-1.5 ${isDragging ? "opacity-40" : ""} ${overlay ? "rotate-2 scale-105 shadow-xl" : "hover:bg-gray-50"}`}
    >
      <p className="text-sm font-medium text-[#172B4D] leading-snug">{item.title}</p>
      {item.client_name && <p className="text-xs text-[#44546F]">{item.client_name}</p>}
      <div className="flex flex-wrap items-center gap-1.5">
        {item.board_name && (
          <span className="text-[10px] font-bold text-white px-1.5 py-0.5 rounded" style={{ backgroundColor: item.board_background || "#0079bf" }}>
            {item.board_name}
          </span>
        )}
        {item.is_stalled ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-white px-1.5 py-0.5 rounded bg-[#CA3521]" data-testid={`hari-stalled-${item.id}`}>
            <AlertTriangle size={10} /> Mandek {item.days_in_stage} hari
          </span>
        ) : (
          <span className="text-[10px] font-semibold text-[#44546F] bg-[#F1F2F4] px-1.5 py-0.5 rounded">{item.days_in_stage} hari di tahap ini</span>
        )}
        {item.due_date && <span className="text-[10px] text-[#44546F]">Due {fmtDate(item.due_date)}</span>}
      </div>
      <div className="flex -space-x-1.5 justify-end">
        {members.slice(0, 4).map((m) => <Avatar key={m.id} name={m.name} color={m.avatar_color} size="h-6 w-6 text-[10px]" />)}
      </div>
    </div>
  );
}

function HariColumn({ stage, title, processor, color, gate, count, children }) {
  const { setNodeRef, isOver } = useDroppable({ id: `stage-${stage}` });
  return (
    <div
      ref={setNodeRef}
      data-testid={`hari-column-${stage}`}
      className={`w-64 shrink-0 rounded-xl flex flex-col max-h-full shadow-sm transition-colors ${isOver ? "bg-[#D6E4FF] ring-2 ring-[#0C66E4]" : "bg-[#f1f2f4]"}`}
    >
      <div className="p-3 pb-2 shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
          <h2 className="font-heading font-bold text-sm text-[#172B4D]">{title}</h2>
          <span className="text-xs text-[#8590A2]">{count}</span>
        </div>
        <p className="text-[10px] text-[#44546F] mt-0.5">{processor}</p>
        {gate && (
          <p className="text-[10px] font-semibold text-[#E56910] mt-0.5 flex items-center gap-1">
            <CheckCircle2 size={10} /> Syarat masuk: {gate}
          </p>
        )}
      </div>
      <div className="flex-1 overflow-y-auto minimal-scrollbar px-2 pb-2 space-y-2 min-h-[60px]">{children}</div>
    </div>
  );
}

export default function GlobalHari() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [activeItem, setActiveItem] = useState(null);
  const [openItem, setOpenItem] = useState(null);

  const { data: items, isLoading, isError } = useQuery({
    queryKey: ["global-hari"],
    queryFn: () => api.get("/global/hari").then((r) => r.data),
    retry: false,
  });
  const { data: users } = useQuery({ queryKey: ["users"], queryFn: () => api.get("/users").then((r) => r.data) });
  const usersById = Object.fromEntries((users || []).map((u) => [u.id, u]));

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const onDragStart = (e) => setActiveItem(e.active.data.current?.item || null);

  const onDragEnd = async (e) => {
    const { active, over } = e;
    setActiveItem(null);
    if (!over || !String(over.id).startsWith("stage-")) return;
    const target = parseInt(String(over.id).split("-")[1], 10);
    const item = active.data.current?.item;
    if (!item || item.hari_stage === target) return;
    try {
      const r = await api.post(`/work-items/${item.id}/hari`, { target_stage: target });
      if (r.data?.warning) toast.warning(r.data.warning);
      toast.success(target === 8 ? "Pekerjaan FINISH" : `Dipindah ke HARI ${target}`);
      qc.invalidateQueries({ queryKey: ["global-hari"] });
      qc.invalidateQueries({ queryKey: ["global-skor"] });
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  if (isError) {
    return (
      <div className="p-10 text-center" data-testid="global-hari-forbidden">
        <p className="text-[#44546F]">Halaman ini hanya untuk tim Admin Draf Input, Admin Pajak, Admin Perizinan, Desain & Konten, dan admin.</p>
      </div>
    );
  }

  const byStage = {};
  STAGES.forEach((s) => (byStage[s.stage] = []));
  (items || []).forEach((i) => {
    if (byStage[i.hari_stage]) byStage[i.hari_stage].push(i);
  });

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#026aa7]" data-testid="global-hari-page">
      <div className="px-5 py-4 shrink-0">
        <h1 className="font-heading text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
          <CalendarClock size={22} /> Board Harian — Proses Bisnis SKOR 5
        </h1>
        <p className="text-xs text-white/70 mt-1">
          Kartu otomatis maju 1 hari setiap hari kerja jika syarat terpenuhi. Admin dapat memajukan manual lebih cepat — sistem memblokir jika dokumen syarat belum dicentang (LOGO hanya peringatan).
        </p>
      </div>
      <div className="flex-1 overflow-x-auto overflow-y-hidden px-4 pb-4 minimal-scrollbar">
        {isLoading ? (
          <p className="text-white/80 text-sm">Memuat...</p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={onDragStart} onDragEnd={onDragEnd}>
            <div className="flex items-start gap-3 h-full">
              {STAGES.map((s) => (
                <HariColumn key={s.stage} {...s} count={byStage[s.stage].length}>
                  {byStage[s.stage].map((item) => (
                    <HariCard key={item.id} item={item} usersById={usersById} onClick={() => setOpenItem(item.id)} />
                  ))}
                  {byStage[s.stage].length === 0 && <p className="text-[11px] text-[#8590A2] text-center py-3">Kosong</p>}
                </HariColumn>
              ))}
            </div>
            <DragOverlay>
              {activeItem ? <HariCard item={activeItem} usersById={usersById} overlay /> : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>
      {openItem && <CardModal itemId={openItem} onClose={() => setOpenItem(null)} />}
    </div>
  );
}
