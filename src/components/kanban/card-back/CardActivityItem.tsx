'use client';

/**
 * Merender satu item di panel aktivitas: komentar atau system-log.
 */

import React, { useRef, useState } from 'react';
import { Image as ImageIcon, Paperclip } from 'lucide-react';
import type { CardActivity, CardAttachment, CardBackProps, CardMember } from './types';
import {
  memberAvatarStyle, formatActivityTime, formatFullDate, formatRelativeShort,
  commentTextToHtml, htmlToPlainText, isImageMime,
} from './helpers';
import AttachmentPreviewModal from './AttachmentPreviewModal';

type InlineUpload = { url: string; fileName: string; isImage: boolean } | null;

const BUBBLE =
  'mt-[2px] rounded-[8px] border border-[hsl(var(--hairline))] bg-[hsl(var(--elevated))] px-[12px] py-[8px] text-[13px] leading-[1.5] shadow-[0_1px_1px_#091e4214] whitespace-pre-wrap break-words [&_a]:text-[#0c66e4] [&_a]:underline hover:[&_a]:text-[#0052cc] [&_p]:m-0 [&_p]:mb-1 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_em]:italic [&_ul]:my-1 [&_ul]:pl-5 [&_ul]:list-disc text-foreground';

/** kosong / hanya <p></p> / hanya whitespace → tak perlu bubble */
function isBlankBody(html: string): boolean {
  return !html || !html.replace(/<[^>]+>/g, '').trim();
}

