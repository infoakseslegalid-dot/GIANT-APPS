import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Send, Trash2, Loader2, Paperclip, Maximize2 } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api, errMsg } from "@/lib/api";
import { useAiAssistant } from "@/context/AiAssistantContext";

const SUGGESTIONS = {
  board: [
    "Ringkas isi board ini",
    "Kartu mana yang deadline-nya minggu ini?",
    "Kartu apa saja yang belum ada PIC-nya?",
  ],
  card: [
    "Apa status kartu ini dan langkah berikutnya?",
    "Ringkas semua komentar di kartu ini",
    "Apa saja checklist yang belum selesai?",
  ],
};

export default function AiAssistantPanel() {
  const { scope, open, close } = useAiAssistant();
  const navigate = useNavigate();

  const openFullPage = () => {
    if (!scope) return;
    const key = scope.type === "card" ? "card" : "board";
    const id = scope.type === "card" ? scope.workItemId : scope.boardId;
    const qs = new URLSearchParams({ [key]: id, label: scope.title || "" }).toString();
    close();
    navigate(`/ai?${qs}`);
  };
  const [messages, setMessages] = useState([]); // { role, content }
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [includeAttachments, setIncludeAttachments] = useState(false);
  const [notConfigured, setNotConfigured] = useState(false);
  const scrollRef = useRef(null);

  // Reset percakapan tiap kali konteks (board/kartu) berganti.
  const scopeKey = scope ? `${scope.type}:${scope.boardId || scope.workItemId}` : null;
  useEffect(() => {
    setMessages([]);
    setInput("");
    setIncludeAttachments(false);
    setNotConfigured(false);
  }, [scopeKey]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  const send = async (text) => {
    const content = (text ?? input).trim();
    if (!content || loading || !scope) return;
    const next = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setLoading(true);
    setNotConfigured(false);
    try {
      const payload = {
        scope: scope.type,
        messages: next,
        ...(scope.type === "board"
          ? { boardId: scope.boardId }
          : { workItemId: scope.workItemId, includeAttachments }),
      };
      const r = await api.post("/ai/chat", payload);
      setMessages((m) => [...m, { role: "assistant", content: r.data.reply }]);
      if (Array.isArray(r.data.skipped) && r.data.skipped.length) {
        setMessages((m) => [
          ...m,
          { role: "assistant", content: `_Catatan: ${r.data.skipped.length} lampiran dilewati (${r.data.skipped.join("; ")})._` },
        ]);
      }
    } catch (e) {
      if (e?.response?.status === 501) {
        setNotConfigured(true);
      } else {
        setMessages((m) => [...m, { role: "assistant", content: `⚠️ ${errMsg(e)}` }]);
      }
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && close()}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-lg"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-[hsl(var(--hairline))] px-4 py-3 pr-12">
          <Sparkles size={18} className="text-[#0c66e4]" />
          <div className="min-w-0">
            <p className="text-sm font-bold leading-tight text-foreground">Tanya AI</p>
            <p className="truncate text-[11px] text-3">
              {scope?.type === "card" ? "Kartu: " : "Board: "}
              {scope?.title}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={openFullPage}
              className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-3 hover:bg-[hsl(var(--muted))]"
              title="Buka di halaman AI (chat penuh, tersimpan)"
            >
              <Maximize2 size={12} /> Halaman AI
            </button>
            {messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-3 hover:bg-[hsl(var(--muted))]"
              >
                <Trash2 size={12} /> Bersihkan
              </button>
            )}
          </div>
        </div>

        {/* Transkrip */}
        <div ref={scrollRef} className="minimal-scrollbar flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {messages.length === 0 && !notConfigured && (
            <div className="space-y-3">
              <p className="text-xs text-3">
                Tanyakan apa saja tentang {scope?.type === "card" ? "kartu ini" : "board ini"}. AI hanya
                membaca data yang boleh kamu lihat.
              </p>
              <div className="flex flex-col gap-1.5">
                {(SUGGESTIONS[scope?.type] || []).map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-lg border border-[hsl(var(--hairline))] px-3 py-2 text-left text-[13px] text-foreground hover:bg-[hsl(var(--muted))]"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {notConfigured && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-[13px] text-amber-900 dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-200">
              <p className="font-semibold">Asisten AI belum dikonfigurasi</p>
              <p className="mt-1">
                Setel kunci API provider di <code>.env</code> server (<code>GROQ_API_KEY</code> atau{" "}
                <code>ANTHROPIC_API_KEY</code> sesuai <code>AI_PROVIDER</code>), lalu restart aplikasi.
              </p>
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={i}
              className={
                m.role === "user"
                  ? "ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-[#0c66e4] px-3 py-2 text-[13px] text-white"
                  : "mr-auto max-w-[92%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-[hsl(var(--muted))] px-3 py-2 text-[13px] text-foreground"
              }
            >
              {m.content}
            </div>
          ))}

          {loading && (
            <div className="mr-auto flex items-center gap-2 rounded-2xl rounded-bl-sm bg-[hsl(var(--muted))] px-3 py-2 text-[13px] text-3">
              <Loader2 size={14} className="animate-spin" /> AI sedang membaca…
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-[hsl(var(--hairline))] px-4 py-3">
          {scope?.type === "card" && (
            <label className="mb-2 flex cursor-pointer items-center gap-2 text-[12px] text-2">
              <input
                type="checkbox"
                checked={includeAttachments}
                onChange={(e) => setIncludeAttachments(e.target.checked)}
                className="h-3.5 w-3.5 accent-[#0c66e4]"
              />
              <Paperclip size={13} /> Sertakan isi lampiran (PDF, gambar, teks)
            </label>
          )}
          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={2}
              placeholder="Tulis pertanyaan… (Enter kirim, Shift+Enter baris baru)"
              className="max-h-40 min-h-[44px] flex-1 resize-none text-[13px]"
            />
            <Button
              type="button"
              size="icon"
              disabled={loading || !input.trim()}
              onClick={() => send()}
              className="h-11 w-11 shrink-0"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
