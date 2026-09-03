'use client';

/**
 * .top-controls (trello-card-layout.html): tombol bulat melayang di kanan-atas
 * card-window — Cover / Watch / More / Close.
 *  - ikon ~16px, jarak rapat (item A-1)
 *  - default transparan, hover = lingkaran abu-abu tipis
 *  - "Cover" membuka popover pilih warna / gambar dari attachments
 *  - "More" membuka .menu (CardMoreMenu)
 */

import React, { useEffect, useRef, useState } from 'react';
import { Eye, Image as ImageIcon, X } from 'lucide-react';
import type { CardBackProps, LabelColor } from './types';
import { labelHex, isImageMime, resolveColor } from './helpers';
import CardMoreMenu from './CardMoreMenu';

const circleBtn =
  'flex h-6 w-6 items-center justify-center rounded-full border-0 bg-transparent text-[#44546b] transition-colors hover:bg-[#091e4224] hover:text-[#172b4d]';

const COVER_COLORS: LabelColor[] = ['green', 'yellow', 'orange', 'red', 'purple', 'blue', 'sky', 'lime', 'pink', 'gray'];

export default function CardBackHeader(props: CardBackProps) {
  const { card, onUpdateCard, onOpenChange } = props;
  const [coverOpen, setCoverOpen] = useState(false);
  const coverWrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!coverOpen) return;
    const onDown = (e: MouseEvent) => {
      if (coverWrap.current && !coverWrap.current.contains(e.target as Node)) setCoverOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [coverOpen]);

  const imageAttachments = card.attachments.filter((a) => isImageMime(a.mimeType));

  return (
    <div className="absolute right-[10px] top-[10px] z-[4] flex items-center gap-[3px] max-[760px]:fixed">
      {/* Cover */}
      <div ref={coverWrap} className="relative">
        <button
          type="button"
          title="Cover"
          aria-pressed={!!(card.coverColor || card.coverImageUrl)}
          onClick={() => setCoverOpen((v) => !v)}
          className={`${circleBtn} ${card.coverColor || card.coverImageUrl ? 'text-[#0c66e4]' : ''}`}
        >
          <ImageIcon size={16} />
        </button>

        {coverOpen && (
          <div className="absolute right-0 top-[30px] z-30 w-[232px] rounded-[8px] bg-white p-3 shadow-[0_8px_24px_#0005]">
            <div className="mb-2 text-[12px] font-bold text-[#172b4d]">Cover</div>
            <div className="grid grid-cols-5 gap-1.5">
              {COVER_COLORS.map((c) => {
                const active = card.coverColor === c || resolveColor(card.coverColor) === labelHex(c);
                return (
                  <button
                    key={c}
                    type="button"
                    aria-label={c}
                    onClick={() => onUpdateCard({ coverColor: c, coverImageUrl: null })}
                    className={`h-8 rounded-[4px] ${active ? 'ring-2 ring-[#0c66e4] ring-offset-1' : ''}`}
                    style={{ background: labelHex(c) }}
                  />
                );
              })}
            </div>

            {imageAttachments.length > 0 && (
              <>
                <div className="mb-1.5 mt-3 text-[11px] font-bold text-[#5e6c84]">Dari lampiran</div>
                <div className="grid grid-cols-3 gap-1.5">
                  {imageAttachments.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      title={a.fileName}
                      onClick={() => onUpdateCard({ coverImageUrl: a.url, coverColor: null })}
                      className={`h-12 overflow-hidden rounded-[4px] border ${
                        card.coverImageUrl === a.url ? 'border-[#0c66e4] ring-1 ring-[#0c66e4]' : 'border-[#dfe1e6]'
                      }`}
                    >
                      <img src={a.thumbUrl || a.url} alt={a.fileName} className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              </>
            )}

            {(card.coverColor || card.coverImageUrl) && (
              <button
                type="button"
                onClick={() => onUpdateCard({ coverColor: null, coverImageUrl: null })}
                className="mt-3 w-full rounded-[4px] bg-[#f1f2f4] py-1.5 text-[12px] font-medium text-[#172b4d] hover:bg-[#dcdfe4]"
              >
                Hapus cover
              </button>
            )}
          </div>
        )}
      </div>

      {/* Watch */}
      <button
        type="button"
        title={card.isWatching ? 'Watching' : 'Watch'}
        aria-pressed={card.isWatching}
        onClick={() => onUpdateCard({ isWatching: !card.isWatching })}
        className={`${circleBtn} ${card.isWatching ? 'text-[#0c66e4] bg-[#e9f2ff] hover:bg-[#cce0ff]' : ''}`}
      >
        <Eye size={16} />
      </button>

      {/* More */}
      <CardMoreMenu {...props} />

      {/* Close */}
      <button type="button" title="Close" onClick={() => onOpenChange(false)} className={circleBtn}>
        <X size={16} />
      </button>
    </div>
  );
}
