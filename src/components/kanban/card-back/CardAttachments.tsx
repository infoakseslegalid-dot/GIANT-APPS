'use client';

/**
 * Attachments (item C-5..8):
 *  - preview file INLINE (modal) tanpa buka tab baru
 *  - nama file panjang → ellipsis, ekstensi tetap terlihat + tooltip
 *  - tombol Download langsung (di samping Open in new tab & Delete)
 *  - multi-select (checkbox) untuk aksi bulk download / delete
 *  - "View all attachments" — collapsed kalau lebih dari 4 file
 */

import React, { useMemo, useRef, useState } from 'react';
import { Paperclip, Download, ExternalLink, Trash2, Eye, ImageDown } from 'lucide-react';
import type { CardAttachment, CardBackProps } from './types';
import {
  splitFileName,
  fileExtLabel,
  isImageMime,
  formatFileSize,
  formatRelativeShort,
} from './helpers';
import AttachmentPreviewModal from './AttachmentPreviewModal';

const COLLAPSE_LIMIT = 4;

function downloadOne(att: CardAttachment) {
  const a = document.createElement('a');
  a.href = att.url;
  a.download = att.fileName;
  a.target = '_blank';
  a.rel = 'noreferrer';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export default function CardAttachments({
  card,
  onAddAttachments,
  onDeleteAttachments,
  onUpdateCard,
}: Pick<CardBackProps, 'card' | 'onAddAttachments' | 'onDeleteAttachments' | 'onUpdateCard'>) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const [preview, setPreview] = useState<CardAttachment | null>(null);

  const list = card.attachments;
  const visible = showAll ? list : list.slice(0, COLLAPSE_LIMIT);
  const hiddenCount = list.length - visible.length;

  const allVisibleSelected = visible.length > 0 && visible.every((a) => selected.has(a.id));
  const selectedList = useMemo(() => list.filter((a) => selected.has(a.id)), [list, selected]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAllVisible = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visible.forEach((a) => next.delete(a.id));
      else visible.forEach((a) => next.add(a.id));
      return next;
    });

  const bulkDelete = () => {
    if (selectedList.length === 0) return;
    if (!confirm(`Hapus ${selectedList.length} lampiran?`)) return;
    onDeleteAttachments(selectedList.map((a) => a.id));
    setSelected(new Set());
  };

  const bulkDownload = () => selectedList.forEach(downloadOne);

  return (
    <div className="mt-[18px]">
      <div className="mb-[11px] flex items-center gap-2">
        <Paperclip size={16} className="shrink-0" />
        <div className="text-[13px] font-bold">Attachments</div>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="ml-auto h-[28px] rounded-[5px] border border-[#dfe1e6] bg-[#f7f8f9] px-[11px] text-[13px] hover:bg-[#e9ebee]"
        >
          Add
        </button>
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

      {list.length === 0 ? (
        <p className="rounded-[6px] bg-[#f7f8f9] p-3 text-[11.5px] text-[#7a869a]">Belum ada lampiran.</p>
      ) : (
        <>
          {/* bar aksi bulk / select all */}
          <div className="mb-2 flex items-center gap-2 text-[11px] text-[#5e6c84]">
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={toggleAllVisible}
                className="h-[14px] w-[14px] accent-[#0c66e4]"
              />
              Pilih semua
            </label>
            {selectedList.length > 0 && (
              <>
                <span className="font-semibold text-[#172b4d]">{selectedList.length} dipilih</span>
                <button
                  type="button"
                  onClick={bulkDownload}
                  className="flex items-center gap-1 rounded px-1.5 py-0.5 underline hover:text-[#172b4d]"
                >
                  <Download size={12} /> Download
                </button>
                <button
                  type="button"
                  onClick={bulkDelete}
                  className="flex items-center gap-1 rounded px-1.5 py-0.5 underline hover:text-[#e34935]"
                >
                  <Trash2 size={12} /> Hapus
                </button>
                <button
                  type="button"
                  onClick={() => setSelected(new Set())}
                  className="ml-auto rounded px-1.5 py-0.5 underline hover:text-[#172b4d]"
                >
                  Batal
                </button>
              </>
            )}
          </div>

          <div className="flex flex-col gap-2">
            {visible.map((att) => {
              const { base, ext } = splitFileName(att.fileName);
              const img = isImageMime(att.mimeType);
              return (
                <div
                  key={att.id}
                  className="group flex items-center gap-2.5 rounded-[6px] border border-[#dfe1e6] bg-white p-2 hover:bg-[#f7f8f9]"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(att.id)}
                    onChange={() => toggle(att.id)}
                    className="h-[14px] w-[14px] shrink-0 accent-[#0c66e4]"
                  />

                  <button
                    type="button"
                    onClick={() => setPreview(att)}
                    className="flex h-[44px] w-[58px] shrink-0 items-center justify-center overflow-hidden rounded-[4px] bg-[#091e420f] text-[10px] font-bold text-[#44546f]"
                  >
                    {img ? (
                      <img src={att.thumbUrl || att.url} alt={att.fileName} className="h-full w-full object-cover" />
                    ) : (
                      fileExtLabel(att.fileName)
                    )}
                  </button>

                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => setPreview(att)}
                      className="flex w-full items-baseline text-left text-[12px] font-semibold text-[#172b4d]"
                      title={att.fileName}
                    >
                      <span className="min-w-0 truncate">{base}</span>
                      <span className="shrink-0">{ext}</span>
                    </button>
                    <div className="mt-0.5 text-[10px] text-[#5e6c84]">
                      {formatRelativeShort(att.createdAt)}
                      {att.size ? ` · ${formatFileSize(att.size)}` : ''}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      title="Preview"
                      onClick={() => setPreview(att)}
                      className="flex h-7 w-7 items-center justify-center rounded text-[#44546f] hover:bg-[#091e420f]"
                    >
                      <Eye size={14} />
                    </button>
                    {img && (
                      <button
                        type="button"
                        title="Jadikan cover"
                        onClick={() => onUpdateCard({ coverImageUrl: att.url, coverColor: null })}
                        className="flex h-7 w-7 items-center justify-center rounded text-[#44546f] hover:bg-[#091e420f]"
                      >
                        <ImageDown size={14} />
                      </button>
                    )}
                    <a
                      href={att.url}
                      target="_blank"
                      rel="noreferrer"
                      title="Open in new tab"
                      className="flex h-7 w-7 items-center justify-center rounded text-[#44546f] hover:bg-[#091e420f]"
                    >
                      <ExternalLink size={14} />
                    </a>
                    <button
                      type="button"
                      title="Download"
                      onClick={() => downloadOne(att)}
                      className="flex h-7 w-7 items-center justify-center rounded text-[#44546f] hover:bg-[#091e420f]"
                    >
                      <Download size={14} />
                    </button>
                    <button
                      type="button"
                      title="Delete"
                      onClick={() => {
                        if (confirm(`Hapus "${att.fileName}"?`)) onDeleteAttachments([att.id]);
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded text-[#44546f] hover:bg-[#091e420f] hover:text-[#e34935]"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {list.length > COLLAPSE_LIMIT && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="mt-2 rounded-[5px] bg-[#f1f2f4] px-3 py-1.5 text-[12px] font-medium text-[#172b4d] hover:bg-[#dcdfe4]"
            >
              {showAll ? 'Tampilkan lebih sedikit' : `View all attachments (${hiddenCount} lagi)`}
            </button>
          )}
        </>
      )}

      {preview && (
        <AttachmentPreviewModal
          attachment={preview}
          onClose={() => setPreview(null)}
          onDownload={downloadOne}
        />
      )}
    </div>
  );
}
