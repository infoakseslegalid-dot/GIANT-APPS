'use client';

/**
 * Merender satu item di panel aktivitas: komentar atau system-log.
 */

import React, { useState } from 'react';
import type { CardActivity, CardAttachment, CardBackProps } from './types';
import {
  memberAvatarStyle, formatActivityTime, formatFullDate, formatRelativeShort,
  commentTextToHtml, htmlToPlainText, isImageMime,
} from './helpers';
import AttachmentPreviewModal from './AttachmentPreviewModal';

const BUBBLE =
  'mt-[2px] rounded-[8px] border border-[#dfe1e6] bg-white px-[12px] py-[8px] text-[13px] leading-[1.5] shadow-[0_1px_1px_#091e4214] whitespace-pre-wrap break-words [&_a]:text-[#0c66e4] [&_a]:underline hover:[&_a]:text-[#0052cc] [&_p]:m-0 [&_p]:mb-1 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_em]:italic [&_ul]:my-1 [&_ul]:pl-5 [&_ul]:list-disc text-[#172b4d]';

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
            <div className="text-[10px] text-[#5e6c84]">
              <strong className="font-semibold text-[#172b4d]">{authorName}</strong> attached{' '}
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
            className={`block overflow-hidden rounded-[8px] border border-[#dfe1e6] hover:border-[#0c66e4] hover:opacity-90 ${context === 'comment' ? 'h-[120px] max-w-[200px]' : 'mt-1'}`}
          >
            <img
              src={att.thumbUrl || att.url}
              alt={att.fileName}
              className={context === 'comment' ? 'h-full w-full object-cover' : 'max-h-[260px] max-w-full object-contain'}
            />
          </button>
        </div>
      ) : (
        <div className={context === 'system' ? 'mt-[6px] text-[11px] leading-[1.5] text-[#5e6c84]' : 'mt-[4px] text-[13px] break-all'}>
          {context === 'system' && <><strong className="font-semibold text-[#172b4d]">{authorName}</strong> attached </>}
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
}: { activity: CardActivity } & Pick<CardBackProps, 'onUpdateComment' | 'onDeleteComment'> & {
  onReply?: (name: string) => void;
  onAddLinkAttachment?: (url: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');

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
    await onUpdateComment(activity.id, commentTextToHtml(text));
    setEditing(false);
  };

  const links: React.ReactNode[] = [];
  if (!isOwn) links.push(<span key="reply" onClick={() => onReply?.(activity.author.name)} className="cursor-pointer font-medium hover:text-[#172b4d] underline">Reply</span>);
  if (isOwn) links.push(<span key="edit" onClick={startEdit} className="cursor-pointer font-medium hover:text-[#172b4d] underline">Edit</span>);
  if (hasLink) {
    links.push(
      <span
        key="att"
        onClick={() => {
          const url = activity.body.match(/https?:\/\/[^\s<"]+/)?.[0] || activity.body.match(/href="([^"]+)"/)?.[1];
          if (url) onAddLinkAttachment?.(url);
          else alert('URL tidak ditemukan');
        }}
        className="cursor-pointer font-medium hover:text-[#172b4d] underline"
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
      <div className="relative my-[8px] pl-[34px] text-[12px] leading-[1.5] text-[#5e6c84]">
        <div
          className="absolute left-[6px] top-[4px] h-[16px] w-[16px] rounded-full"
          style={{ background: av.background, opacity: 0.5 }}
        />
        <span className="[&_a]:text-[#0c66e4] [&_a]:underline [&_strong]:font-semibold [&_strong]:text-[#172b4d]">
          <strong className="font-semibold text-[#172b4d]">{activity.author.name}</strong>{' '}
          <span dangerouslySetInnerHTML={{ __html: activity.body }} />
        </span>
        <span
          className="ml-1 whitespace-nowrap text-[11px] text-[#8590a2]"
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
        <strong className="font-bold text-[#172b4d]">{activity.author.name}</strong>
        {activity.origin && (
          <span className="rounded bg-[#e8d7ef] px-1.5 py-px text-[9px] font-semibold text-[#403152]">{activity.origin.label}</span>
        )}
        {activity.editedAt && <span className="text-[10px] text-[#7a869a]">(edited)</span>}
        <span
          className="shrink-0 whitespace-nowrap text-[11px] text-[#5e6c84]"
          title={`${formatFullDate(activity.createdAt)}${activity.editedAt ? ` · diedit ${formatActivityTime(activity.editedAt)}` : ''}`}
        >
          {formatRelativeShort(activity.createdAt)}
        </span>
      </div>

      {editing ? (
        <>
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setEditing(false);
              else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) saveEdit();
            }}
            className="h-[76px] w-full resize-none rounded-[6px] border-2 border-[#0c66e4] p-[9px] text-[12px] outline-none"
          />
          <div className="mt-[6px] flex gap-[5px]">
            <button type="button" onClick={saveEdit} className="rounded-[4px] border-0 bg-[#0c66e4] px-[11px] py-[7px] text-[12px] font-semibold text-white hover:bg-[#0052cc]">
              Save
            </button>
            <button type="button" onClick={() => setEditing(false)} className="rounded-[4px] border border-[#dfe1e6] bg-transparent px-[11px] py-[7px] text-[12px] text-[#44546f] hover:bg-[#f1f2f4]">
              Cancel
            </button>
          </div>
        </>
      ) : activity.kind === 'comment' ? (
        <>
          <div className={BUBBLE}>
            {showBubble && <div dangerouslySetInnerHTML={{ __html: activity.body }} />}
            {atts.length > 0 && (
              <div className={showBubble ? 'mt-2 pt-2 border-t border-[#dfe1e6]' : ''}>
                {atts.map((att) => (
                  <FeedAttachment key={att.id} att={att} authorName={activity.author.name} context="comment" />
                ))}
              </div>
            )}
          </div>
          <div className="mt-[6px] flex flex-wrap items-center gap-x-2 text-[11px] text-[#5e6c84]">
            <span className="cursor-pointer text-[10px] leading-none text-[#5e6c84] hover:text-[#172b4d]">😁</span>
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
            <p className="text-[12px] text-[#5e6c84]" dangerouslySetInnerHTML={{ __html: activity.body }} />
          )}
          {atts.map((att) => (
            <FeedAttachment key={att.id} att={att} authorName={activity.author.name} context="system" />
          ))}
        </>
      )}
    </div>
  );
}
