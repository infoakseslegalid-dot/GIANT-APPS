import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Bell, Check } from "lucide-react";
import { api, fmtDateTime } from "../lib/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

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

  const openItem = async (n) => {
    try {
      await api.post(`/notifications/${n.id}/read`);
      qc.invalidateQueries({ queryKey: ["notifications"] });
    } catch {}
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
          className="relative h-8 w-8 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors active:scale-95"
        >
          <Bell size={17} />
          {unread > 0 && (
            <span
              data-testid="notifications-unread-badge"
              className="absolute -top-0.5 -right-0.5 bg-[#CA3521] text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center"
            >
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96 max-h-[480px] overflow-y-auto minimal-scrollbar bg-white shadow-lg p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b sticky top-0 bg-white z-10">
          <span className="font-heading font-semibold text-[#172B4D]">Notifikasi</span>
          {unread > 0 && (
            <button
              data-testid="notifications-read-all-button"
              onClick={readAll}
              className="text-xs text-[#0C66E4] hover:underline flex items-center gap-1"
            >
              <Check size={12} /> Tandai semua dibaca
            </button>
          )}
        </div>
        {items.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-[#44546F]" data-testid="notifications-empty">
            Belum ada notifikasi
          </div>
        )}
        {items.map((n) => (
          <button
            key={n.id}
            data-testid={`notification-item-${n.id}`}
            onClick={() => openItem(n)}
            className={`w-full text-left px-4 py-3 border-b last:border-b-0 hover:bg-[#F1F2F4] transition-colors ${
              n.is_read ? "opacity-60" : "bg-[#E9F2FF]"
            }`}
          >
            <p className="text-sm font-semibold text-[#172B4D]">{n.title}</p>
            <p className="text-xs text-[#44546F] mt-0.5 line-clamp-2">{n.body}</p>
            <p className="text-[10px] text-[#8590A2] mt-1">{fmtDateTime(n.created_at)}</p>
          </button>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
