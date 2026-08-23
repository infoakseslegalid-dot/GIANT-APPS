import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { api } from "../lib/api";
import CardModal from "../components/CardModal";

const DAY_NAMES = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

export default function Calendar() {
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [openItem, setOpenItem] = useState(null);

  const { data: items } = useQuery({
    queryKey: ["calendar", month],
    queryFn: () => api.get(`/calendar?month=${month}`).then((r) => r.data),
  });

  const [y, m] = month.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const daysInMonth = new Date(y, m, 0).getDate();
  const startOffset = (first.getDay() + 6) % 7;
  const monthLabel = first.toLocaleDateString("id-ID", { month: "long", year: "numeric" });

  const shift = (dir) => {
    const d = new Date(y, m - 1 + dir, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  const byDay = {};
  (items || []).forEach((i) => {
    const day = parseInt(i.due_date.split("-")[2], 10);
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(i);
  });

  const todayStr = now.toISOString().slice(0, 10);

  return (
    <div className="p-6 max-w-7xl mx-auto" data-testid="calendar-page">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-[#172B4D] flex items-center gap-2">
            <CalendarDays size={24} className="text-[#0C66E4]" /> Kalender
          </h1>
          <p className="text-sm text-[#44546F] mt-1">Pekerjaan berdasarkan tenggat waktu.</p>
        </div>
        <div className="flex items-center gap-2">
          <button data-testid="calendar-prev" onClick={() => shift(-1)} className="p-2 rounded-lg bg-white border border-[#DFE1E6] hover:bg-[#F1F2F4] transition-colors" aria-label="Bulan sebelumnya">
            <ChevronLeft size={16} />
          </button>
          <span className="font-heading font-bold text-[#172B4D] w-40 text-center" data-testid="calendar-month-label">{monthLabel}</span>
          <button data-testid="calendar-next" onClick={() => shift(1)} className="p-2 rounded-lg bg-white border border-[#DFE1E6] hover:bg-[#F1F2F4] transition-colors" aria-label="Bulan berikutnya">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#DFE1E6] shadow-sm overflow-hidden">
        <div className="grid grid-cols-7 border-b border-[#DFE1E6]">
          {DAY_NAMES.map((d) => (
            <div key={d} className="px-2 py-2 text-center text-[11px] font-bold uppercase tracking-wider text-[#8590A2] border-r last:border-r-0 border-[#F1F2F4]">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: startOffset }).map((_, i) => (
            <div key={"x" + i} className="min-h-28 border-r border-b border-[#F1F2F4] bg-[#FAFBFC]" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = `${month}-${String(day).padStart(2, "0")}`;
            const isToday = dateStr === todayStr;
            const dayItems = byDay[day] || [];
            return (
              <div key={day} className={`min-h-28 border-r border-b border-[#F1F2F4] p-1.5 ${isToday ? "bg-[#E9F2FF]" : ""}`} data-testid={`calendar-day-${day}`}>
                <p className={`text-xs font-bold mb-1 ${isToday ? "text-[#0C66E4]" : "text-[#44546F]"}`}>{day}</p>
                <div className="space-y-1">
                  {dayItems.slice(0, 3).map((item) => (
                    <button
                      key={item.id}
                      data-testid={`calendar-item-${item.id}`}
                      onClick={() => setOpenItem(item.id)}
                      className="w-full text-left text-[10px] font-semibold text-white rounded px-1.5 py-1 truncate hover:opacity-85 transition-opacity"
                      style={{ backgroundColor: item.status === "done" ? "#22A06B" : item.board_background || "#0079bf" }}
                      title={item.title}
                    >
                      {item.title}
                    </button>
                  ))}
                  {dayItems.length > 3 && <p className="text-[10px] text-[#8590A2] px-1">+{dayItems.length - 3} lainnya</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {openItem && <CardModal itemId={openItem} onClose={() => setOpenItem(null)} />}
    </div>
  );
}
