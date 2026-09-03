'use client';

/**
 * Baris aksi kartu: Add · Dates · Checklist · Members.
 * Semua fungsional, tanpa ikon dobel.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Clock, Plus, SquareCheck, User, Tag, Image as ImageIcon, Paperclip, X } from 'lucide-react';
import type { CardBackProps } from './types';
import CardDatesPopover from './CardDates';

const btn =
  'flex h-[30px] items-center gap-[5px] rounded-[5px] border border-[#d7dce2] bg-[#f7f8f9] px-[10px] text-[12px] font-medium text-[#172b4d] transition-colors hover:bg-[#e9ebee]';
const pop =
  'absolute left-0 top-[36px] z-30 w-[248px] rounded-[8px] border border-[#dfe1e6] bg-white p-3 shadow-[0_8px_24px_#0003]';
const popHead = 'relative mb-2 flex h-6 items-center justify-center text-[12px] font-bold text-[#5e6c84]';

type Which = null | 'add' | 'dates' | 'members';

export default function CardQuickActions(props: CardBackProps & { onLabels?: () => void }) {
  const { card, allUsers = [], onUpdateCard, onAddChecklist, onAssignMembers, onAddAttachments, onLabels } = props;

  const [openWhich, setOpenWhich] = useState<Which>(null);
  const [search, setSearch] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!openWhich) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpenWhich(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpenWhich(null);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [openWhich]);

  const toggle = (w: Which) => setOpenWhich((cur) => (cur === w ? null : w));
  const memberIds = new Set(card.members.map((m) => m.id));
  const filteredUsers = allUsers.filter((u) => u.name.toLowerCase().includes(search.toLowerCase()));
  const hasDates = !!card.startDate || !!card.dueDate;

  const addChecklist = () => {
    if (!card.checklists.some((c) => c.title === 'Checklist')) onAddChecklist('Checklist');
    document.querySelector('[data-card-checklist]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <div ref={wrapRef} className="mb-[20px] flex flex-wrap items-center gap-[7px]">
      {/* ADD */}
      <div className="relative">
        <button type="button" className={btn} onClick={() => toggle('add')}>
          <Plus size={14} /> Add
        </button>
        {openWhich === 'add' && (
          <div className={pop}>
            <div className={popHead}>Tambah ke kartu</div>
            <button type="button" onClick={() => { setOpenWhich(null); onLabels?.(); }} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-[12px] text-[#172b4d] hover:bg-[#f1f2f4]">
              <Tag size={14} className="text-[#5e6c84]" /> Labels
            </button>
            <button type="button" onClick={() => { setOpenWhich(null); fileRef.current?.click(); }} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-[12px] text-[#172b4d] hover:bg-[#f1f2f4]">
              <Paperclip size={14} className="text-[#5e6c84]" /> Lampiran
            </button>
            <button type="button" onClick={() => { setOpenWhich(null); onUpdateCard({ coverColor: 'blue', coverImageUrl: null }); }} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-[12px] text-[#172b4d] hover:bg-[#f1f2f4]">
              <ImageIcon size={14} className="text-[#5e6c84]" /> Cover
            </button>
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length) onAddAttachments(files);
            e.target.value = '';
          }}
        />
      </div>

      {/* DATES */}
      <div className="relative">
        <button type="button" className={`${btn} ${hasDates ? '!border-[#0c66e4]/40 !text-[#0c66e4]' : ''}`} onClick={() => toggle('dates')}>
          <Clock size={14} /> Dates
        </button>
        {openWhich === 'dates' && (
          <CardDatesPopover card={card} onUpdateCard={onUpdateCard} onClose={() => setOpenWhich(null)} />
        )}
      </div>

      {/* CHECKLIST */}
      <button type="button" className={btn} onClick={addChecklist}>
        <SquareCheck size={14} /> Checklist
      </button>

      {/* MEMBERS */}
      <div className="relative">
        <button type="button" className={`${btn} ${card.members.length ? '!border-[#0c66e4]/40 !text-[#0c66e4]' : ''}`} onClick={() => toggle('members')}>
          <User size={14} /> Members{card.members.length ? ` (${card.members.length})` : ''}
        </button>
        {openWhich === 'members' && (
          <div className={pop}>
            <div className={popHead}>
              Anggota
              <button type="button" onClick={() => setOpenWhich(null)} className="absolute right-0 text-[#6b778c] hover:text-[#172b4d]">
                <X size={14} />
              </button>
            </div>
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari anggota…"
              className="mb-2 h-8 w-full rounded-[5px] border border-[#dfe1e6] px-2 text-[12px] outline-none focus:border-[#0c66e4]"
            />
            <div className="flex max-h-[240px] flex-col gap-0.5 overflow-y-auto">
              {filteredUsers.map((u) => {
                const on = memberIds.has(u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => onAssignMembers?.(u.id, !on)}
                    className="flex items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] hover:bg-[#f1f2f4]"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: u.avatarColor || '#0c66e4' }}>
                      {u.initials}
                    </span>
                    <span className="flex-1 truncate text-[#172b4d]">{u.name}</span>
                    {on && <span className="text-[#0c66e4]">✓</span>}
                  </button>
                );
              })}
              {filteredUsers.length === 0 && <p className="py-3 text-center text-[11px] text-[#8590a2]">Tidak ada.</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
