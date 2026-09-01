import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "./AuthContext";

export function RealtimeProvider({ children }) {
  const { user } = useAuth();
  const qc = useQueryClient();

  useEffect(() => {
    if (!user) return;
    if (!document.cookie.includes("access_token")) return;
    const wsUrl = (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.host + '/api/ws';
    let ws = null;
    let closed = false;
    let retry = null;

    const connect = () => {
      ws = new WebSocket(wsUrl);
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === "notification") {
            if (msg.user_id === user.id) {
              qc.invalidateQueries({ queryKey: ["notifications"] });
              toast(msg.title || "Notifikasi baru");
            }
          } else if (msg.type === "board_update") {
            if (msg.board_id) qc.invalidateQueries({ queryKey: ["board", msg.board_id] });
            if (msg.work_item_id) qc.invalidateQueries({ queryKey: ["work-item", msg.work_item_id] });
            qc.invalidateQueries({ queryKey: ["boards"] });
            qc.invalidateQueries({ queryKey: ["my-work"] });
            qc.invalidateQueries({ queryKey: ["all-work"] });
            qc.invalidateQueries({ queryKey: ["stats"] });
          } else if (msg.type === "activity") {
            if (msg.work_item_id) qc.invalidateQueries({ queryKey: ["work-item", msg.work_item_id] });
            qc.invalidateQueries({ queryKey: ["activities"] });
          }
        } catch (e) {}
      };
      ws.onclose = () => {
        if (!closed) retry = setTimeout(connect, 3000);
      };
    };
    connect();
    const ping = setInterval(() => {
      if (ws && ws.readyState === 1) ws.send("ping");
    }, 30000);
    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      clearInterval(ping);
      if (ws) ws.close();
    };
  }, [user, qc]);

  return children;
}
