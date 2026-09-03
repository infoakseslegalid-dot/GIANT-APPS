'use client';

/**
 * .description (trello-card-layout.html) — menggunakan contentEditable
 * sehingga user bisa langsung copy-paste gambar secara visual.
 */

import React, { useEffect, useRef, useState } from 'react';
import { AlignLeft } from 'lucide-react';
import type { CardBackProps } from './types';

const RICH =
  'text-[11.5px] leading-[1.55] text-[#3f4b5a] ' +
  '[&_p]:m-0 [&_p]:mb-[10px] ' +
  '[&_ul]:mt-1 [&_ul]:mb-[13px] [&_ul]:pl-[18px] [&_ul]:list-disc ' +
  '[&_ol]:mt-1 [&_ol]:mb-[13px] [&_ol]:pl-[18px] [&_ol]:list-decimal ' +
  '[&_li]:my-1 [&_a]:text-[#0c66e4] [&_a]:underline [&_strong]:font-bold [&_em]:italic ' +
  '[&_img]:max-w-full [&_img]:rounded-[6px] [&_img]:my-2';

export default function CardDescription({ card, onUpdateCard }: CardBackProps) {
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isEmpty = !card.description || card.description === '<p></p>';

  useEffect(() => {
    if (!editing) return;
    const el = ref.current;
    if (el) {
      el.innerHTML = card.description || '';
      el.focus();
    }
  }, [editing]);

  const open = () => {
    setEditing(true);
  };

  const commit = () => {
    setEditing(false);
    const next = ref.current?.innerHTML || '';
    if (next !== card.description) onUpdateCard({ description: next });
  };

  return (
    <>
      <div className="mb-3 flex items-center gap-2">
        <AlignLeft size={18} className="shrink-0" />
        <div className="m-0 text-[13px] font-bold">Description</div>
        {!editing && !isEmpty && (
          <button
            type="button"
            onClick={open}
            className="ml-auto h-[28px] rounded-[5px] border border-[#dfe1e6] bg-[#f7f8f9] px-[11px] text-[13px] hover:bg-[#e9ebee]"
          >
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <div>
          <div
            contentEditable
            suppressContentEditableWarning
            ref={ref}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation();
                setEditing(false);
              }
            }}
            onPaste={(e) => {
              const files = e.clipboardData?.files;
              if (files && files.length > 0) {
                const file = files[0];
                if (file.type.startsWith("image/")) {
                  e.preventDefault();
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    document.execCommand("insertImage", false, ev.target?.result as string);
                  };
                  reader.readAsDataURL(file);
                }
              }
            }}
            className={`${RICH} min-h-[120px] max-h-[420px] overflow-y-auto w-full rounded-[6px] border-2 border-[#0c66e4] p-[10px] outline-none cursor-text bg-white`}
          />
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={commit} className="rounded-[4px] bg-[#0c66e4] px-[12px] py-[6px] text-[12px] font-semibold text-white hover:bg-[#0052cc]">
              Simpan
            </button>
            <button type="button" onClick={() => setEditing(false)} className="rounded-[4px] px-[12px] py-[6px] text-[12px] font-medium text-[#44546f] hover:bg-[#091e420f]">
              Batal
            </button>
          </div>
        </div>
      ) : isEmpty ? (
        <button
          type="button"
          onClick={open}
          className="w-full rounded-[6px] bg-[#f7f8f9] p-3 text-left text-[11.5px] text-[#7a869a] hover:bg-[#e9ebee]"
        >
          Tambahkan deskripsi yang lebih detail...
        </button>
      ) : (
        <div
          onClick={open}
            onPaste={(e) => {
              const files = e.clipboardData?.files;
              if (files && files.length > 0) {
                const file = files[0];
                if (file.type.startsWith("image/")) {
                  e.preventDefault();
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    document.execCommand("insertImage", false, ev.target?.result as string);
                  };
                  reader.readAsDataURL(file);
                }
              }
            }}
          className={`${RICH} cursor-text rounded-[6px] p-1 -m-1 hover:bg-[#f7f8f9]`}
          dangerouslySetInnerHTML={{ __html: card.description }}
        />
      )}
    </>
  );
}
