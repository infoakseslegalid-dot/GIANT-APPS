import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, CalendarDays, X, LayoutGrid } from "lucide-react";
import { api, PRIORITIES } from "../lib/api";
import { PriorityFlag } from "../components/common";
import CardModal from "../components/kanban/CardModalWrapper";

const DAY_NAMES = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
const PRIO_COLOR = Object.fromEntries(PRIORITIES.map((p) => [p.value, p.color]));
const PRIO_ORDER = ["urgent", "high", "medium", "low", "none"];

function DayPanel({ dateStr, items, onOpenItem, onClose }) {
  const label = new Date(dateStr + "T00:00:00").toLocaleDateString("id-ID", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  const sorted = [...items].sort(
    (a, b) => PRIO_ORDER.indexOf(a.priority) - PRIO_ORDER.indexOf(b.priority),
  );
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-16" onClick={onClose} data-testid="calendar-day-panel">
      <div className="w-full max-w-lg rounded-xl bg-[hsl(var(--elevated))] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[hsl(var(--hairline))] px-5 py-3.5">
          <div>
            <h2 className="font-heading text-base font-bold text-foreground">{label}</h2>
            <p className="text-xs text-3">{items.length} pekerjaan jatuh tempo</p>
          </div>
          <button onClick={onClose} className="rounded p-1.5 text-2 hover:bg-[hsl(var(--muted))]"><X size={18} /></button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto minimal-scrollbar p-3">
          {sorted.map((it) => (
            <button
              key={it.id}
              data-testid={`day-panel-item-${it.id}`}
              onClick={() => onOpenItem(it.id)}
              className="flex w-full gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-[hsl(var(--muted))]"
            >
              <span
                className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: it.status === "done" ? "#22A06B" : PRIO_COLOR[it.priority] || "#8590A2" }}
              />
              <span className="min-w-0 flex-1">
                <span className={`block text-sm font-semibold text-foreground ${it.status === "done" ? "line-through opacity-60" : ""}`}>
                  {it.title}
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-3">
                  {it.board_name && <span className="inline-flex items-center gap-1"><LayoutGrid size={10} /> {it.board_name}</span>}
                  {it.list_name && <span>• {it.list_name}</span>}
                  {it.pic_name && <span>· PIC: {it.pic_name}</span>}
                </span>
                {it.client_name && <span className="mt-0.5 block text-xs text-2">{it.client_name}</span>}
              </span>
              <span className="shrink-0"><PriorityFlag priority={it.priority} /></span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Calendar() {
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [openItem, setOpenItem] = useState(null);
  const [dayPanel, setDayPanel] = useState(null);

  const { data: items, isError } = useQuery({
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

  const byDay = useMemo(() => {
    const map = {};
    (items || []).forEach((i) => {
      if (!i.due_date) return;
      const day = parseInt(i.due_date.split("-")[2], 10);
      (map[day] ||= []).push(i);
    });
    return map;
  }, [items]);

  const todayStr = now.toISOString().slice(0, 10);
  const totalMonth = (items || []).length;

  return (
    <div className="p-6 max-w-7xl mx-auto" data-testid="calendar-page">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <CalendarDays size={24} className="text-[#0C66E4]" /> Kalender
          </h1>
          <p className="text-sm text-2 mt-1">
            Pekerjaan berdasarkan tenggat waktu — {totalMonth} bulan ini. Klik tanggal untuk melihat daftarnya.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button data-testid="calendar-prev" onClick={() => shift(-1)} className="p-2 rounded-lg bg-[hsl(var(--elevated))] border border-[hsl(var(--hairline))] hover:bg-[hsl(var(--muted))] transition-colors" aria-label="Bulan sebelumnya">
            <ChevronLeft size={16} />
          </button>
          <span className="font-heading font-bold text-foreground w-40 text-center" data-testid="calendar-month-label">{monthLabel}</span>
          <button data-testid="calendar-next" onClick={() => shift(1)} className="p-2 rounded-lg bg-[hsl(var(--elevated))] border border-[hsl(var(--hairline))] hover:bg-[hsl(var(--muted))] transition-colors" aria-label="Bulan berikutnya">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* legenda prioritas */}
      <div className="mb-3 flex flex-wrap items-center gap-3 text-[11px] text-3">
        {PRIORITIES.filter((p) => p.value !== "none").map((p) => (
          <span key={p.value} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} /> {p.label}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#22A06B]" /> Selesai
        </span>
      </div>

      {isError && (
        <div className="mb-3 rounded-lg border border-[#FFD5CE] bg-[#FFF3F0] px-4 py-2 text-sm text-[#AE2A19]">
          Gagal memuat kalender.
        </div>
      )}

      <div className="bg-[hsl(var(--elevated))] rounded-xl border border-[hsl(var(--hairline))] shadow-sm overflow-hidden">
        <div className="grid grid-cols-7 border-b border-[hsl(var(--hairline))]">
          {DAY_NAMES.map((d) => (
            <div key={d} className="px-2 py-2 text-center text-[11px] font-bold uppercase tracking-wider text-3 border-r last:border-r-0 border-[hsl(var(--hairline))]">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: startOffset }).map((_, i) => (
            <div key={"x" + i} className="min-h-[112px] border-r border-b border-[hsl(var(--hairline))] bg-[#FAFBFC]" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = `${month}-${String(day).padStart(2, "0")}`;
            const isToday = dateStr === todayStr;
            const dayItems = byDay[day] || [];
            const hasItems = dayItems.length > 0;
            // prioritas unik yang ada di hari itu (untuk deretan dot)
            const prios = [...new Set(dayItems.map((it) => (it.status === "done" ? "done" : it.priority)))]
              .sort((a, b) => PRIO_ORDER.indexOf(a) - PRIO_ORDER.indexOf(b));
            return (
              <div
                key={day}
                data-testid={`calendar-day-${day}`}
                onClick={() => hasItems && setDayPanel(dateStr)}
                className={`min-h-[112px] border-r border-b border-[hsl(var(--hairline))] p-1.5 transition-colors ${
                  isToday ? "bg-[#E9F2FF]" : "bg-[hsl(var(--elevated))]"
                } ${hasItems ? "cursor-pointer hover:bg-[hsl(var(--muted))]" : ""}`}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className={`text-xs font-bold ${isToday ? "text-[#0C66E4]" : "text-2"}`}>{day}</span>
                  {hasItems && (
                    <span
                      data-testid={`calendar-day-badge-${day}`}
                      className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#0C66E4] px-1 text-[10px] font-bold leading-none text-white"
                    >
                      {dayItems.length}
                    </span>
                  )}
                </div>
                {hasItems && (
                  <div className="mb-1 flex flex-wrap gap-1">
                    {prios.map((p) => (
                      <span
                        key={p}
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: p === "done" ? "#22A06B" : PRIO_COLOR[p] || "#8590A2" }}
                      />
                    ))}
                  </div>
                )}
                <div className="space-y-1">
                  {dayItems.slice(0, 2).map((item) => (
                    <button
                      key={item.id}
                      data-testid={`calendar-item-${item.id}`}
                      onClick={(e) => { e.stopPropagation(); setOpenItem(item.id); }}
                      className="flex w-full items-center gap-1 rounded px-1.5 py-1 text-left text-[10px] font-semibold text-white transition-opacity hover:opacity-85"
                      style={{ backgroundColor: item.status === "done" ? "#22A06B" : PRIO_COLOR[item.priority] || item.board_background || "#0079bf" }}
                      title={`${item.title}${item.board_name ? ` — ${item.board_name}` : ""}`}
                    >
                      <span className="truncate">{item.title}</span>
                    </button>
                  ))}
                  {dayItems.length > 2 && (
                    <p className="px-1 text-[10px] font-semibold text-[#0C66E4]">
                      +{dayItems.length - 2} lainnya
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {dayPanel && (
        <DayPanel
          dateStr={dayPanel}
          items={byDay[parseInt(dayPanel.split("-")[2], 10)] || []}
          onOpenItem={(id) => { setDayPanel(null); setOpenItem(id); }}
          onClose={() => setDayPanel(null)}
        />
      )}
      {openItem && <CardModal itemId={openItem} onClose={() => setOpenItem(null)} />}
    </div>
  );
}
