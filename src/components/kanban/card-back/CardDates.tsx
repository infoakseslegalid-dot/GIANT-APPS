'use client';

/**
 * Dates — popover melayang (compact) yang di-anchor ke tombol "Dates".
 * Mulai & Tenggat, auto-save on change lewat onUpdateCard.
 */

import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { CardBackProps } from './types';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

function toInput(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso);
  return Number.isNaN(d.getTime()) ? '' : format(d, 'yyyy-MM-dd');
}
function labelFor(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso);
  return Number.isNaN(d.getTime()) ? '—' : format(d, 'd MMM yyyy', { locale: idLocale });
}

export default function CardDatesPopover({
  card,
  onUpdateCard,
  onClose,
}: Pick<CardBackProps, 'card' | 'onUpdateCard'> & { onClose?: () => void }) {
  const [nowTs] = useState(() => Date.now());
  const dueOverdue = !!card.dueDate && !card.isComplete && new Date(toInput(card.dueDate)).getTime() < nowTs;
  const inp =
    'h-8 w-full rounded-[5px] border border-[#dfe1e6] bg-white px-2 text-[12px] text-[#172b4d] outline-none focus:border-[#0c66e4]';

  return (
    <div className="absolute left-0 top-[36px] z-30 w-[236px] rounded-[8px] border border-[#dfe1e6] bg-white p-3 shadow-[0_8px_24px_#0003]">
      <div className="relative mb-2 flex h-6 items-center justify-center text-[12px] font-bold text-[#5e6c84]">
        Tanggal
        <button type="button" onClick={onClose} className="absolute right-0 text-[#6b778c] hover:text-[#172b4d]">
          <X size={14} />
        </button>
      </div>

      <label className="mb-2 block text-[10px] font-bold uppercase tracking-wide text-[#8590a2]">
        Mulai
        <input
          type="date"
          value={toInput(card.startDate)}
          max={toInput(card.dueDate) || undefined}
          onChange={(e) => onUpdateCard({ startDate: e.target.value || null })}
          className={`mt-1 ${inp}`}
        />
      </label>

      <label className="block text-[10px] font-bold uppercase tracking-wide text-[#8590a2]">
        Tenggat
        <input
          type="date"
          value={toInput(card.dueDate)}
          min={toInput(card.startDate) || undefined}
          onChange={(e) => onUpdateCard({ dueDate: e.target.value || null })}
          className={`mt-1 ${inp} ${dueOverdue ? '!border-[#e34935]' : ''}`}
        />
      </label>

      <div className="mt-2 flex items-center justify-between text-[10px] text-[#5e6c84]">
        <span className={dueOverdue ? 'font-semibold text-[#e34935]' : ''}>
          {labelFor(card.dueDate)}{dueOverdue ? ' · Terlambat' : ''}
        </span>
        {(card.startDate || card.dueDate) && (
          <button
            type="button"
            onClick={() => onUpdateCard({ startDate: null, dueDate: null })}
            className="rounded px-1 py-0.5 underline hover:text-[#172b4d]"
          >
            Hapus
          </button>
        )}
      </div>
    </div>
  );
}
