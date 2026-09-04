import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { X, ArrowRight } from "lucide-react";
import { api, errMsg } from "../lib/api";

const inputCls =
  "h-9 w-full rounded-lg border border-[hsl(var(--hairline))] px-3 text-sm text-foreground bg-[hsl(var(--elevated))] outline-none focus:ring-2 focus:ring-[#0C66E4]";

export default function MoveCardDialog({ item, onClose, onDone }) {
  const currentBoardId = item.board_id;
  const currentListId = item.list_id;

  const [boardId, setBoardId] = useState(currentBoardId);
  const [listId, setListId] = useState(currentListId);
  const [moving, setMoving] = useState(false);

  const { data: boards } = useQuery({
    queryKey: ["boards"],
    queryFn: () => api.get("/boards").then((r) => r.data),
  });
  const { data: full } = useQuery({
    queryKey: ["board-full", boardId],
    queryFn: () => api.get(`/boards/${boardId}/full`).then((r) => r.data),
    enabled: !!boardId,
  });

  const lists = (full?.lists || []).slice().sort((a, b) => a.position - b.position);

  // saat ganti board, pilih list pertama board itu (atau list saat ini bila board sama)
  useEffect(() => {
    if (!lists.length) return;
    if (boardId === currentBoardId && lists.some((l) => l.id === currentListId)) {
      setListId(currentListId);
    } else if (!lists.some((l) => l.id === listId)) {
      setListId(lists[0].id);
    }
  }, [full]); // eslint-disable-line

  const crossBoard = boardId !== currentBoardId;
  const noChange = boardId === currentBoardId && listId === currentListId;

  const submit = async () => {
    if (!listId) return toast.error("Pilih list tujuan");
    if (noChange) return onClose();
    setMoving(true);
    try {
      const r = await api.post(`/work-items/${item.id}/move`, {
        list_id: listId,
        board_id: boardId,
        position: 65535,
      });
      if (r.data?.needs_label_reassign) {
        toast.warning(
          `Kartu dipindahkan. Label berikut tidak ada di board tujuan & dilepas: ${(r.data.dropped_labels || []).join(", ")}`,
        );
      } else {
        toast.success("Kartu dipindahkan");
      }
      onDone?.();
      onClose();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setMoving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex justify-center items-start pt-20 bg-black/60 backdrop-blur-sm fade-enter"
      onClick={onClose}
      data-testid="move-card-dialog"
    >
      <div className="bg-[hsl(var(--elevated))] w-full max-w-md rounded-xl shadow-2xl p-6 modal-enter" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-heading text-lg font-bold text-foreground">Pindahkan Kartu</h2>
          <button aria-label="Tutup" onClick={onClose} className="p-1.5 rounded hover:bg-[hsl(var(--muted))] text-2">
            <X size={18} />
          </button>
        </div>
        <div className="bg-[hsl(var(--muted))] rounded-lg px-3 py-2 mb-4">
          <p className="text-sm font-semibold text-foreground truncate">{item.title}</p>
          <p className="text-xs text-2">
            {full && boardId === currentBoardId ? full.board?.name : "Board saat ini"} ·{" "}
            {lists.find((l) => l.id === currentListId)?.name || item.list_name || "—"}
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-2">Board tujuan</label>
            <select
              data-testid="move-board-select"
              value={boardId}
              onChange={(e) => setBoardId(e.target.value)}
              className={inputCls}
            >
              {(boards || []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                  {b.division_name ? ` — ${b.division_name}` : ""}
                  {b.id === currentBoardId ? " (saat ini)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-2">List tujuan</label>
            <select
              data-testid="move-list-select"
              value={listId}
              onChange={(e) => setListId(e.target.value)}
              className={inputCls}
              disabled={!lists.length}
            >
              {lists.length === 0 && <option value="">Memuat…</option>}
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                  {l.id === currentListId ? " (saat ini)" : ""}
                </option>
              ))}
            </select>
          </div>

          {crossBoard && (
            <p className="text-[11px] text-3 leading-snug">
              Pindah antar-board: label yang tidak ada di board tujuan akan dilepas otomatis. Komentar, lampiran, dan checklist ikut.
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 h-10 rounded-lg bg-[hsl(var(--muted))] hover:bg-[hsl(var(--accent))] text-foreground text-sm font-semibold transition-colors"
            >
              Batal
            </button>
            <button
              data-testid="move-submit-button"
              onClick={submit}
              disabled={moving || !listId || noChange}
              className="flex-1 h-10 rounded-lg bg-[#0c66e4] hover:bg-[#0052cc] text-white text-sm font-semibold transition-colors active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <ArrowRight size={14} /> {moving ? "Memindahkan…" : "Pindahkan"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
