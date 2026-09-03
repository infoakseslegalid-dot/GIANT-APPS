'use client';

/**
 * Card Back — modal detail kartu ala Trello.
 */

import React, { useEffect, useRef, useState } from 'react';
import type { CardBackProps } from './types';
import CardBackHeader from './CardBackHeader';
import CardTitle from './CardTitle';
import CardQuickActions from './CardQuickActions';
import CardLabels from './CardLabels';
import CardDescription from './CardDescription';
import CardChecklist from './CardChecklist';
import CardAttachments from './CardAttachments';
import CardActivityPanel from './CardActivityPanel';
import { resolveColor } from './helpers';

const DIST_LABEL: Record<string, { t: string; c: string }> = {
  AVAILABLE: { t: 'Menunggu diambil', c: 'bg-[#f1f2f4] text-[#44546f]' },
  CLAIMED: { t: 'Dikerjakan', c: 'bg-[#e3fcef] text-[#216e4e]' },
  DIRECT_ASSIGNED: { t: 'Ditugaskan', c: 'bg-[#eae6ff] text-[#5e4db2]' },
  RELEASED: { t: 'Dilepaskan', c: 'bg-[#fff0b3] text-[#946f00]' },
};

const SCROLL =
  '[&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-[10px] [&::-webkit-scrollbar-thumb]:bg-[#a5adba]';