function FeedAttachment({ att, authorName, context = 'system' }: { att: CardAttachment; authorName: string, context?: 'system' | 'comment' }) {
  const [open, setOpen] = useState(false);
  const image = isImageMime(att.mimeType);

  return (
    <>
      {image ? (
        <div className={context === 'system' ? 'mt-[6px]' : 'mt-2 inline-block mr-2 align-top'}>
          {context === 'system' && (
            <div className="text-[10px] text-3">
              <strong className="font-semibold text-foreground">{authorName}</strong> attached{' '}
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="text-[#0c66e4] underline hover:text-[#0052cc]"
              >
                {att.fileName}
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={`block overflow-hidden rounded-[8px] border border-[hsl(var(--hairline))] hover:border-[#0c66e4] hover:opacity-90 ${context === 'comment' ? 'h-[120px] max-w-[200px]' : 'mt-1'}`}
          >
            <img
              src={att.thumbUrl || att.url}
              alt={att.fileName}
              className={context === 'comment' ? 'h-full w-full object-cover' : 'max-h-[260px] max-w-full object-contain'}
            />
          </button>
        </div>
      ) : (
        <div className={context === 'system' ? 'mt-[6px] text-[11px] leading-[1.5] text-3' : 'mt-[4px] text-[13px] break-all'}>
          {context === 'system' && <><strong className="font-semibold text-foreground">{authorName}</strong> attached </>}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="font-medium text-[#0c66e4] underline hover:text-[#0052cc]"
          >
            {att.fileName}
          </button>
          {context === 'system' && ' to this card'}
        </div>
      )}
      {open && <AttachmentPreviewModal attachment={att} onClose={() => setOpen(false)} />}
    </>
  );
}

export default function CardActivityItem({
  activity,
  onUpdateComment,
  onDeleteComment,
  onReply,
  onAddLinkAttachment,
  mentionables = [],
  onUploadInline,
}: { activity: CardActivity } & Pick<CardBackProps, 'onUpdateComment' | 'onDeleteComment'> & {
  onReply?: (name: string) => void;
  onAddLinkAttachment?: (url: string) => void;
  mentionables?: CardMember[];
  onUploadInline?: (f: File) => Promise<InlineUpload>;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // @mention autocomplete (sama seperti composer komentar baru)
  const [mOpen, setMOpen] = useState(false);
  const [mQuery, setMQuery] = useState('');
  const [mIdx, setMIdx] = useState(0);
  const mSug = mOpen ? mentionables.filter((u) => u.name.toLowerCase().includes(mQuery.toLowerCase())).slice(0, 6) : [];
  const detectMention = (value: string, caret: number) => {
    const before = value.slice(0, caret);
    const m = before.match(/(?:^|[\s(])@([\p{L}\p{N}'.\- ]{0,30})$/u);
    if (m) { setMQuery(m[1]); setMIdx(0); setMOpen(true); } else setMOpen(false);
  };
  const pickMention = (name: string) => {
    const el = taRef.current;
    if (!el) return;
    const caret = el.selectionStart ?? text.length;
    const at = text.slice(0, caret).lastIndexOf('@');
    if (at < 0) return;
    const next = text.slice(0, at) + '@' + name + ' ' + text.slice(caret);
    setText(next);
    setMOpen(false);
    requestAnimationFrame(() => { el.focus(); const p = at + name.length + 2; el.setSelectionRange(p, p); });
  };

  const insertAtCaret = (snippet: string) => {
    const el = taRef.current;
    const caret = el?.selectionStart ?? text.length;
    setText(text.slice(0, caret) + snippet + text.slice(caret));
    requestAnimationFrame(() => { el?.focus(); const p = caret + snippet.length; el?.setSelectionRange(p, p); });
  };
  const doUpload = async (f: File | undefined | null) => {
    if (!f || !onUploadInline) return;
    setBusy(true);
    try {
      const r = await onUploadInline(f);
      if (r) insertAtCaret(`${text && !text.endsWith('\n') ? '\n' : ''}${r.isImage ? '!' : ''}[${r.fileName}](${r.url})\n`);
    } finally { setBusy(false); }
  };

  const av = memberAvatarStyle(activity.author);
  const hasLink = /<a\s|https?:\/\//i.test(activity.body);
  const isOwn = activity.canEdit;
  const atts = activity.attachments ?? [];
  const showBubble = !isBlankBody(activity.body);

  const startEdit = () => {
    setText(htmlToPlainText(activity.body));
    setEditing(true);
  };
  const saveEdit = async () => {
    const mentioned = mentionables.filter((u) => text.includes('@' + u.name)).map((u) => u.name);
    await onUpdateComment(activity.id, commentTextToHtml(text, mentioned));
    setEditing(false);
  };

  const links: React.ReactNode[] = [];
  if (!isOwn) links.push(<span key="reply" onClick={() => onReply?.(activity.author.name)} className="cursor-pointer font-medium hover:text-foreground underline">Reply</span>);
  if (isOwn) links.push(<span key="edit" onClick={startEdit} className="cursor-pointer font-medium hover:text-foreground underline">Edit</span>);
  if (hasLink) {
    links.push(
      <span
        key="att"
        onClick={() => {
          const url = activity.body.match(/https?:\/\/[^\s<"]+/)?.[0] || activity.body.match(/href="([^"]+)"/)?.[1];
          if (url) onAddLinkAttachment?.(url);
          else alert('URL tidak ditemukan');
        }}
        className="cursor-pointer font-medium hover:text-foreground underline"
      >
        Add link as attachment
      </span>,
    );
  }
  if (activity.canDelete)
    links.push(
      <span
        key="del"
        onClick={() => {
          if (confirm('Hapus komentar ini?')) onDeleteComment(activity.id);
        }}
        className="cursor-pointer font-medium hover:text-red-600 underline"
      >
        Delete
      </span>,
    );

  // ── entri SISTEM ──────────────────────
  if (activity.kind === 'system' && !editing) {
    return (
      <div className="relative my-[8px] pl-[34px] text-[12px] leading-[1.5] text-3">
        <div
          className="absolute left-[6px] top-[4px] h-[16px] w-[16px] rounded-full"
          style={{ background: av.background, opacity: 0.5 }}
        />
        <span className="[&_a]:text-[#0c66e4] [&_a]:underline [&_strong]:font-semibold [&_strong]:text-foreground">
          <strong className="font-semibold text-foreground">{activity.author.name}</strong>{' '}
          <span dangerouslySetInnerHTML={{ __html: activity.body }} />
        </span>
        <span
          className="ml-1 whitespace-nowrap text-[11px] text-3"
          title={formatFullDate(activity.createdAt)}
        >
          {formatRelativeShort(activity.createdAt)}
        </span>
        {activity.origin && (
          <span className="ml-1 rounded bg-[#e8d7ef] px-1 py-px text-[9px] font-semibold text-[#403152]">{activity.origin.label}</span>
        )}
        {atts.map((att) => (
          <FeedAttachment key={att.id} att={att} authorName={activity.author.name} context="system" />
        ))}
      </div>
    );
  }

  // ── entri COMMENT ──────────────────────
  return (
    <div className="relative my-[12px] mb-4 pl-[38px]">
      {/* .avatar */}
      <div
        className="absolute left-0 top-[2px] flex h-[28px] w-[28px] items-center justify-center rounded-full text-[11px] font-bold"
        style={{ background: av.background, color: av.color }}
      >
        {activity.author.initials}
      </div>

      {/* meta */}
      <div className="mb-[2px] flex flex-wrap items-center gap-2 text-[12px]">
        <strong className="font-bold text-foreground">{activity.author.name}</strong>
        {activity.origin && (
          <span className="rounded bg-[#e8d7ef] px-1.5 py-px text-[9px] font-semibold text-[#403152]">{activity.origin.label}</span>
        )}
        {activity.editedAt && <span className="text-[10px] text-3">(edited)</span>}
        <span
          className="shrink-0 whitespace-nowrap text-[11px] text-3"
          title={`${formatFullDate(activity.createdAt)}${activity.editedAt ? ` · diedit ${formatActivityTime(activity.editedAt)}` : ''}`}
        >
          {formatRelativeShort(activity.createdAt)}
        </span>
      </div>

      {editing ? (
        <div className="relative">
          <textarea
            ref={taRef}
            autoFocus
            value={text}
            onChange={(e) => { setText(e.target.value); detectMention(e.target.value, e.target.selectionStart ?? 0); }}
            onKeyDown={(e) => {
              if (mOpen && mSug.length) {
                if (e.key === 'ArrowDown') { e.preventDefault(); setMIdx((i) => (i + 1) % mSug.length); return; }
                if (e.key === 'ArrowUp') { e.preventDefault(); setMIdx((i) => (i - 1 + mSug.length) % mSug.length); return; }
                if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pickMention(mSug[mIdx].name); return; }
                if (e.key === 'Escape') { e.preventDefault(); setMOpen(false); return; }
              }
              if (e.key === 'Escape') setEditing(false);
              else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) saveEdit();
            }}
            onPaste={(e) => {
              const f = e.clipboardData?.files?.[0];
              if (f && f.type.startsWith('image/')) { e.preventDefault(); doUpload(f); }
            }}
            placeholder="Ubah komentar…  ketik @ untuk sebut orang"
            className="h-[90px] w-full resize-none rounded-[6px] border-2 border-[#0c66e4] p-[9px] text-[12px] outline-none"
          />
          {mOpen && mSug.length > 0 && (
            <div className="absolute left-2 z-40 mt-1 w-[220px] overflow-hidden rounded-[6px] border border-[hsl(var(--hairline))] bg-[hsl(var(--elevated))] shadow-[0_8px_24px_#0004]">
              {mSug.map((u, i) => (
                <button
                  key={u.id}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); pickMention(u.name); }}
                  className={`flex w-full items-center gap-2 px-2 py-1.5 text-left text-[12px] ${i === mIdx ? 'bg-[#e9f2ff]' : 'hover:bg-[hsl(var(--muted))]'}`}
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ background: u.avatarColor || '#0c66e4' }}>{u.initials}</span>
                  <span className="truncate text-foreground">{u.name}</span>
                </button>
              ))}
            </div>
          )}
          <div className="mt-[6px] flex items-center gap-[5px]">
            <button type="button" disabled={busy} onClick={saveEdit} className="rounded-[4px] border-0 bg-[#0c66e4] px-[11px] py-[7px] text-[12px] font-semibold text-white hover:bg-[#0052cc] disabled:opacity-50">
              Save
            </button>
            <button type="button" onClick={() => setEditing(false)} className="rounded-[4px] border border-[hsl(var(--hairline))] bg-transparent px-[11px] py-[7px] text-[12px] text-2 hover:bg-[hsl(var(--muted))]">
              Cancel
            </button>
            {onUploadInline && (
              <>
                <span className="mx-1 h-4 w-px bg-[hsl(var(--muted))]" />
                <button type="button" title="Sisipkan gambar" disabled={busy} onClick={() => imgRef.current?.click()} className="flex h-7 w-7 items-center justify-center rounded text-2 hover:bg-[hsl(var(--muted))] disabled:opacity-50">
                  <ImageIcon size={14} />
                </button>
                <button type="button" title="Sisipkan berkas" disabled={busy} onClick={() => fileRef.current?.click()} className="flex h-7 w-7 items-center justify-center rounded text-2 hover:bg-[hsl(var(--muted))] disabled:opacity-50">
                  <Paperclip size={14} />
                </button>
                <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={(e) => { doUpload(e.target.files?.[0]); e.target.value = ''; }} />
                <input ref={fileRef} type="file" className="hidden" onChange={(e) => { doUpload(e.target.files?.[0]); e.target.value = ''; }} />
                {busy && <span className="text-[11px] text-3">mengunggah…</span>}
              </>
            )}
          </div>
        </div>
      ) : activity.kind === 'comment' ? (
        <>
          <div className={BUBBLE}>
            {showBubble && <div dangerouslySetInnerHTML={{ __html: activity.body }} />}
            {atts.length > 0 && (
              <div className={showBubble ? 'mt-2 pt-2 border-t border-[hsl(var(--hairline))]' : ''}>
                {atts.map((att) => (
                  <FeedAttachment key={att.id} att={att} authorName={activity.author.name} context="comment" />
                ))}
              </div>
            )}
          </div>
          <div className="mt-[6px] flex flex-wrap items-center gap-x-2 text-[11px] text-3">
            <span className="cursor-pointer text-[10px] leading-none text-3 hover:text-foreground">😁</span>
            {links.map((node, i) => (
              <React.Fragment key={i}>
                <span>·</span>
                {node}
              </React.Fragment>
            ))}
          </div>
        </>
      ) : (
        <>
          {activity.body && (
            <p className="text-[12px] text-3" dangerouslySetInnerHTML={{ __html: activity.body }} />
          )}
          {atts.map((att) => (
            <FeedAttachment key={att.id} att={att} authorName={activity.author.name} context="system" />
          ))}
        </>
      )}
    </div>
  );
}
