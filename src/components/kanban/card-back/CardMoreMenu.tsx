'use client';

/**
 * .menu (trello-card-layout.html): dropdown "More" — tombol ••• + panel 155px
 * yang muncul di kanan-atas card-window (absolute right-[10px] top-[41px]).
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Archive,
  ArrowRight,
  Copy,
  Send,
  LayoutTemplate,
  MoreHorizontal,
  Share2,
  Trash2,
  UserPlus,
} from 'lucide-react';
import type { CardBackProps } from './types';

const menuItem =
  'flex h-[29px] cursor-pointer items-center gap-[9px] px-[11px] text-[11px] text-foreground hover:bg-[hsl(var(--muted))]';

export default function CardMoreMenu(props: CardBackProps) {
  const { card, onJoin, onMoveCard, onOpenMove, onCopyCard, onMakeTemplate, onArchiveCard, onOpenSend, onDeleteCard, isAssignment } = props;
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const pick = (fn?: () => void) => () => {
    fn?.();
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="contents">
      <button
        type="button"
        title="More"
        aria-pressed={open}
        onClick={() => setOpen((v) => !v)}
        className={`flex h-6 w-6 items-center justify-center rounded-full border-0 bg-transparent text-2 transition-colors hover:bg-[hsl(var(--accent))] hover:text-foreground ${
          open ? 'bg-[hsl(var(--accent))] text-foreground' : ''
        }`}
      >
        <MoreHorizontal size={16} />
      </button>

      {open && (
        <div className="absolute right-[10px] top-[36px] z-20 w-[155px] overflow-hidden rounded-[7px] bg-[hsl(var(--elevated))] shadow-[0_8px_24px_#0005]">
          <div className={menuItem} onClick={pick(onOpenSend)}>
            <Send size={14} className="text-[#0c66e4]" />
            <span className="font-semibold text-[#0c66e4]">Kirim ke Divisi</span>
          </div>
          <div className={menuItem} onClick={pick(onJoin)}>
            <UserPlus size={14} className="text-2" />
            <span>Join</span>
          </div>
          <div className={menuItem} onClick={pick(() => (onOpenMove ? onOpenMove() : onMoveCard(card.listId, 0)))}>
            <ArrowRight size={14} className="text-2" />
            <span>Pindahkan…</span>
          </div>
          <div
            className={menuItem}
            onClick={pick(() => onCopyCard({ title: `${card.title} (Salinan)`, listId: card.listId }))}
          >
            <Copy size={14} className="text-2" />
            <span>Copy</span>
          </div>
          <div className={menuItem} onClick={pick(onMakeTemplate)}>
            <LayoutTemplate size={14} className="text-2" />
            <span>Make template</span>
          </div>

          <div className="my-1 h-px bg-[hsl(var(--muted))]" />

          <div className={menuItem} onClick={pick()}>
            <Share2 size={14} className="text-2" />
            <span>Share</span>
          </div>
          <div className={menuItem} onClick={pick(onArchiveCard)}>
            <Archive size={14} className="text-2" />
            <span>{card.isArchived ? 'Send to board' : 'Archive'}</span>
          </div>
          {isAssignment && onDeleteCard && (
            <div
              className={`${menuItem} !text-[#c9372c] hover:!bg-[#ffeceb]`}
              onClick={pick(() => {
                if (confirm('Hapus kartu mirror ini? Kartu aslinya TIDAK ikut terhapus — hanya assignment di divisi ini yang hilang.')) {
                  onDeleteCard();
                }
              })}
            >
              <Trash2 size={14} />
              <span>Hapus kartu mirror ini</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
