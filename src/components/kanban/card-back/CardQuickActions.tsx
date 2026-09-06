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
  'flex h-[30px] items-center gap-[5px] rounded-[5px] border border-[#d7dce2] bg-[hsl(var(--muted))] px-[10px] text-[12px] font-medium text-foreground transition-colors hover:bg-[hsl(var(--muted))]';
const pop =
  'absolute left-0 top-[36px] z-30 w-[248px] rounded-[8px] border border-[hsl(var(--hairline))] bg-[hsl(var(--elevated))] p-3 shadow-[0_8px_24px_#0003]';
const popHead = 'relative mb-2 flex h-6 items-center justify-center text-[12px] font-bold text-3';

type Which = null | 'add' | 'dates' | 'members' | 'checklist';

export default function CardQuickActions(props: CardBackProps & { onLabels?: () => void }) {
  const { card, allUsers = [], onUpdateCard, onAddChecklist, onAssignMembers, onAddAttachments, onLabels } = props;
  const checklistTemplates = props.checklistTemplates ?? [];

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

  const afterAddScroll = () => {
    setTimeout(
      () => document.querySelector('[data-card-checklist]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
      120,
    );
  };
  const addBlankChecklist = () => {
    onAddChecklist('Checklist');
    setOpenWhich(null);
    afterAddScroll();
  };
  const addFromTemplate = (t: { name: string; items: string[]; cs_self_check?: boolean }) => {
    onAddChecklist(t.name, t.items, t.cs_self_check);
    setOpenWhich(null);
    afterAddScroll();
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
            <button type="button" onClick={() => { setOpenWhich(null); onLabels?.(); }} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-[12px] text-foreground hover:bg-[hsl(var(--muted))]">
              <Tag size={14} className="text-3" /> Labels
            </button>
            <button type="button" onClick={() => { setOpenWhich(null); fileRef.current?.click(); }} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-[12px] text-foreground hover:bg-[hsl(var(--muted))]">
              <Paperclip size={14} className="text-3" /> Lampiran
            </button>
            <button type="button" onClick={() => { setOpenWhich(null); onUpdateCard({ coverColor: 'blue', coverImageUrl: null }); }} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-[12px] text-foreground hover:bg-[hsl(var(--muted))]">
              <ImageIcon size={14} className="text-3" /> Cover
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
      <div className="relative">
        <button type="button" className={btn} onClick={() => (checklistTemplates.length ? toggle('checklist') : addBlankChecklist())}>
          <SquareCheck size={14} /> Checklist
        </button>
        {openWhich === 'checklist' && (
          <div className={pop}>
            <div className={popHead}>
              Tambah checklist
              <button type="button" onClick={() => setOpenWhich(null)} className="absolute right-0 text-3 hover:text-foreground">
                <X size={14} />
              </button>
            </div>
            <button
              type="button"
              onClick={addBlankChecklist}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-[12px] text-foreground hover:bg-[hsl(var(--muted))]"
            >
              <Plus size={14} className="text-3" /> Checklist kosong
            </button>
            {checklistTemplates.length > 0 && (
              <>
                <div className="my-1.5 border-t border-[hsl(var(--hairline))]" />
                <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-3">Dari template</p>
                <div className="flex max-h-[220px] flex-col gap-0.5 overflow-y-auto">
                  {checklistTemplates.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => addFromTemplate(t)}
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] text-foreground hover:bg-[hsl(var(--muted))]"
                    >
                      <SquareCheck size={14} className="shrink-0 text-3" />
                      <span className="min-w-0 flex-1 truncate">{t.name}</span>
                      <span className="shrink-0 text-[10px] text-3">{t.items.length}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* MEMBERS */}
      <div className="relative">
        <button type="button" className={`${btn} ${card.members.length ? '!border-[#0c66e4]/40 !text-[#0c66e4]' : ''}`} onClick={() => toggle('members')}>
          <User size={14} /> Members{card.members.length ? ` (${card.members.length})` : ''}
        </button>
        {openWhich === 'members' && (
          <div className={pop}>
            <div className={popHead}>
              Anggota
              <button type="button" onClick={() => setOpenWhich(null)} className="absolute right-0 text-3 hover:text-foreground">
                <X size={14} />
              </button>
            </div>
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari anggota…"
              className="mb-2 h-8 w-full rounded-[5px] border border-[hsl(var(--hairline))] px-2 text-[12px] outline-none focus:border-[#0c66e4]"
            />
            <div className="flex max-h-[240px] flex-col gap-0.5 overflow-y-auto">
              {filteredUsers.map((u) => {
                const on = memberIds.has(u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => onAssignMembers?.(u.id, !on)}
                    className="flex items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] hover:bg-[hsl(var(--muted))]"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: u.avatarColor || '#0c66e4' }}>
                      {u.initials}
                    </span>
                    <span className="flex-1 truncate text-foreground">{u.name}</span>
                    {on && <span className="text-[#0c66e4]">✓</span>}
                  </button>
                );
              })}
              {filteredUsers.length === 0 && <p className="py-3 text-center text-[11px] text-3">Tidak ada.</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
