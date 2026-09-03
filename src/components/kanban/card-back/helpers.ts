import { differenceInHours, format, formatDistanceToNow } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import type { CardMember, LabelColor } from './types';

/**
 * Warna avatar solid — di-hash dari user id agar konsisten.
 * Mengikuti trello-card-layout.html: biru (#0c66e4) default, oranye (#f39c12) untuk sebagian user.
 */
export function avatarStyle(userId: string): { background: string; color: string } {
  const palette: { background: string; color: string }[] = [
    { background: '#0c66e4', color: '#fff' },
    { background: '#f39c12', color: '#172b4d' },
    { background: '#6554c0', color: '#fff' },
    { background: '#00857a', color: '#fff' },
    { background: '#ae2e24', color: '#fff' },
    { background: '#943d73', color: '#fff' },
  ];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length];
}

/** Warna avatar untuk seorang member — pakai avatarColor bila ada, kalau tidak di-hash dari id. */
export function memberAvatarStyle(m: CardMember): { background: string; color: string } {
  if (m.avatarColor) {
    const hex = m.avatarColor.replace('#', '');
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return { background: m.avatarColor, color: luminance > 0.6 ? '#172b4d' : '#fff' };
  }
  return avatarStyle(m.id);
}

/** Warna chip label (trello-card-layout.html: .green/.purple/.blue/.cyan/.grayblue). Teks selalu putih. */
const LABEL_HEX: Record<string, string> = {
  green: '#36b37e',
  purple: '#8777d9',
  blue: '#0c66e4',
  sky: '#4ca6c5',
  gray: '#4b98b4',
  yellow: '#e2b203',
  orange: '#e56910',
  red: '#e34935',
  lime: '#5b7f24',
  pink: '#e774bb',
};

export function labelHex(color: LabelColor): string {
  return LABEL_HEX[color] ?? '#4b98b4';
}

/**
 * Resolusi warna cover/label: nama LabelColor ('green') → hex; string lain
 * (mis. '#4bce97' dari DB) diteruskan apa adanya sebagai CSS color.
 */
export function resolveColor(c?: string | null): string | null {
  if (!c) return null;
  return LABEL_HEX[c] ?? c;
}

/**
 * Timestamp aktivitas:
 *  - < 24 jam  → relatif ("baru saja", "3 jam yang lalu")
 *  - >= 24 jam → absolut ("1 Sep 2026, 10:00")
 */
export function formatActivityTime(iso: string): string {
  const date = new Date(iso);
  if (differenceInHours(new Date(), date) < 24) {
    return formatDistanceToNow(date, { addSuffix: true, locale: idLocale });
  }
  return format(date, 'd MMM yyyy, HH:mm', { locale: idLocale });
}

export function formatFullDate(iso: string): string {
  return format(new Date(iso), 'PPpp', { locale: idLocale });
}

/** Timestamp relatif ringkas untuk ujung kanan baris activity ("2 jam lalu"). */
export function formatRelativeShort(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const min = Math.round(diffMs / 60000);
  if (min < 1) return 'baru saja';
  if (min < 60) return `${min} mnt lalu`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} jam lalu`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day} hr lalu`;
  return format(date, 'd MMM', { locale: idLocale });
}

/** Pisahkan nama file jadi basis + ekstensi (".pdf") supaya ekstensi tetap terlihat saat di-ellipsis. */
export function splitFileName(fileName: string): { base: string; ext: string } {
  const dot = fileName.lastIndexOf('.');
  if (dot <= 0 || dot === fileName.length - 1) return { base: fileName, ext: '' };
  return { base: fileName.slice(0, dot), ext: fileName.slice(dot) };
}

export function isImageMime(mime: string): boolean {
  return /^image\//i.test(mime);
}

export function isPdfMime(mime: string): boolean {
  return /pdf$/i.test(mime);
}

export function fileExtLabel(fileName: string): string {
  const { ext } = splitFileName(fileName);
  return (ext.replace('.', '') || 'FILE').toUpperCase().slice(0, 4);
}

export function formatFileSize(bytes?: number | null): string {
  if (!bytes || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Konversi teks komentar (mini-markdown yang dihasilkan toolbar) → HTML.
 *  **tebal**  *miring*  `- ` list  [teks](url)  URL telanjang
 */
export function commentTextToHtml(raw: string, mentionNames: string[] = []): string {
  const escNames = [...new Set(mentionNames)]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map((n) => escapeHtml(n).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const mentionRe = escNames.length ? new RegExp(`@(${escNames.join('|')})`, 'g') : null;

  const inline = (line: string) => {
    let s = escapeHtml(line)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
      .replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+|blob:[^\s)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%; border-radius:6px; margin:8px 0;" />')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
      .replace(/(^|\s)(https?:\/\/[^\s<]+)/g, '$1<a href="$2" target="_blank" rel="noreferrer">$2</a>');
    if (mentionRe) s = s.replace(mentionRe, '<span class="mention" style="color:#0c66e4;background:#e9f2ff;border-radius:3px;padding:0 3px;font-weight:600">@$1</span>');
    return s;
  };

  const blocks = raw.replace(/\r\n/g, '\n').split(/\n{2,}/);
  return blocks
    .map((block) => {
      const lines = block.split('\n');
      const isList = lines.every((l) => /^\s*-\s+/.test(l));
      if (isList) {
        return `<ul>${lines.map((l) => `<li>${inline(l.replace(/^\s*-\s+/, ''))}</li>`).join('')}</ul>`;
      }
      return `<p>${lines.map(inline).join('<br>')}</p>`;
    })
    .join('');
}

/** HTML → teks polos (untuk mengisi textarea saat edit). */
export function htmlToPlainText(html: string): string {
  if (typeof window === 'undefined') return html.replace(/<[^>]+>/g, '');
  const el = document.createElement('div');
  el.innerHTML = html
    .replace(/<\/(p|div|li|ul|ol)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n');
  return (el.innerText || el.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
}

type RichEdit = { value: string; selStart: number; selEnd: number };

/** Bungkus teks terpilih dengan penanda (mis. `**` untuk bold). */
export function wrapSelection(el: HTMLTextAreaElement, marker: string): RichEdit {
  const { value, selectionStart: s, selectionEnd: e } = el;
  const sel = value.slice(s, e) || 'teks';
  const next = value.slice(0, s) + marker + sel + marker + value.slice(e);
  return { value: next, selStart: s + marker.length, selEnd: s + marker.length + sel.length };
}

/** Beri prefix di tiap baris terpilih (mis. `- ` untuk list). */
export function prefixLines(el: HTMLTextAreaElement, prefix: string): RichEdit {
  const { value, selectionStart: s, selectionEnd: e } = el;
  const lineStart = value.lastIndexOf('\n', s - 1) + 1;
  const seg = value.slice(lineStart, e);
  const replaced = seg.split('\n').map((l) => (l.startsWith(prefix) ? l : prefix + l)).join('\n');
  const next = value.slice(0, lineStart) + replaced + value.slice(e);
  return { value: next, selStart: lineStart, selEnd: lineStart + replaced.length };
}

/** Sisipkan link markdown `[teks](url)` di posisi kursor. */
export function insertLink(el: HTMLTextAreaElement, url: string): RichEdit {
  const { value, selectionStart: s, selectionEnd: e } = el;
  const label = value.slice(s, e) || url;
  const snippet = `[${label}](${url})`;
  const next = value.slice(0, s) + snippet + value.slice(e);
  return { value: next, selStart: s + snippet.length, selEnd: s + snippet.length };
}
