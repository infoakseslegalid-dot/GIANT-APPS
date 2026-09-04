import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "./AuthContext";

/**
 * Sinkronisasi realtime lintas akun tanpa refresh.
 *
 * Transport: Server-Sent Events (EventSource) ke GET /api/events. SSE dipilih
 * dibanding WebSocket karena lewat HTTP biasa — jalan baik di `next dev` maupun
 * custom server (server.mjs) — dan EventSource menangani reconnect sendiri.
 *
 * Server mengirim pesan { type, board_id?, work_item_id?, user_id?, title? }.
 * Di sini kita hanya meng-invalidate query React Query yang relevan sehingga
 * komponen yang sedang tampil otomatis refetch (komentar, board, bank data, dst).
 */
export function RealtimeProvider({ children }) {
  const { user } = useAuth();
  const qc = useQueryClient();

  useEffect(() => {
    if (!user) return;

    let es = null;
    let stopped = false;
    let reconnectTimer = null;
    let missedWhileOffline = false;

    const invalidateForMessage = (msg) => {
      if (!msg || !msg.type) return;
      if (msg.type === "hello" || msg.type === "ping") return;

      if (msg.type === "notification") {
        if (msg.user_id === user.id) {
          qc.invalidateQueries({ queryKey: ["notifications"] });
          if (msg.title) toast(msg.title);
        }
        return;
      }

      // board_update & activity → segarkan semua tampilan yang mungkin terpengaruh
      if (msg.board_id) {
        qc.invalidateQueries({ queryKey: ["board", msg.board_id] });
        qc.invalidateQueries({ queryKey: ["board-archived", msg.board_id] });
        qc.invalidateQueries({ queryKey: ["board-full", msg.board_id] });
      }
      if (msg.work_item_id) {
        qc.invalidateQueries({ queryKey: ["work-item", msg.work_item_id] });
      }
      qc.invalidateQueries({ queryKey: ["boards"] });
      qc.invalidateQueries({ queryKey: ["my-work"] });
      qc.invalidateQueries({ queryKey: ["all-work"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      qc.invalidateQueries({ queryKey: ["bank-data"] });
      qc.invalidateQueries({ queryKey: ["bank-data-summary"] });
      qc.invalidateQueries({ queryKey: ["activities"] });
      qc.invalidateQueries({ queryKey: ["global-hari"] });
      qc.invalidateQueries({ queryKey: ["global-skor"] });
    };

    const connect = () => {
      if (stopped) return;
      try {
        es = new EventSource("/api/events", { withCredentials: true });
      } catch (e) {
        reconnectTimer = setTimeout(connect, 2500);
        return;
      }

      es.onopen = () => {
        // Saat pertama connect / reconnect: tarik ulang semua supaya tidak ada
        // perubahan yang terlewat selama offline.
        if (missedWhileOffline) {
          qc.invalidateQueries();
          missedWhileOffline = false;
        }
      };

      es.onmessage = (ev) => {
        try {
          invalidateForMessage(JSON.parse(ev.data));
        } catch (e) {
          /* abaikan pesan non-JSON */
        }
      };

      es.onerror = () => {
        // EventSource akan mencoba reconnect otomatis, tapi kita paksa siklus
        // bersih + tandai perlu catch-up.
        missedWhileOffline = true;
        if (es) {
          es.close();
          es = null;
        }
        if (!stopped) {
          clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(connect, 2500);
        }
      };
    };

    connect();

    // Kalau tab kembali aktif setelah lama idle, pastikan koneksi hidup + catch-up.
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        if (!es || es.readyState === 2 /* CLOSED */) {
          missedWhileOffline = true;
          connect();
        } else {
          qc.invalidateQueries();
        }
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      stopped = true;
      clearTimeout(reconnectTimer);
      document.removeEventListener("visibilitychange", onVisible);
      if (es) es.close();
    };
  }, [user, qc]);

  return children;
}
