import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Sparkles, Plus, Send, Trash2, Loader2, Pencil, Check, X,
  LayoutGrid, CreditCard, Paperclip, User as UserIcon, Eye,
} from "lucide-react";
import { api, errMsg } from "../lib/api";
import { useAuth } from "../context/AuthContext";

const TYPE_META = {
  board: { icon: LayoutGrid, label: "Board" },
  card: { icon: CreditCard, label: "Kartu" },
  attachment: { icon: Paperclip, label: "Lampiran" },
  user: { icon: UserIcon, label: "User" },
};
const TYPE_TABS = ["board", "card", "attachment", "user"];

function RefChip({ r, onRemove }) {
  const Icon = (TYPE_META[r.type] || TYPE_META.board).icon;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#e9f2ff] px-2 py-0.5 text-[12px] font-medium text-[#0c66e4] dark:bg-[#0c66e4]/15">
      <Icon size={12} />
      <span className="max-w-[160px] truncate">{r.label}</span>
      {onRemove && (
        <button onClick={onRemove} className="ml-0.5 rounded-full hover:bg-[#0c66e4]/20">
          <X size={11} />
        </button>
      )}
    </span>
  );
}

export default function AiChat() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const isSuperAdmin = user?.role === "super_admin";

  const [viewUserId, setViewUserId] = useState(""); // super admin: lihat chat user lain
  const [activeId, setActiveId] = useState(null);
  const [input, setInput] = useState("");
  const [refs, setRefs] = useState([]); // [{type,id,label}]
  const [sending, setSending] = useState(false);
  const [notConfigured, setNotConfigured] = useState(false);
  const [renaming, setRenaming] = useState(null);
  const [renameText, setRenameText] = useState("");

  // ── mention picker ──
  const [mOpen, setMOpen] = useState(false);
  const [mQuery, setMQuery] = useState("");
  const [mTab, setMTab] = useState("board");
  const [mResults, setMResults] = useState([]);
  const taRef = useRef(null);
  const scrollRef = useRef(null);

  const effectiveUserId = viewUserId || user?.id;
  const readOnly = !!viewUserId && viewUserId !== user?.id;

  const { data: convData } = useQuery({
    queryKey: ["ai-conversations", effectiveUserId],
    queryFn: () =>
      api
        .get("/ai/conversations", { params: viewUserId ? { userId: viewUserId } : {} })
        .then((r) => r.data),
  });
  const conversations = convData?.conversations || [];

  const { data: chatUsers } = useQuery({
    queryKey: ["ai-chat-users"],
    queryFn: () => api.get("/ai/chat-users").then((r) => r.data.users),
    enabled: isSuperAdmin,
  });

  const { data: convo, isFetching: convoLoading } = useQuery({
    queryKey: ["ai-conversation", activeId],
    queryFn: () => api.get(`/ai/conversations/${activeId}`).then((r) => r.data),
    enabled: !!activeId,
  });
  const messages = convo?.messages || [];

  // Pilih percakapan pertama saat daftar berubah & belum ada yang aktif.
  useEffect(() => {
    if (!activeId && conversations.length) setActiveId(conversations[0].id);
    if (activeId && conversations.length && !conversations.some((c) => c.id === activeId)) {
      setActiveId(conversations[0]?.id || null);
    }
  }, [conversations, activeId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  // Deep-link dari panel cepat: /ai?board=<id>&label=<nama> atau ?card=<id>&label=
  useEffect(() => {
    const board = params.get("board");
    const card = params.get("card");
    const label = params.get("label") || "";
    if (!board && !card) return;
    (async () => {
      try {
        const r = await api.post("/ai/conversations", {});
        setParams({}, { replace: true });
        await qc.invalidateQueries({ queryKey: ["ai-conversations"] });
        setActiveId(r.data.id);
        setRefs([{ type: board ? "board" : "card", id: board || card, label: label || (board ? "Board" : "Kartu") }]);
      } catch (e) {
        toast.error(errMsg(e));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── mention query ──
  useEffect(() => {
    if (!mOpen) return;
    const t = setTimeout(async () => {
      try {
        const r = await api.get("/ai/mentionables", { params: { q: mQuery, types: mTab } });
        setMResults(r.data.results || []);
      } catch {
        setMResults([]);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [mOpen, mQuery, mTab]);

  const newChat = async () => {
    try {
      const r = await api.post("/ai/conversations", {});
      await qc.invalidateQueries({ queryKey: ["ai-conversations"] });
      setActiveId(r.data.id);
      setRefs([]);
      setInput("");
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const removeConvo = async (id) => {
    if (!window.confirm("Hapus percakapan ini?")) return;
    try {
      await api.delete(`/ai/conversations/${id}`);
      if (activeId === id) setActiveId(null);
      qc.invalidateQueries({ queryKey: ["ai-conversations"] });
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const saveRename = async (id) => {
    try {
      await api.patch(`/ai/conversations/${id}`, { title: renameText });
      setRenaming(null);
      qc.invalidateQueries({ queryKey: ["ai-conversations"] });
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const onInputChange = (e) => {
    const v = e.target.value;
    setInput(v);
    const caret = e.target.selectionStart ?? v.length;
    const upto = v.slice(0, caret);
    const m = upto.match(/@([^\s@]*)$/);
    if (m) {
      setMQuery(m[1]);
      setMOpen(true);
    } else {
      setMOpen(false);
    }
  };

  const pickMention = (item) => {
    // ganti token "@query" terakhir jadi "@label "
    setInput((cur) => cur.replace(/@([^\s@]*)$/, `@${item.label} `));
    setRefs((cur) =>
      cur.some((r) => r.type === item.type && r.id === item.id)
        ? cur
        : [...cur, { type: item.type, id: item.id, label: item.label }],
    );
    setMOpen(false);
    taRef.current?.focus();
  };

  const send = async () => {
    const content = input.trim();
    if (!content || sending || !activeId || readOnly) return;
    setSending(true);
    setNotConfigured(false);
    try {
      await api.post(`/ai/conversations/${activeId}/messages`, { content, refs });
      setInput("");
      setRefs([]);
      await qc.invalidateQueries({ queryKey: ["ai-conversation", activeId] });
      qc.invalidateQueries({ queryKey: ["ai-conversations"] });
    } catch (e) {
      if (e?.response?.status === 501) setNotConfigured(true);
      else toast.error(errMsg(e));
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e) => {
    if (mOpen && (e.key === "Escape")) {
      setMOpen(false);
      return;
    }
    if (e.key === "Enter" && !e.shiftKey && !mOpen) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="flex h-[calc(100vh-3rem)]" data-testid="ai-chat-page">
      {/* ── Daftar percakapan ── */}
      <aside className="flex w-64 shrink-0 flex-col border-r border-[hsl(var(--hairline))] bg-[hsl(var(--surface))]">
        <div className="flex items-center gap-2 border-b border-[hsl(var(--hairline))] px-3 py-3">
          <Sparkles size={16} className="text-[#0c66e4]" />
          <span className="text-sm font-bold text-foreground">Asisten AI</span>
        </div>

        {isSuperAdmin && (
          <div className="border-b border-[hsl(var(--hairline))] px-3 py-2">
            <label className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-3">
              <Eye size={11} /> Lihat chat user
            </label>
            <select
              value={viewUserId}
              onChange={(e) => {
                setViewUserId(e.target.value);
                setActiveId(null);
              }}
              className="h-8 w-full rounded-md border border-[hsl(var(--hairline))] bg-[hsl(var(--surface))] px-2 text-[12px] text-foreground"
            >
              <option value="">— Chat saya —</option>
              {(chatUsers || []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {!readOnly && (
          <button
            onClick={newChat}
            className="m-2 flex items-center justify-center gap-1.5 rounded-lg bg-[#0c66e4] px-3 py-2 text-[13px] font-semibold text-white hover:bg-[#0052cc]"
          >
            <Plus size={14} /> Chat baru
          </button>
        )}

        <div className="minimal-scrollbar flex-1 overflow-y-auto px-2 pb-2">
          {conversations.length === 0 && (
            <p className="px-2 py-4 text-center text-[12px] text-3">Belum ada percakapan.</p>
          )}
          {conversations.map((c) => (
            <div
              key={c.id}
              className={`group mb-0.5 flex items-center gap-1 rounded-lg px-2 py-1.5 text-[13px] ${
                c.id === activeId
                  ? "bg-[#e9f2ff] text-[#0c66e4] dark:bg-[#0c66e4]/15"
                  : "text-2 hover:bg-[hsl(var(--muted))]"
              }`}
            >
              {renaming === c.id ? (
                <>
                  <input
                    autoFocus
                    value={renameText}
                    onChange={(e) => setRenameText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveRename(c.id)}
                    className="h-6 flex-1 rounded border border-[hsl(var(--hairline))] bg-[hsl(var(--surface))] px-1 text-[12px] text-foreground"
                  />
                  <button onClick={() => saveRename(c.id)} className="text-[#22a06b]">
                    <Check size={13} />
                  </button>
                  <button onClick={() => setRenaming(null)} className="text-3">
                    <X size={13} />
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setActiveId(c.id)}
                    className="min-w-0 flex-1 truncate text-left"
                    title={c.title}
                  >
                    {c.title}
                  </button>
                  {!readOnly && (
                    <>
                      <button
                        onClick={() => {
                          setRenaming(c.id);
                          setRenameText(c.title);
                        }}
                        className="opacity-0 transition-opacity group-hover:opacity-100 text-3 hover:text-foreground"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={() => removeConvo(c.id)}
                        className="opacity-0 transition-opacity group-hover:opacity-100 text-3 hover:text-[#ca3521]"
                      >
                        <Trash2 size={12} />
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </aside>

      {/* ── Transkrip + composer ── */}
      <section className="flex min-w-0 flex-1 flex-col bg-[hsl(var(--surface-2))]">
        {!activeId ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-3">
            <Sparkles size={28} className="text-[#0c66e4]" />
            <p className="text-sm">Pilih percakapan atau mulai "Chat baru".</p>
          </div>
        ) : (
          <>
            <div ref={scrollRef} className="minimal-scrollbar flex-1 space-y-4 overflow-y-auto px-4 py-6 md:px-10">
              <div className="mx-auto max-w-3xl space-y-4">
                {readOnly && (
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                    Mode baca — kamu sedang melihat riwayat chat user lain.
                  </p>
                )}
                {convoLoading && messages.length === 0 && (
                  <p className="text-sm text-3">Memuat…</p>
                )}
                {!convoLoading && messages.length === 0 && !readOnly && (
                  <div className="rounded-xl border border-[hsl(var(--hairline))] bg-[hsl(var(--surface))] p-4 text-[13px] text-2">
                    <p className="font-semibold text-foreground">Mulai bertanya.</p>
                    <p className="mt-1">
                      Ketik <code>@</code> untuk menandai board, kartu, lampiran, atau user — AI akan
                      membaca isinya (mengikuti hak akses kamu). Contoh:{" "}
                      <em>"Ringkas @NamaBoard dan sebut kartu yang jatuh tempo minggu ini"</em>.
                    </p>
                  </div>
                )}

                {messages.map((m) => (
                  <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                    <div
                      className={
                        m.role === "user"
                          ? "max-w-[85%] rounded-2xl rounded-br-sm bg-[#0c66e4] px-3.5 py-2.5 text-[13.5px] text-white"
                          : "max-w-[92%] whitespace-pre-wrap rounded-2xl rounded-bl-sm border border-[hsl(var(--hairline))] bg-[hsl(var(--surface))] px-3.5 py-2.5 text-[13.5px] text-foreground"
                      }
                    >
                      {m.role === "user" && m.refs?.length > 0 && (
                        <div className="mb-1.5 flex flex-wrap gap-1">
                          {m.refs.map((r, i) => (
                            <RefChip key={i} r={r} />
                          ))}
                        </div>
                      )}
                      <div className={m.role === "user" ? "whitespace-pre-wrap" : ""}>{m.content}</div>
                      {m.skipped?.length > 0 && (
                        <p className="mt-1.5 text-[11px] italic opacity-80">
                          {m.skipped.length} referensi dilewati:{" "}
                          {m.skipped.map((s) => `${s.label || s.id} (${s.reason})`).join("; ")}
                        </p>
                      )}
                    </div>
                  </div>
                ))}

                {sending && (
                  <div className="flex justify-start">
                    <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm border border-[hsl(var(--hairline))] bg-[hsl(var(--surface))] px-3.5 py-2.5 text-[13px] text-3">
                      <Loader2 size={14} className="animate-spin" /> AI sedang membaca…
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Composer */}
            {!readOnly && (
              <div className="border-t border-[hsl(var(--hairline))] bg-[hsl(var(--surface))] px-4 py-3 md:px-10">
                <div className="mx-auto max-w-3xl">
                  {notConfigured && (
                    <div className="mb-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-[12px] text-amber-900 dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-200">
                      Asisten AI belum dikonfigurasi — setel <code>GROQ_API_KEY</code> (atau{" "}
                      <code>ANTHROPIC_API_KEY</code> bila <code>AI_PROVIDER=anthropic</code>) di server, lalu restart.
                    </div>
                  )}
                  {refs.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {refs.map((r, i) => (
                        <RefChip
                          key={i}
                          r={r}
                          onRemove={() => setRefs((cur) => cur.filter((_, j) => j !== i))}
                        />
                      ))}
                    </div>
                  )}

                  <div className="relative">
                    {mOpen && (
                      <div className="absolute bottom-[calc(100%+6px)] left-0 z-20 w-full max-w-md overflow-hidden rounded-lg border border-[hsl(var(--hairline))] bg-[hsl(var(--elevated))] shadow-xl">
                        <div className="flex border-b border-[hsl(var(--hairline))]">
                          {TYPE_TABS.map((t) => {
                            const Icon = TYPE_META[t].icon;
                            return (
                              <button
                                key={t}
                                onClick={() => setMTab(t)}
                                className={`flex flex-1 items-center justify-center gap-1 py-1.5 text-[11px] font-semibold ${
                                  mTab === t ? "bg-[#e9f2ff] text-[#0c66e4] dark:bg-[#0c66e4]/15" : "text-3 hover:bg-[hsl(var(--muted))]"
                                }`}
                              >
                                <Icon size={12} /> {TYPE_META[t].label}
                              </button>
                            );
                          })}
                        </div>
                        <div className="max-h-56 overflow-y-auto py-1">
                          {mResults.length === 0 && (
                            <p className="px-3 py-3 text-center text-[12px] text-3">
                              {mQuery ? "Tidak ada hasil." : "Ketik untuk mencari…"}
                            </p>
                          )}
                          {mResults.map((r) => {
                            const Icon = TYPE_META[r.type].icon;
                            return (
                              <button
                                key={`${r.type}-${r.id}`}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  pickMention(r);
                                }}
                                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-foreground hover:bg-[hsl(var(--muted))]"
                              >
                                <Icon size={13} className="shrink-0 text-3" />
                                <span className="min-w-0 flex-1 truncate">{r.label}</span>
                                {r.sub && <span className="shrink-0 text-[11px] text-3">{r.sub}</span>}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="flex items-end gap-2">
                      <textarea
                        ref={taRef}
                        value={input}
                        onChange={onInputChange}
                        onKeyDown={onKeyDown}
                        rows={2}
                        placeholder="Tulis pertanyaan… ketik @ untuk menandai board / kartu / lampiran / user"
                        className="max-h-40 min-h-[46px] flex-1 resize-none rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--surface))] px-3 py-2 text-[13.5px] text-foreground outline-none focus:ring-2 focus:ring-[#0c66e4]"
                      />
                      <button
                        onClick={send}
                        disabled={sending || !input.trim()}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#0c66e4] text-white hover:bg-[#0052cc] disabled:opacity-40"
                      >
                        {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
