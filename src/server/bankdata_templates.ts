/**
 * Struktur List baku per tipe board divisi — mengikuti board Trello asli Giant Apps.
 * SERAGAM: setiap board di satu divisi memakai daftar list yang sama.
 * Key = Division.key.  CS memegang kepemilikan Master Card & mengirim kerjaan ke admin.
 */
export const LIST_TEMPLATES: Record<string, string[]> = {
  cs: [
    'COWORKING & VO',
    'SKOR 1',
    'SKOR 2',
    'SKOR 3 BUTUH DRAFT',
    'SKOR 3 REVISI DRAFT',
    'SKOR 3 (DRAFT FINAL TTD)',
    'SKOR 4',
    'SKOR 5',
    'SKOR 5 (YAYASAN DAN PERKUMPULAN)',
    'SKOR 5 SIAP KIRIM NOTARIS',
    'SKOR 5 (NPWP)',
    'SKOR 5 (NIB)',
    'SKOR 5 (BELUM PENYERAHAN)',
    'SKOR 5 UPDATE MEREK 2026',
    'SKOR 6 FINISH',
    'KOMPLAIN',
    'SKOR 7 (DATA FU KEMBALI)',
  ],
  draf: [
    'LIST',
    'DOING',
    'FINISH TODAY',
    'FU NOTARIS (ELIS)',
    'SIAP KIRIM NOTARIS (ELIS)',
    'PRATINJAU (ELIS)',
    'VIA WA ADMIN/GC ADMIN (ANTI)',
    'PESAN NAMA (ANTI)',
    'INPUTAN (ANTI)',
    'ADMIN',
  ],
  pajak: [
    'LIST SPT TAHUNAN',
    'LIST PENGURUSAN PAJAK',
    'LIST NPWP',
    'DOING',
    'FINISH',
    'KONTRAK PAJAK',
    'VIA CHAT (AMEL)',
    'EMAIL NOTARIS',
    'ADMIN',
  ],
  perizinan: [
    'PERIZINAN LAINNYA',
    'LIST NIB',
    'DOING (to be confirm)',
    'PRODUK LAINNYA',
    'MEREK',
    'MENUNGGU HASIL VERIFIKASI',
    'DONE TODAY',
    'ADMIN',
    'NOTARIS SOPPENG',
  ],
  desain: [
    'Daily Rutin',
    'LIST LOGO / COMPRO',
    'DOING',
    'FINISH',
    'REVISI',
    'LINK',
    'REFERENSI/CATATAN',
    'HARGA PROMO',
    'HASBY JOBDESK',
    'AKSES LEGAL INDONESIA (VIDEO/GAMBAR)',
    'KONTEN LAYANAN AKSES LEGAL INDONESIA (VIDEO/GAMBAR)',
    'KANTOR NOT. SOPPENG',
    'INFLUENCER',
    'RE-DESAIN',
  ],
};

/** List "selesai/output" tiap board — pemicu penyelesaian tahap pada otomasi. */
export const OUTPUT_LIST: Record<string, string> = {
  cs: 'SKOR 6 FINISH',
  draf: 'FINISH TODAY',
  pajak: 'FINISH',
  perizinan: 'DONE TODAY',
  desain: 'FINISH',
};

/** Checklist progres legalitas yang otomatis melekat pada Master Card. */
export const MASTER_CHECKLIST_TITLE = 'Progres Legalitas';
export const MASTER_CHECKLIST_ITEMS = ['Akta', 'SK Kemenkumham', 'NPWP', 'NIB'];

/** Divisi tujuan → item checklist Master Card yang di-centang saat assignment-nya selesai. */
export const STAGE_BY_DIVISION: Record<string, string> = {
  draf: 'Akta',
  pajak: 'NPWP',
  perizinan: 'NIB',
};

export function norm(s: string): string {
  return (s || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Warna default seragam untuk semua list (bisa di-override admin per-list). */
export const DEFAULT_LIST_COLOR = '#F1F2F4';
