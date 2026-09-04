import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Image as ImageIcon, Upload } from "lucide-react";
import { api, errMsg } from "../lib/api";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

// Palet solid — konsisten dengan design system (dipakai juga di Admin Panel).
const PRESET = [
  "#0079BF", "#0C66E4", "#519839", "#4BBF6B", "#00AECC", "#6CC3E0",
  "#D29034", "#E56910", "#B04632", "#CA3521", "#89609E", "#9F8FEF",
  "#CD5A91", "#E774BB", "#42526E", "#172B4D", "#7A869A", "#091E42",
];
const ACCEPT = "image/jpeg,image/png,image/webp,image/gif";
const MAX = 5 * 1024 * 1024;

export default function BoardBackgroundMenu({ board, boardId }) {
  const qc = useQueryClient();
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const hasImage = !!board?.background_image_url;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["board", boardId] });
    qc.invalidateQueries({ queryKey: ["boards"] });
  };

  const setColor = async (color) => {
    setBusy(true);
    try {
      await api.patch(`/boards/${boardId}/background`, { color });
      refresh();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };

  const removeImage = async () => {
    setBusy(true);
    try {
      await api.patch(`/boards/${boardId}/background`, { clear_image: true });
      toast.success("Gambar latar dihapus");
      refresh();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };

  const onFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!ACCEPT.split(",").includes(f.type)) return toast.error("Format harus JPG, PNG, WEBP, atau GIF");
    if (f.size > MAX) return toast.error("Ukuran maksimal 5 MB");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      await api.post(`/boards/${boardId}/background/image`, fd);
      toast.success("Latar board diperbarui");
      refresh();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          data-testid="board-bg-button"
          className="flex items-center gap-1.5 h-8 px-3 rounded bg-[hsl(var(--elevated))]/15 hover:bg-[hsl(var(--elevated))]/25 text-sm font-medium transition-colors active:scale-95"
        >
          <ImageIcon size={14} /> Latar
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 bg-[hsl(var(--elevated))] shadow-lg p-3" align="end">
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-3">Warna Solid</p>
        <div className="mb-3 grid grid-cols-6 gap-1.5">
          {PRESET.map((c) => (
            <button
              key={c}
              disabled={busy}
              data-testid={`board-bg-color-${c}`}
              onClick={() => setColor(c)}
              className={`h-8 rounded-md transition-transform hover:scale-105 ${
                !hasImage && (board?.background || "").toUpperCase() === c ? "ring-2 ring-[#0C66E4] ring-offset-1" : ""
              }`}
              style={{ backgroundColor: c }}
              aria-label={`Warna ${c}`}
            />
          ))}
        </div>

        <button
          disabled={busy}
          data-testid="board-bg-upload-button"
          onClick={() => fileRef.current?.click()}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[hsl(var(--hairline))] py-2 text-sm font-semibold text-foreground hover:bg-[hsl(var(--muted))] disabled:opacity-50"
        >
          <Upload size={14} /> Unggah Gambar
        </button>
        <input ref={fileRef} type="file" accept={ACCEPT} className="hidden" onChange={onFile} />
        <p className="mt-1.5 text-[11px] leading-snug text-3">
          JPG / PNG / WEBP / GIF, maks 5 MB. Overlay gelap otomatis ditambahkan agar teks & kartu tetap terbaca.
        </p>

        {hasImage && (
          <button
            disabled={busy}
            data-testid="board-bg-remove-image"
            onClick={removeImage}
            className="mt-2 w-full text-xs font-semibold text-[#CA3521] hover:underline"
          >
            Hapus gambar latar
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
