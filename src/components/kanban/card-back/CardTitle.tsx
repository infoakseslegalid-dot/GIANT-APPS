'use client';

/**
 * .card-title (trello-card-layout.html): lingkaran kecil (toggle complete) + <h1>.
 * Klik judul → edit inline (blur / Enter simpan, Esc batal).
 */

import React, { useEffect, useRef, useState } from 'react';
import type { CardBackProps } from './types';

export default function CardTitle({ card, onUpdateCard }: CardBackProps) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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

  return (
    <div className="mb-[22px] mt-2 flex items-center gap-[10px]">
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
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            }
          }}
          className="m-0 w-full rounded border border-[#0c66e4] px-1 text-xl font-bold leading-[1.2] text-[#172b4d] outline-none"
        />
      ) : (
        <h1
          id={`card-title-${card.id}`}
          onClick={() => setEditing(true)}
          className="m-0 cursor-text text-xl font-bold leading-[1.2]"
        >
          {card.title}
        </h1>
      )}
    </div>
  );
}
