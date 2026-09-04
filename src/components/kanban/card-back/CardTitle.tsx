'use client';

/**
 * .card-title (trello-card-layout.html): lingkaran kecil (toggle complete) + <h1>.
 * Klik judul → edit inline (blur / Enter simpan, Esc batal).
 */

import React, { useEffect, useRef, useState } from 'react';
import type { CardBackProps } from './types';

export default function CardTitle({ card, onUpdateCard, canEdit = true }: CardBackProps) {
  const [editing, setEditing] = useState(false);
  const [editingClient, setEditingClient] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const clientRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setEditing(false);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const next = (inputRef.current?.value ?? '').trim();
    if (next && next !== card.title) onUpdateCard({ title: next });
  };
  const commitClient = () => {
    setEditingClient(false);
    const next = (clientRef.current?.value ?? '').trim();
    if (next !== (card.clientName ?? '')) onUpdateCard({ clientName: next || null });
  };

  return (
    <div className="mb-[18px] mt-2">
      <div className="flex items-center gap-[10px]">
        <button
          type="button"
          aria-label="Tandai selesai"
          aria-pressed={card.isComplete}
          onClick={() => onUpdateCard({ isComplete: !card.isComplete })}
          className={`h-3 w-3 shrink-0 rounded-full border-[1.7px] ${
            card.isComplete ? 'border-[#36b37e] bg-[#36b37e]' : 'border-[#6b778c] bg-transparent'
          }`}
        />
        {editing ? (
          <input
            ref={inputRef}
            defaultValue={card.title}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commit(); }
            }}
            className="m-0 w-full rounded border border-[#0c66e4] px-1 text-xl font-bold leading-[1.2] text-foreground outline-none"
          />
        ) : (
          <h1
            id={`card-title-${card.id}`}
            onClick={() => canEdit && setEditing(true)}
            className="m-0 cursor-text text-xl font-bold leading-[1.2]"
          >
            {card.title}
          </h1>
        )}
      </div>

      {/* Nama klien (info klien) — inline edit */}
      <div className="mt-1 pl-[22px] text-[13px]">
        {editingClient ? (
          <input
            ref={clientRef}
            autoFocus
            defaultValue={card.clientName ?? ''}
            placeholder="Nama klien"
            onBlur={commitClient}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commitClient(); }
              if (e.key === 'Escape') setEditingClient(false);
            }}
            className="w-[280px] max-w-full rounded border border-[#0c66e4] px-1.5 py-0.5 text-[13px] text-foreground outline-none"
          />
        ) : (
          <button
            type="button"
            data-testid="card-client-name"
            onClick={() => canEdit && setEditingClient(true)}
            className="inline-flex items-center gap-1.5 rounded px-1 py-0.5 text-3 hover:bg-[hsl(var(--muted))]"
          >
            <span className="text-3">Klien:</span>
            {card.clientName
              ? <span className="font-medium text-foreground">{card.clientName}</span>
              : <span className="italic text-3">{canEdit ? 'tambahkan nama klien' : '—'}</span>}
          </button>
        )}
      </div>
    </div>
  );
}
