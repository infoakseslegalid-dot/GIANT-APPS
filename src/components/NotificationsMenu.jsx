import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Bell, BellOff, Check, CheckCheck, MessageSquare, AtSign, Send,
  UserPlus, Sparkles, ChevronRight,
} from "lucide-react";
import { api, fmtDateTime, timeAgo } from "../lib/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

/** ikon + warna per jenis notifikasi */
const TYPE_META = {
  comment: { Icon: MessageSquare, fg: "#0C66E4", bg: "#E9F2FF" },
  mention: { Icon: AtSign, fg: "#5E4DB2", bg: "#EAE6FF" },
  sent: { Icon: Send, fg: "#206A83", bg: "#E7F9FF" },
  assigned: { Icon: UserPlus, fg: "#216E4E", bg: "#DCFFF1" },
  automation: { Icon: Sparkles, fg: "#A54800", bg: "#FFF3D6" },
  info: { Icon: Bell, fg: "#44546F", bg: "#F1F2F4" },
};

function Row({ n, onOpen, onMarkRead }) {
  const meta = TYPE_META[n.type] || TYPE_META.info;
  const { Icon } = meta;
  const clickable = !!(n.board_id && n.work_item_id);
  return (
    <button
      data-testid={`notification-item-${n.id}`}
      onClick={() => onOpen(n)}
      className={`group relative flex w-full gap-3 px-3.5 py-3 text-left transition-colors ${
        n.is_read ? "hover:bg-[hsl(var(--muted))]" : "bg-[#F0F6FF] hover:bg-[#E4EFFF]"
      }`}
    >
      {!n.is_read && <span className="absolute left-0 top-0 h-full w-[3px] bg-[#0C66E4]" />}
      <span
        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]"
        style={{ background: meta.bg, color: meta.fg }}
      >
        <Icon size={17} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start gap-2">
          <span className={`flex-1 text-[13.5px] leading-snug ${n.is_read ? "font-medium text-2" : "font-bold text-foreground"}`}>
            {n.title}
          </span>
          <span className="shrink-0 whitespace-nowrap pt-0.5 text-[11px] text-3" title={fmtDateTime(n.created_at)}>
            {timeAgo(n.created_at)}
          </span>
        </span>
        {n.body && (
          <span className="mt-0.5 line-clamp-2 block text-[12.5px] leading-relaxed text-3">
            {n.body}
          </span>
        )}
        <span className="mt-1 flex items-center gap-2">
          {clickable && (
            <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-[#0C66E4]">
              Buka kartu <ChevronRight size={12} />
            </span>
          )}
        </span>
      </span>
      {!n.is_read && (
        <span
          role="button"
          tabIndex={0}
          title="Tandai dibaca"
          onClick={(e) => { e.stopPropagation(); onMarkRead(n); }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onMarkRead(n); } }}
          className="absolute right-2 top-2 hidden h-6 w-6 items-center justify-center rounded-full text-2 hover:bg-[hsl(var(--accent))] group-hover:flex"
        >
          <Check size={13} />
        </span>
      )}
    </button>
  );
}

export default function NotificationsMenu() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.get("/notifications/mine").then((r) => r.data),
    refetchInterval: 60000,
  });
  const unread = data?.unread || 0;
  const items = data?.items || [];
  const unreadItems = items.filter((n) => !n.is_read);
  const readItems = items.filter((n) => n.is_read);

  const markRead = async (n) => {
    try {
      await api.post(`/notifications/${n.id}/read`);
      qc.invalidateQueries({ queryKey: ["notifications"] });
    } catch {}
  };

  const openItem = async (n) => {
    await markRead(n);
    if (n.board_id && n.work_item_id) {
      navigate(`/board/${n.board_id}?card=${n.work_item_id}`);
    }
  };

  const readAll = async () => {
    await api.post("/notifications/read-all");
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          data-testid="notifications-bell-button"
          aria-label="Notifikasi"
          className="relative flex h-8 w-8 items-center justify-center rounded-full text-white transition-colors hover:bg-[hsl(var(--elevated))]/20 active:scale-95"
        >
          <Bell size={18} />
          {unread > 0 && (
            <span
              data-testid="notifications-unread-badge"
              className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-[#0C66E4] bg-[#CA3521] px-1 text-[10px] font-bold leading-none text-white"
            >
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={10}
        className="w-[min(440px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-[hsl(var(--hairline))] bg-[hsl(var(--elevated))] p-0 shadow-[0_12px_40px_rgba(9,30,66,0.24)]"
      >
        {/* header */}
        <div className="flex items-center justify-between gap-2 border-b border-[#EBECF0] px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="font-heading text-[15px] font-bold text-foreground">Notifikasi</span>
            {unread > 0 && (
              <span className="rounded-full bg-[#CA3521] px-2 py-0.5 text-[11px] font-bold text-white">{unread} baru</span>
            )}
          </div>
          {unread > 0 && (
            <button
              data-testid="notifications-read-all-button"
              onClick={readAll}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-semibold text-[#0C66E4] hover:bg-[#E9F2FF]"
            >
              <CheckCheck size={14} /> Tandai semua
            </button>
          )}
        </div>

        {/* list */}
        <div className="max-h-[min(560px,70vh)] overflow-y-auto minimal-scrollbar">
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-12 text-center" data-testid="notifications-empty">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[hsl(var(--muted))] text-3">
                <BellOff size={24} />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">Belum ada notifikasi</p>
                <p className="mt-0.5 text-xs text-3">Aktivitas yang melibatkan Anda akan muncul di sini.</p>
              </div>
            </div>
          ) : (
            <>
              {unreadItems.length > 0 && (
                <>
                  {readItems.length > 0 && (
                    <p className="bg-[hsl(var(--elevated))] px-4 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wider text-3">
                      Belum dibaca
                    </p>
                  )}
                  <div className="divide-y divide-[#EBECF0]">
                    {unreadItems.map((n) => (
                      <Row key={n.id} n={n} onOpen={openItem} onMarkRead={markRead} />
                    ))}
                  </div>
                </>
              )}
              {readItems.length > 0 && (
                <>
                  {unreadItems.length > 0 && (
                    <p className="border-t border-[#EBECF0] bg-[hsl(var(--elevated))] px-4 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wider text-3">
                      Sebelumnya
                    </p>
                  )}
                  <div className="divide-y divide-[#EBECF0]">
                    {readItems.map((n) => (
                      <Row key={n.id} n={n} onOpen={openItem} onMarkRead={markRead} />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
