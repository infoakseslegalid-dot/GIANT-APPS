'use client';

/**
 * Preview lampiran INLINE — dokumen/gambar dirender langsung di dalam modal,
 * tanpa harus buka tab baru (item C-5).
 *  - gambar  → <img>
 *  - pdf     → <iframe> (viewer bawaan browser)
 *  - lainnya → kartu fallback + tombol Download
 * Header: nama file (lengkap) + Open in new tab / Download / Close.
 */

import React, { useEffect } from 'react';
import { Download, ExternalLink, X } from 'lucide-react';
import type { CardAttachment } from './types';
import { isImageMime, isPdfMime, fileExtLabel } from './helpers';

export default function AttachmentPreviewModal({
  attachment,
  onClose,
  onDownload,
}: {
  attachment: CardAttachment;
  onClose: () => void;
  onDownload?: (att: CardAttachment) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const isImage = isImageMime(attachment.mimeType);
  const isPdf = isPdfMime(attachment.mimeType);

  const download = () => {
    if (onDownload) return onDownload(attachment);
    const a = document.createElement('a');
    a.href = attachment.url;
    a.download = attachment.fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-black/80"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* header */}
      <div className="flex shrink-0 items-center gap-3 px-4 py-3 text-white">
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold" title={attachment.fileName}>
          {attachment.fileName}
        </span>
        <a
          href={attachment.url}
          target="_blank"
          rel="noreferrer"
          title="Open in new tab"
          className="flex h-8 w-8 items-center justify-center rounded-full text-white/80 hover:bg-[hsl(var(--elevated))]/15 hover:text-white"
        >
          <ExternalLink size={16} />
        </a>
        <button
          type="button"
          title="Download"
          onClick={download}
          className="flex h-8 w-8 items-center justify-center rounded-full text-white/80 hover:bg-[hsl(var(--elevated))]/15 hover:text-white"
        >
          <Download size={16} />
        </button>
        <button
          type="button"
          title="Close"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full text-white/80 hover:bg-[hsl(var(--elevated))]/15 hover:text-white"
        >
          <X size={18} />
        </button>
      </div>

      {/* body */}
      <div className="flex min-h-0 flex-1 items-center justify-center p-4">
        {isImage ? (
          <img
            src={attachment.url}
            alt={attachment.fileName}
            className="max-h-full max-w-full rounded-[6px] object-contain shadow-2xl"
          />
        ) : isPdf ? (
          <iframe
            src={attachment.url}
            title={attachment.fileName}
            className="h-full w-full max-w-[1000px] rounded-[6px] border-0 bg-[hsl(var(--elevated))] shadow-2xl"
          />
        ) : (
          <div className="flex w-[320px] flex-col items-center gap-4 rounded-[10px] bg-[hsl(var(--elevated))] p-8 text-center shadow-2xl">
            <div className="flex h-16 w-16 items-center justify-center rounded-[10px] bg-[hsl(var(--muted))] text-sm font-bold text-2">
              {fileExtLabel(attachment.fileName)}
            </div>
            <p className="text-[12px] text-3">
              Pratinjau tidak tersedia untuk tipe file ini.
            </p>
            <button
              type="button"
              onClick={download}
              className="flex items-center gap-2 rounded-[5px] bg-[#0c66e4] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#0052cc]"
            >
              <Download size={14} /> Download
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
