'use client';

/**
 * .right (trello-card-layout.html): "Comments and activity".
 *   - Toggle "Hide details" → sembunyikan entri sistem, sisakan komentar user (item D-10)
 *   - Rich toolbar (Bold/Italic/List/Link) fungsional pada textarea (item D-11)
 *   - Save solid biru, Cancel outline (item D-12)
 *   - Lampiran ikut terkirim → muncul sebagai thumbnail di activity (item D-9)
 *   - Entri sistem berturut-turut dari user & menit yang sama → collapse 1 baris (item D-13)
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MessageSquare, Paperclip, Image as ImageIcon, X, Type, ChevronDown,
  Bold, Italic, List, Link as LinkIcon, Eye, EyeOff,
} from 'lucide-react';
import type { CardActivity, CardBackProps } from './types';
import CardActivityItem from './CardActivityItem';
import {
  commentTextToHtml, wrapSelection, prefixLines, insertLink, formatRelativeShort,
} from './helpers';

const SCROLL =
  '[&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-[10px] [&::-webkit-scrollbar-thumb]:bg-[#a5adba]';

type Row =
  | { kind: 'item'; activity: CardActivity }
  | { kind: 'group'; id: string; activities: CardActivity[] };

/** Hanya collapse kalau runtun entri sistemnya cukup banyak — selain itu tampil satu per satu. */
const GROUP_MIN = 4;

function sameMinute(x?: string, y?: string): boolean {
  if (!x || !y) return false;
  try {
    return new Date(x).toISOString().slice(0, 16) === new Date(y).toISOString().slice(0, 16);
  } catch {
    return false;
  }
}

/**
 * Kelompokkan entri sistem berturut-turut (author sama + menit sama). Runtun
 * < GROUP_MIN dibiarkan sebagai baris individual; hanya runtun panjang yang di-collapse.
 */
function buildRows(list: CardActivity[]): Row[] {
  const rows: Row[] = [];
  let run: CardActivity[] = [];

  const flush = () => {
    if (run.length >= GROUP_MIN) {
      rows.push({ kind: 'group', id: `g-${run[0].id}`, activities: run });
    } else {
      for (const a of run) rows.push({ kind: 'item', activity: a });
    }
    run = [];
  };

  for (const a of list) {
    if (a.kind !== 'system') {
      flush();
      rows.push({ kind: 'item', activity: a });
      continue;
    }
    if (
      run.length === 0 ||
      (run[run.length - 1].author.id === a.author.id && sameMinute(run[run.length - 1].createdAt, a.createdAt))
    ) {
      run.push(a);
    } else {
      flush();
      run.push(a);
    }
  }
  flush();
  return rows;
}

