'use client';

/**
 * Card Back — modal detail kartu ala Trello.
 */

import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, RotateCcw, UserCheck, ChevronDown, ArrowUpRight } from 'lucide-react';
import type { CardBackProps } from './types';
import CardBackHeader from './CardBackHeader';
import CardTitle from './CardTitle';
import CardQuickActions from './CardQuickActions';
import CardLabels from './CardLabels';
import CardDescription from './CardDescription';
import CardChecklist from './CardChecklist';
import CardAttachments from './CardAttachments';
import CardActivityPanel from './CardActivityPanel';
import CardFinancePanel from './CardFinancePanel';
import { resolveColor } from './helpers';

const DIST_LABEL: Record<string, { t: string; c: string }> = {
  AVAILABLE: { t: 'Menunggu diambil', c: 'bg-[hsl(var(--muted))] text-2' },
  CLAIMED: { t: 'Dikerjakan', c: 'bg-[#e3fcef] text-[#216e4e]' },
  DIRECT_ASSIGNED: { t: 'Ditugaskan', c: 'bg-[#eae6ff] text-[#5e4db2]' },
  RELEASED: { t: 'Dilepaskan', c: 'bg-[#fff0b3] text-[#946f00]' },
};

/** Badge status besar & jelas (banyak user usia lanjut). */
const STATUS_TONE: Record<string, { cls: string; icon?: string }> = {
  green: { cls: 'bg-[#DCFFF1] text-[#164B35] border-[#7EE2B8]' },
  blue: { cls: 'bg-[#E9F2FF] text-[#0C459A] border-[#8FB8F6]', icon: '•' },
  amber: { cls: 'bg-[#FFF3D6] text-[#7A4100] border-[#F5CD8B]', icon: '!' },
  slate: { cls: 'bg-[hsl(var(--muted))] text-2 border-[hsl(var(--hairline))]', icon: '…' },
  gray: { cls: 'bg-[hsl(var(--muted))] text-[#626F86] border-[hsl(var(--hairline))]', icon: '—' },
};
function StatusBadge({ tone, label }: { tone?: string; label?: string }) {
  const t = STATUS_TONE[tone || 'blue'] || STATUS_TONE.blue;
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-bold ${t.cls}`}>
      {tone === 'green' ? <CheckCircle2 size={13} aria-hidden /> : <span aria-hidden>{t.icon}</span>}
      {label || '—'}
    </span>
  );
}

const SCROLL =
  '[&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-[10px] [&::-webkit-scrollbar-thumb]:bg-[#a5adba]';

export default function CardBack(props: CardBackProps) {
  const { card, open, onOpenChange, canEdit = true, picName, picUserId, ownerName, onTakePic, currentUser, isMasterCard, assignments = [], groupProgress, onOpenAssignment, isAssignment, master } = props;
  const iAmPic = !!picUserId && currentUser?.id === picUserId;
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
      className={`fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/[0.55] py-[3vh] text-foreground max-[760px]:p-[10px] ${
        isDragging ? 'cursor-col-resize select-none' : ''
      }`}
    >
      <div
        ref={gridRef}
        className="relative grid h-[94vh] max-h-[900px] w-[min(1180px,94vw)] overflow-hidden rounded-[10px] bg-[hsl(var(--elevated))] shadow-[0_12px_40px_rgba(0,0,0,0.4)] max-[760px]:!grid-cols-1 max-[760px]:h-[calc(100vh-20px)] max-[760px]:w-full max-[760px]:overflow-auto"
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
            {/* Breadcrumb: kartu ini + (kalau assignment) kartu asal-nya */}
            <div className="mb-[12px] flex flex-wrap items-center gap-1.5 text-[11px]">
              {isAssignment && master && (
                <>
                  <button
                    type="button"
                    title="Buka kartu asli"
                    onClick={() => onOpenAssignment?.(master.id)}
                    className="inline-flex items-center gap-1 rounded-[4px] bg-[hsl(var(--muted))] px-2 py-1 font-medium text-2 hover:bg-[#c1c7d0]"
                  >
                    {master.boardName || 'Kartu asli'}
                    <ArrowUpRight size={11} />
                  </button>
                  {master.listName && (
                    <span className="rounded-[4px] bg-[#e8d7ef] px-2 py-1 font-medium text-[#403152]">{master.listName}</span>
                  )}
                  <span className="text-3">·</span>
                </>
              )}
              <button
                type="button"
                title="Pindah list"
                onClick={() => (props.onOpenMove ? props.onOpenMove() : props.onMoveCard(card.listId, 0))}
                className="inline-flex items-center gap-1 rounded-[4px] bg-[#e8d7ef] px-2 py-1 font-medium text-[#403152] hover:bg-[#ddc7e8]"
              >
                {card.listName}
                <ChevronDown size={11} />
              </button>
            </div>

            {/* Banner "kartu mirror" */}
            {isAssignment && master && (
              <div className="mb-3 flex flex-wrap items-center gap-2 rounded-[6px] bg-[hsl(var(--muted))] px-3 py-2 text-[11.5px] text-2">
                <span>
                  Ini <strong>mirror</strong> dari board <strong>{master.boardName}</strong>
                  {master.listName ? <> · list <strong>{master.listName}</strong></> : null}.
                </span>
                <button
                  type="button"
                  onClick={() => onOpenAssignment?.(master.id)}
                  className="ml-auto rounded-[4px] border border-[hsl(var(--hairline))] bg-[hsl(var(--elevated))] px-2 py-1 font-semibold text-foreground hover:bg-[hsl(var(--muted))]"
                >
                  Buka kartu asli
                </button>
              </div>
            )}

            <CardTitle {...props} />

            {/* Labels + quick actions — pindah ke atas, di bawah judul (paling cepat dipindai). */}
            <CardQuickActions {...props} onLabels={() => setLabelsOpen(true)} />
            <CardLabels {...props} open={labelsOpen} onOpenChange={setLabelsOpen} />

            {/* Status + PIC digabung satu baris ringkas — dua hal yang paling
                sering dilirik sekaligus, jadi tidak perlu dua kotak terpisah. */}
            {(() => {
              const submitted = card.statusLabel === 'Menunggu persetujuan';
              const done = card.isComplete;
              // Master Card yang punya assignment → status TURUNAN dari divisi,
              // tidak ada tombol manual. Selesai otomatis saat semua divisi selesai.
              const derivedMaster = isMasterCard && assignments.length > 0;
              return (
                <div className="mb-3 flex flex-wrap items-center gap-2.5 rounded-[10px] border border-[hsl(var(--hairline))] bg-[hsl(var(--muted))] px-3 py-2.5 text-[13px]">
                  <StatusBadge tone={card.statusTone} label={card.statusLabel || (done ? 'Selesai' : 'Sedang dikerjakan')} />
                  <span className="h-4 w-px shrink-0 bg-[hsl(var(--hairline))]" />
                  <span className="font-semibold text-3">PIC</span>
                  {iAmPic ? (
                    <span className="font-semibold text-foreground">{picName} <span className="font-normal text-3">(Anda)</span></span>
                  ) : picName ? (
                    <span className="font-semibold text-foreground">{picName}</span>
                  ) : (
                    <span className="italic text-3">Belum ada</span>
                  )}
                  {derivedMaster ? (
                    <span className="ml-auto text-[11.5px] text-3">Selesai otomatis saat semua divisi selesai</span>
                  ) : (
                    <div className="ml-auto flex flex-wrap items-center gap-2">
                      {canEdit && (
                        <button
                          type="button"
                          data-testid="card-mark-done-button"
                          onClick={() => props.onUpdateCard({ isComplete: !(done || submitted) })}
                          className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-bold transition-colors active:scale-95 ${
                            done || submitted
                              ? 'border border-[hsl(var(--hairline))] bg-[hsl(var(--elevated))] text-2 hover:bg-[hsl(var(--muted))]'
                              : 'bg-[#22a06b] text-white hover:bg-[#1f845a] shadow-sm'
                          }`}
                        >
                          {done || submitted ? (
                            <><RotateCcw size={14} /> Buka Kembali</>
                          ) : (
                            <><CheckCircle2 size={14} /> Tandai Selesai</>
                          )}
                        </button>
                      )}
                      {canEdit && !iAmPic && onTakePic && (
                        <button
                          type="button"
                          data-testid="card-take-pic-button"
                          onClick={() => onTakePic(!!picName)}
                          className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-bold transition-colors active:scale-95 ${
                            picName
                              ? 'border border-[hsl(var(--hairline))] bg-[hsl(var(--elevated))] text-2 hover:bg-[hsl(var(--muted))]'
                              : 'bg-[#0c66e4] text-white hover:bg-[#0052cc] shadow-sm'
                          }`}
                        >
                          <UserCheck size={14} /> {picName ? 'Ambil alih sebagai PIC' : 'Saya yang kerjakan'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {!canEdit && (
              <p className="mb-3 rounded bg-[#fff7d6] px-2 py-1 text-[11.5px] font-semibold text-[#7f5f01]">
                Mode pantau — hanya PIC / anggota divisi terkait yang bisa mengubah.
              </p>
            )}

            {/* Di kartu Assignment: tampilkan progres legalitas keseluruhan */}
            {isAssignment && groupProgress && groupProgress.total > 0 && (
              <div className="mb-3 rounded-[8px] border border-[hsl(var(--hairline))] bg-[hsl(var(--elevated))] px-3 py-2 text-[12px] text-2">
                Progres legalitas keseluruhan:{' '}
                <strong className="text-foreground">
                  {groupProgress.done} dari {groupProgress.total} divisi selesai
                </strong>
              </div>
            )}

            {/* Harga job & pembayaran (rekap Finance) */}
            <CardFinancePanel cardId={card.id} />

            {/* Panel status pengerjaan per divisi (di Master Card) */}
            {isMasterCard && assignments.length > 0 && (
              <div className="mb-5 rounded-[10px] border border-[hsl(var(--hairline))] bg-[hsl(var(--muted))] p-4">
                <div className="mb-1 text-[13px] font-bold text-foreground">Status Pengerjaan per Divisi</div>

                {groupProgress && groupProgress.total > 0 && (
                  <div className="mb-3">
                    <div className="mb-1 flex items-center gap-1.5 text-[14px] font-bold text-foreground">
                      {groupProgress.done === groupProgress.total ? (
                        <>
                          <CheckCircle2 size={15} className="text-[#22a06b]" /> Semua divisi sudah selesai
                        </>
                      ) : (
                        `${groupProgress.done} dari ${groupProgress.total} divisi selesai`
                      )}
                    </div>
                    <div className="h-3 w-full overflow-hidden rounded-full bg-[hsl(var(--muted))]">
                      <div
                        className="h-full rounded-full bg-[#22a06b] transition-[width] duration-300"
                        style={{ width: `${Math.round((groupProgress.done / groupProgress.total) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  {assignments.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => onOpenAssignment?.(a.id)}
                      className={`flex items-center gap-3 rounded-[8px] border px-3 py-2.5 text-left transition-colors hover:border-[#0c66e4] ${
                        a.isDone ? 'border-[#7EE2B8] bg-[#f2fdf8]' : 'border-[hsl(var(--hairline))] bg-[hsl(var(--elevated))]'
                      }`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13.5px] font-bold text-foreground">{a.divisionName}</span>
                        <span className="block text-[12px] text-3">
                          {a.picName ? `PIC: ${a.picName}` : 'Belum ada PIC'}
                          {a.listName ? ` · ${a.listName}` : ''}
                        </span>
                      </span>
                      <StatusBadge
                        tone={a.displayStatusTone}
                        label={a.displayStatusLabel || DIST_LABEL[a.distributionStatus]?.t || 'Sedang dikerjakan'}
                      />
                    </button>
                  ))}
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
          className="relative z-10 cursor-col-resize bg-[hsl(var(--muted))] transition-colors hover:bg-[#0c66e4] max-[760px]:hidden"
          style={{ backgroundColor: isDragging ? '#0c66e4' : undefined }}
          onMouseDown={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
        />

        {/* RIGHT */}
        <div className="flex min-h-0 flex-col overflow-hidden border-l border-[hsl(var(--hairline))] bg-[hsl(var(--muted))] pb-[18px] pl-[15px] pr-[15px] pt-[46px] max-[760px]:h-[560px] max-[760px]:border-l-0 max-[760px]:border-t">
          <CardActivityPanel {...props} />
        </div>

        <CardBackHeader {...props} />
      </div>
    </div>
  );
}