export default function CardBack(props: CardBackProps) {
  const { card, open, onOpenChange, canEdit = true, picName, isMasterCard, assignments = [], onOpenAssignment, isAssignment, master } = props;
  const overlayRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [leftWidth, setLeftWidth] = useState(620);
  const [isDragging, setIsDragging] = useState(false);
  const [labelsOpen, setLabelsOpen] = useState(false);

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => {
      const rect = gridRef.current?.getBoundingClientRect();
      if (!rect) return;
      const w = e.clientX - rect.left;
      if (w > 380 && w < rect.width - 320) setLeftWidth(w);
    };
    const onUp = () => setIsDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isDragging]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current) onOpenChange(false);
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`card-title-${card.id}`}
      className={`fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/[0.55] py-[3vh] text-[#172b4d] max-[760px]:p-[10px] ${
        isDragging ? 'cursor-col-resize select-none' : ''
      }`}
    >
      <div
        ref={gridRef}
        className="relative grid h-[94vh] max-h-[900px] w-[min(1180px,94vw)] overflow-hidden rounded-[10px] bg-white shadow-[0_12px_40px_rgba(0,0,0,0.4)] max-[760px]:!grid-cols-1 max-[760px]:h-[calc(100vh-20px)] max-[760px]:w-full max-[760px]:overflow-auto"
        style={{ gridTemplateColumns: `minmax(0, ${leftWidth}px) 5px minmax(0, 1fr)` }}
      >
        {/* LEFT */}
        <div className="relative min-h-0 overflow-hidden pb-[18px] pl-[32px] pr-0 pt-3 max-[760px]:h-auto max-[760px]:pl-5">
          {card.coverImageUrl ? (
            <img src={card.coverImageUrl} alt="" className="mb-3 -ml-[32px] h-[110px] w-[calc(100%+32px)] object-cover max-[760px]:-ml-5 max-[760px]:w-[calc(100%+20px)]" />
          ) : card.coverColor ? (
            <div
              className="mb-3 -ml-[32px] h-[38px] w-[calc(100%+32px)] max-[760px]:-ml-5 max-[760px]:w-[calc(100%+20px)]"
              style={{ background: resolveColor(card.coverColor) ?? undefined }}
            />
          ) : null}

          <div className={`h-full overflow-y-auto pb-6 pr-3 ${SCROLL}`}>
            {/* Breadcrumb: kartu ini + (kalau assignment) asal Master Card */}
            <div className="mb-[12px] flex flex-wrap items-center gap-1.5 text-[11px]">
              {isAssignment && master && (
                <>
                  <button
                    type="button"
                    title="Buka Master Card"
                    onClick={() => onOpenAssignment?.(master.id)}
                    className="inline-flex items-center gap-1 rounded-[4px] bg-[#dfe1e6] px-2 py-1 font-medium text-[#42526e] hover:bg-[#c1c7d0]"
                  >
                    {master.boardName || 'Master Card'}
                    <span className="text-[9px]">↗</span>
                  </button>
                  {master.listName && (
                    <span className="rounded-[4px] bg-[#e8d7ef] px-2 py-1 font-medium text-[#403152]">{master.listName}</span>
                  )}
                  <span className="text-[#8590a2]">·</span>
                </>
              )}
              <button
                type="button"
                title="Pindah list"
                onClick={() => props.onMoveCard(card.listId, 0)}
                className="inline-flex items-center gap-1 rounded-[4px] bg-[#e8d7ef] px-2 py-1 font-medium text-[#403152] hover:bg-[#ddc7e8]"
              >
                {card.listName}
                <span className="text-[10px] leading-none">⌄</span>
              </button>
            </div>

            {/* Banner "kartu mirror" */}
            {isAssignment && master && (
              <div className="mb-3 flex flex-wrap items-center gap-2 rounded-[6px] bg-[#f4f5f7] px-3 py-2 text-[11.5px] text-[#44546f]">
                <span>
                  Ini <strong>mirror</strong> dari Master Card <strong>“{master.title}”</strong> — board <strong>{master.boardName}</strong>
                  {master.listName ? <> · list <strong>{master.listName}</strong></> : null}.
                </span>
                <button
                  type="button"
                  onClick={() => onOpenAssignment?.(master.id)}
                  className="ml-auto rounded-[4px] border border-[#dfe1e6] bg-white px-2 py-1 font-semibold text-[#172b4d] hover:bg-[#f1f2f4]"
                >
                  Buka Master Card
                </button>
              </div>
            )}

            <CardTitle {...props} />

            {/* Banner status PIC / mode pantau */}
            {(picName || !canEdit) && (
              <div className={`mb-3 flex items-center gap-2 rounded-[6px] px-3 py-2 text-[11.5px] ${
                canEdit ? 'bg-[#e3fcef] text-[#216e4e]' : 'bg-[#fff7d6] text-[#7f5f01]'
              }`}>
                {picName ? (
                  <span><strong>Dikerjakan {picName}</strong></span>
                ) : (
                  <span>Belum ada PIC.</span>
                )}
                {!canEdit && <span className="ml-auto font-semibold">Mode pantau — hanya PIC/anggota divisi yang bisa mengubah</span>}
              </div>
            )}

            <CardQuickActions {...props} onLabels={() => setLabelsOpen(true)} />
            <CardLabels {...props} open={labelsOpen} onOpenChange={setLabelsOpen} />

            {/* Panel assignment turunan (di Master Card) */}
            {isMasterCard && assignments.length > 0 && (
              <div className="mb-5 rounded-[8px] border border-[#dfe1e6] bg-[#f7f8f9] p-3">
                <div className="mb-2 text-[12px] font-bold text-[#172b4d]">Assignment ke Divisi ({assignments.length})</div>
                <div className="flex flex-col gap-1.5">
                  {assignments.map((a) => {
                    const d = DIST_LABEL[a.distributionStatus] || DIST_LABEL.CLAIMED;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => onOpenAssignment?.(a.id)}
                        className="flex items-center gap-2 rounded-[6px] border border-[#dfe1e6] bg-white px-2.5 py-2 text-left text-[11.5px] hover:border-[#0c66e4]"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="font-semibold text-[#172b4d]">{a.divisionName}</span>
                          <span className="text-[#5e6c84]"> · {a.picName || 'belum diambil'}</span>
                          {a.listName && <span className="text-[#8590a2]"> · {a.listName}</span>}
                        </span>
                        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${d.c}`}>{d.t}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <CardDescription {...props} />
            <CardChecklist {...props} />
            <CardAttachments {...props} />
          </div>
        </div>

        {/* RESIZER */}
        <div
          className="relative z-10 cursor-col-resize bg-[#f1f2f4] transition-colors hover:bg-[#0c66e4] max-[760px]:hidden"
          style={{ backgroundColor: isDragging ? '#0c66e4' : undefined }}
          onMouseDown={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
        />

        {/* RIGHT */}
        <div className="flex min-h-0 flex-col overflow-hidden border-l border-[#dfe1e6] bg-[#f7f8f9] pb-[18px] pl-[15px] pr-[15px] pt-[46px] max-[760px]:h-[560px] max-[760px]:border-l-0 max-[760px]:border-t">
          <CardActivityPanel {...props} />
        </div>

        <CardBackHeader {...props} />
      </div>
    </div>
  );
}