function CollapsedGroup({ activities }: { activities: CardActivity[] }) {
  const [open, setOpen] = useState(false);
  const a0 = activities[0];
  return (
    <div className="relative my-[7px] pl-[29px]">
      <div
        className="absolute left-[3px] top-[3px] h-[15px] w-[15px] rounded-full bg-[#c1c7d0]"
      />
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-1 text-left text-[11px] leading-[1.5] text-[#5e6c84]"
      >
        <span className="min-w-0 flex-1">
          <strong className="font-semibold text-[#172b4d]">{a0.author.name}</strong>{' '}
          <span dangerouslySetInnerHTML={{ __html: a0.body }} />{' '}
          <span className="text-[#8590a2]">dan {activities.length - 1} pembaruan lain</span>
        </span>
        <ChevronDown size={12} className={`mt-[2px] shrink-0 ${open ? 'rotate-180' : ''} transition-transform`} />
        <span className="ml-1 shrink-0 whitespace-nowrap text-[10px] text-[#8590a2]">
          · {formatRelativeShort(a0.createdAt)}
        </span>
      </button>
      {open && (
        <div className="mt-1 space-y-1 border-l border-[#dfe1e6] pl-2">
          {activities.map((a) => (
            <p key={a.id} className="text-[11px] leading-[1.5] text-[#5e6c84]">
              <strong className="font-semibold text-[#172b4d]">{a.author.name}</strong>{' '}
              <span dangerouslySetInnerHTML={{ __html: a.body }} />
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CardActivityPanel(props: CardBackProps) {
  const { card, onAddComment, onUpdateComment, onDeleteComment, canComment = true } = props;
  const mentionables = props.mentionableUsers ?? props.allUsers ?? [];
  const [composing, setComposing] = useState(false);
  const [text, setText] = useState('');

  // ── @mention autocomplete ──────────────────────────────
  const [mOpen, setMOpen] = useState(false);
  const [mQuery, setMQuery] = useState('');
  const [mIdx, setMIdx] = useState(0);
  const mSuggestions = mOpen
    ? mentionables.filter((u) => u.name.toLowerCase().includes(mQuery.toLowerCase())).slice(0, 6)
    : [];

  const detectMention = (value: string, caret: number) => {
    const before = value.slice(0, caret);
    const m = before.match(/(?:^|[\s(])@([\p{L}\p{N}'.\- ]{0,30})$/u);
    if (m) { setMQuery(m[1]); setMIdx(0); setMOpen(true); }
    else setMOpen(false);
  };

  // Default: log aktivitas sistem disembunyikan — hanya komentar yang tampil.
  // Klik "Show details" untuk memunculkan baris moved/checklist/assignment dll.
  const [hideDetails, setHideDetails] = useState(true);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('https://');

  const [commentFiles, setCommentFiles] = useState<
    Array<{ file: File; name: string; preview: string | null; ext: string }>
  >([]);
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const commentFileRef = useRef<HTMLInputElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const pickMention = (name: string) => {
    const el = taRef.current;
    if (!el) return;
    const caret = el.selectionStart ?? text.length;
    const before = text.slice(0, caret);
    const at = before.lastIndexOf('@');
    if (at < 0) return;
    const next = text.slice(0, at) + '@' + name + ' ' + text.slice(caret);
    setText(next);
    setMOpen(false);
    requestAnimationFrame(() => {
      el.focus();
      const pos = at + name.length + 2;
      el.setSelectionRange(pos, pos);
    });
  };

  const OFFICE_ACCEPT = [
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.odt', '.ods', '.odp', '.txt', '.csv', '.rtf', '.zip', '.rar',
  ].join(',');
  const IMAGE_ACCEPT = 'image/*';
  const MAX_FILES = 10;

  const feedRef = useRef<HTMLDivElement>(null);

  const rows = useMemo(() => {
    // Timeline gabungan (item G): satu feed comment + activity.
    // Urutan TERBARU DI ATAS (sesuai referensi UI) — composer di atas, komentar
    // baru langsung muncul di bawahnya.
    const ordered = (card.activities ?? [])
      .slice()
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    const filtered = hideDetails ? ordered.filter((a) => a.kind === 'comment') : ordered;
    return buildRows(filtered);
  }, [card.activities, hideDetails]);

  const activityCount = (card.activities ?? []).length;
  useEffect(() => {
    // entri terbaru di atas → gulir ke atas saat ada aktivitas baru
    const el = feedRef.current;
    if (el) el.scrollTop = 0;
  }, [activityCount]);

  const commentCount = (card.activities ?? []).filter((a) => a.kind === 'comment').length;

  const applyEdit = useCallback((fn: (el: HTMLTextAreaElement) => { value: string; selStart: number; selEnd: number }) => {
    const el = taRef.current;
    if (!el) return;
    const res = fn(el);
    setText(res.value);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(res.selStart, res.selEnd);
    });
  }, []);

  const addCommentFiles = useCallback((fileList: FileList | null) => {
    if (!fileList) return;
    const arr = Array.from(fileList);
    setCommentFiles((prev) => {
      const merged = [
        ...prev,
        ...arr.map((f) => ({
          file: f,
          name: f.name,
          preview: f.type.startsWith('image/') ? URL.createObjectURL(f) : null,
          ext: f.name.split('.').pop()?.toUpperCase() || 'FILE',
        })),
      ];
      if (merged.length > MAX_FILES) {
        alert(`Maksimal ${MAX_FILES} file — ${merged.length - MAX_FILES} file diabaikan`);
        return merged.slice(0, MAX_FILES);
      }
      return merged;
    });
    if (commentFileRef.current) commentFileRef.current.value = '';
  }, []);

  const removeCommentFile = useCallback((idx: number) => {
    setCommentFiles((prev) => {
      const copy = [...prev];
      if (copy[idx]?.preview) URL.revokeObjectURL(copy[idx].preview!);
      copy.splice(idx, 1);
      return copy;
    });
  }, []);

  const resetComposer = () => {
    setText('');
    setCommentFiles([]);
    setReplyTo(null);
    setComposing(false);
    setLinkOpen(false);
  };

  const submit = async () => {
    const t = text.trim();
    if (!t && commentFiles.length === 0) return;
    const prefix = replyTo ? `@${replyTo.name} ` : '';
    const full = prefix + t;
    const mentioned = mentionables.filter((u) => full.includes('@' + u.name));
    const html = commentTextToHtml(full, mentioned.map((u) => u.name));
    await onAddComment(html, commentFiles.map((c) => c.file), mentioned.map((u) => u.id));
    resetComposer();
  };

  const tbBtn = 'flex h-6 w-6 cursor-pointer items-center justify-center rounded text-[#44546f] hover:bg-[#091e420f]';

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* .right-title */}
      <div className="mb-[13px] mt-[3px] flex items-center gap-2 text-[13px] font-bold">
        <MessageSquare size={16} />
        Comments and activity
        <button
          type="button"
          onClick={() => setHideDetails((v) => !v)}
          className="ml-auto flex items-center gap-1 rounded-[4px] border border-[#dfe1e6] bg-[#f7f8f9] px-2 py-1 text-[11px] font-medium text-[#44546f] hover:bg-[#e9ebee]"
        >
          {hideDetails ? <Eye size={12} /> : <EyeOff size={12} />}
          {hideDetails ? 'Show details' : 'Hide details'}
        </button>
      </div>

      {/* .comment-box / .comment-input */}
      <div className="shrink-0 pb-3">
        {replyTo && (
          <div className="mb-2 flex items-center gap-2 rounded bg-blue-50 px-3 py-1.5 text-xs text-blue-700">
            <span className="flex-1 truncate">Membalas <strong>{replyTo.name}</strong></span>
            <button type="button" onClick={() => setReplyTo(null)} className="text-blue-400 hover:text-blue-700">
              <X size={12} />
            </button>
          </div>
        )}

        {!canComment ? (
          <div className="rounded-[6px] border border-dashed border-[#dfe1e6] px-[10px] py-3 text-[11px] text-[#7a869a]">
            Anda tidak punya akses untuk berkomentar di kartu ini.
          </div>
        ) : !composing ? (
          <div
            onClick={() => setComposing(true)}
            className="flex min-h-[40px] cursor-text items-center rounded-[6px] border border-[#dfe1e6] px-[10px] py-3 text-[11px] text-[#7a869a] shadow-[0_1px_2px_#091e4226] hover:bg-[#f4f5f7]"
          >
            Write a comment...
          </div>
        ) : (
          <>
            <div className="relative overflow-visible rounded-[6px] border-2 border-[#0c66e4] bg-white shadow-[0_1px_2px_#091e4226]">
              {/* Toolbar */}
              <div className="relative flex flex-wrap items-center gap-[2px] border-b border-[#dfe1e6] px-2 py-1">
                <span className="flex h-6 items-center gap-[2px] rounded px-1.5 text-[11px] text-[#44546f]">
                  <Type size={13} /><ChevronDown size={10} />
                </span>
                <button type="button" title="Bold" className={tbBtn} onClick={() => applyEdit((el) => wrapSelection(el, '**'))}>
                  <Bold size={13} />
                </button>
                <button type="button" title="Italic" className={tbBtn} onClick={() => applyEdit((el) => wrapSelection(el, '*'))}>
                  <Italic size={13} />
                </button>
                <span className="mx-1 h-3 w-px bg-[#dfe1e6]" />
                <button type="button" title="Bullet list" className={tbBtn} onClick={() => applyEdit((el) => prefixLines(el, '- '))}>
                  <List size={13} />
                </button>
                <button
                  type="button"
                  title="Link"
                  className={tbBtn}
                  onClick={() => setLinkOpen((v) => !v)}
                >
                  <LinkIcon size={13} />
                </button>
                <span className="flex-1" />

                {/* Upload Gambar */}
                <label title={`Upload gambar (maks ${MAX_FILES} file)`} className={tbBtn}>
                  <ImageIcon size={13} />
                  <input type="file" accept={IMAGE_ACCEPT} multiple className="hidden" onChange={(e) => addCommentFiles(e.target.files)} />
                </label>

                {/* Upload Dokumen */}
                <label title={`Upload file dokumen (PDF, DOCX, XLSX, dll — maks ${MAX_FILES} file)`} className={tbBtn}>
                  <Paperclip size={13} />
                  <input
                    ref={commentFileRef}
                    type="file"
                    accept={OFFICE_ACCEPT}
                    multiple
                    className="hidden"
                    onChange={(e) => addCommentFiles(e.target.files)}
                  />
                </label>

                {linkOpen && (
                  <div className="absolute left-2 top-[34px] z-20 flex items-center gap-1 rounded-[6px] border border-[#dfe1e6] bg-white p-1.5 shadow-[0_8px_24px_#0004]">
                    <input
                      autoFocus
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (/^https?:\/\/\S+/.test(linkUrl)) {
                            applyEdit((el) => insertLink(el, linkUrl));
                            setLinkOpen(false);
                            setLinkUrl('https://');
                          }
                        } else if (e.key === 'Escape') {
                          setLinkOpen(false);
                        }
                      }}
                      placeholder="https://…"
                      className="h-7 w-[200px] rounded border border-[#dfe1e6] px-2 text-[12px] outline-none focus:border-[#0c66e4]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (/^https?:\/\/\S+/.test(linkUrl)) {
                          applyEdit((el) => insertLink(el, linkUrl));
                          setLinkOpen(false);
                          setLinkUrl('https://');
                        }
                      }}
                      className="rounded bg-[#0c66e4] px-2 py-1 text-[11px] font-semibold text-white hover:bg-[#0052cc]"
                    >
                      Sisip
                    </button>
                  </div>
                )}
              </div>

              {mOpen && mSuggestions.length > 0 && (
                <div className="absolute left-2 z-40 mt-1 w-[220px] overflow-hidden rounded-[6px] border border-[#dfe1e6] bg-white shadow-[0_8px_24px_#0004]">
                  {mSuggestions.map((u, i) => (
                    <button
                      key={u.id}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); pickMention(u.name); }}
                      className={`flex w-full items-center gap-2 px-2 py-1.5 text-left text-[12px] ${i === mIdx ? 'bg-[#e9f2ff]' : 'hover:bg-[#f1f2f4]'}`}
                    >
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ background: u.avatarColor || '#0c66e4' }}>
                        {u.initials}
                      </span>
                      <span className="truncate text-[#172b4d]">{u.name}</span>
                    </button>
                  ))}
                </div>
              )}

              <textarea
                ref={taRef}
                autoFocus
                value={text}
                onChange={(e) => { setText(e.target.value); detectMention(e.target.value, e.target.selectionStart ?? 0); }}
                onKeyDown={(e) => {
                  if (mOpen && mSuggestions.length > 0) {
                    if (e.key === 'ArrowDown') { e.preventDefault(); setMIdx((i) => (i + 1) % mSuggestions.length); return; }
                    if (e.key === 'ArrowUp') { e.preventDefault(); setMIdx((i) => (i - 1 + mSuggestions.length) % mSuggestions.length); return; }
                    if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pickMention(mSuggestions[mIdx].name); return; }
                    if (e.key === 'Escape') { e.preventDefault(); setMOpen(false); return; }
                  }
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit();
                }}
                onPaste={(e) => {
                  if (e.clipboardData.files && e.clipboardData.files.length > 0) {
                    e.preventDefault();
                    addCommentFiles(e.clipboardData.files);
                  }
                }}
                placeholder="Tulis komentar…  ketik @ untuk sebut orang  ·  Ctrl+Enter kirim"
                className="h-[76px] w-full resize-none p-[9px] text-[12px] text-[#172b4d] outline-none placeholder:text-[#7a869a]"
              />

              {/* Preview file yang akan diupload */}
              {commentFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 border-t border-[#dfe1e6] bg-[#f4f5f7] px-2 py-2">
                  {commentFiles.map((cf, idx) => (
                    <div
                      key={idx}
                      className="group relative flex flex-col max-w-[200px] gap-1.5 rounded border border-[#dfe1e6] bg-white p-1 text-[11px] text-[#172b4d] shadow-sm"
                    >
                      {cf.preview ? (
                        <img src={cf.preview} alt={cf.name} className="h-24 w-full shrink-0 rounded object-cover" />
                      ) : (
                        <div className="flex h-24 w-full shrink-0 items-center justify-center rounded bg-[#091e420f] text-[10px] font-bold text-[#44546f]">
                          {cf.ext}
                        </div>
                      )}
                      <span className="min-w-0 flex-1 truncate font-medium" title={cf.name}>{cf.name}</span>
                      <button
                        type="button"
                        onClick={() => removeCommentFile(idx)}
                        className="flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded-full bg-[#091e420f] text-[#44546f] hover:bg-red-100 hover:text-red-600"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-[6px] flex items-center gap-[5px]">
              <button
                type="button"
                disabled={!text.trim() && commentFiles.length === 0}
                onClick={submit}
                className="rounded-[4px] border-0 bg-[#0c66e4] px-[13px] py-[7px] text-[13px] font-semibold text-white hover:bg-[#0052cc] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Save
              </button>
              <button
                type="button"
                onClick={resetComposer}
                className="rounded-[4px] border border-[#dfe1e6] bg-transparent px-[13px] py-[7px] text-[13px] text-[#44546f] hover:bg-[#f1f2f4]"
              >
                Cancel
              </button>
              {commentFiles.length > 0 && (
                <span className="ml-auto text-[11px] text-[#7a869a]">{commentFiles.length} file terpilih</span>
              )}
            </div>
          </>
        )}
      </div>

      {/* timeline gabungan comment + activity (item G) */}
      <div ref={feedRef} className={`mt-[9px] min-h-0 flex-1 overflow-y-auto pr-[2px] ${SCROLL}`}>
        {rows.length === 0 ? (
          <p className="py-4 text-center text-[11px] text-[#7a869a]">
            {hideDetails && commentCount === 0 ? 'Belum ada komentar.' : 'Belum ada aktivitas.'}
          </p>
        ) : (
          rows.map((row) =>
            row.kind === 'group' ? (
              <CollapsedGroup key={row.id} activities={row.activities} />
            ) : (
              <CardActivityItem
                key={row.activity.id}
                activity={row.activity}
                onUpdateComment={onUpdateComment}
                onDeleteComment={onDeleteComment}
                onReply={(name) => {
                  setReplyTo({ id: row.activity.id, name });
                  setComposing(true);
                  setTimeout(() => taRef.current?.focus(), 50);
                }}
                onAddLinkAttachment={(url) => {
                  alert(`Link ditambahkan sebagai lampiran:\n${url}`);
                }}
              />
            ),
          )
        )}
      </div>
    </div>
  );
}
