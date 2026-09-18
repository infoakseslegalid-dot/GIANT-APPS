// @ts-nocheck
/**
 * Permission matrix (role × aksi) yang bisa diatur admin dari Panel Admin.
 *
 * - FEATURE_PERMISSIONS = daftar aksi kurasi (hal nyata yang app lakukan).
 * - table.<Model>      = di-generate otomatis dari setiap model Prisma via DMMF,
 *                        jadi tabel baru langsung muncul di matriks.
 * - super_admin selalu lolos.
 * - Cek domain lama (PIC / divisi / owner / canViewBoard) TETAP berlaku di atas
 *   matriks ini (logika AND) — matriks hanya bisa memperketat, tidak melonggarkan.
 */
import { Prisma } from '@prisma/client';
import { HTTPException } from 'hono/http-exception';
import { db } from './deps';

export const ROLES = ['super_admin', 'admin', 'cs', 'supervisor', 'staff', 'viewer'];

export const FEATURE_PERMISSIONS = [
  // Administrasi
  { key: 'user.manage', label: 'Kelola pengguna (tambah / ubah / hapus / reset password)', category: 'Administrasi',
    description: 'Tambah pengguna baru, ubah data/peran pengguna, reset password, dan nonaktifkan/hapus akun.' },
  { key: 'division.manage', label: 'Kelola divisi', category: 'Administrasi',
    description: 'Buat, ubah nama/warna, atau hapus divisi (CS, Draf, Pajak, Perizinan, Desain, dll).' },
  { key: 'automation.manage', label: 'Kelola aturan otomatisasi', category: 'Administrasi',
    description: 'Buat/ubah aturan otomatisasi per board — mis. pindah list otomatis, kirim ke divisi lain, pasang label otomatis saat kartu dibuat/dipindah.' },
  { key: 'checklist_template.manage', label: 'Kelola template checklist', category: 'Administrasi',
    description: 'Buat/ubah/hapus template checklist yang dipakai berulang saat menambah checklist ke kartu (mis. daftar kelengkapan "Pendirian PT Umum").' },
  { key: 'permission.manage', label: 'Kelola matriks hak akses ini', category: 'Administrasi',
    description: 'Membuka & mengubah halaman Hak Akses ini sendiri — siapa boleh melakukan apa, per peran.' },
  // Board & List
  { key: 'board.view_all', label: 'Lihat SEMUA board (hanya-baca, lintas divisi)', category: 'Board & List',
    description: 'Bisa melihat semua board lintas divisi, termasuk yang bukan miliknya — hanya untuk melihat, tidak bisa mengubah isinya.' },
  { key: 'board.edit_all', label: 'Ubah SEMUA board (lintas divisi) — bukan hanya-baca', category: 'Board & List',
    description: 'Sama seperti "Lihat semua board", tapi juga boleh mengubah isi board yang bukan miliknya (pindah kartu, edit list, dll).' },
  { key: 'board.manage', label: 'Buat / ubah / hapus board', category: 'Board & List',
    description: 'Membuat board baru, mengubah nama/latar board, menyalin board, atau menghapus board.' },
  { key: 'board.manage_members', label: 'Atur anggota board', category: 'Board & List',
    description: 'Menambahkan atau mengeluarkan anggota dari sebuah board.' },
  { key: 'list.manage', label: 'Buat / ubah / hapus / urutkan list', category: 'Board & List',
    description: 'Membuat, mengubah nama, menghapus, mengarsipkan, atau mengurutkan ulang list di dalam sebuah board.' },
  { key: 'list.entry_requirements', label: 'Ubah syarat pindah list & warna list', category: 'Board & List',
    description: 'Mengatur warna list dan syarat checklist yang wajib tercentang sebelum kartu boleh pindah ke list itu (menu "Alur & Syarat Pindah List").' },
  { key: 'label.manage', label: 'Buat / ubah label board', category: 'Board & List',
    description: 'Membuat label baru atau mengubah nama/warna label yang sudah ada di sebuah board.' },
  // Pekerjaan / kartu
  { key: 'card.create', label: 'Buat kartu pekerjaan', category: 'Kartu / Pekerjaan',
    description: 'Membuat kartu pekerjaan baru di sebuah board.' },
  { key: 'card.edit', label: 'Ubah isi kartu (judul, deskripsi, tanggal, cover)', category: 'Kartu / Pekerjaan',
    description: 'Mengubah judul, nama klien, deskripsi, tanggal mulai/deadline, warna/gambar cover, checklist, dan label kartu.' },
  { key: 'card.move', label: 'Pindahkan / geser kartu antar list & board', category: 'Kartu / Pekerjaan',
    description: 'Memindahkan/menggeser kartu antar list, atau antar board (termasuk mem-mirror kartu ke board lain).' },
  { key: 'card.archive', label: 'Arsipkan / kembalikan kartu', category: 'Kartu / Pekerjaan',
    description: 'Mengarsipkan kartu (menyembunyikan dari board tanpa menghapus) atau mengembalikannya dari arsip.' },
  { key: 'card.delete', label: 'Hapus kartu / kartu mirror (assignment)', category: 'Kartu / Pekerjaan',
    description: 'Menghapus kartu secara permanen, termasuk kartu mirror/assignment turunannya.' },
  { key: 'card.comment', label: 'Tulis / ubah / hapus komentar', category: 'Kartu / Pekerjaan',
    description: 'Menulis komentar baru, mengubah, atau menghapus komentar pada sebuah kartu.' },
  { key: 'card.assign_members', label: 'Tetapkan anggota / PIC ke kartu', category: 'Kartu / Pekerjaan',
    description: 'Menambahkan/menghapus anggota kartu, dan menetapkan siapa yang menjadi PIC.' },
  { key: 'card.complete', label: 'Tandai selesai / buka kembali pekerjaan', category: 'Kartu / Pekerjaan',
    description: 'Menandai pekerjaan sebagai selesai, atau membuka kembali kartu yang sudah ditandai selesai.' },
  { key: 'card.transfer_owner', label: 'Pindahkan kepemilikan (Owner) job ke orang lain', category: 'Kartu / Pekerjaan',
    description: 'Memindahkan kepemilikan (Owner) satu job ke orang lain — tetap dibatasi hanya Owner job itu sendiri yang boleh melakukannya, kecuali supervisor/super admin.' },
  // Bank Data & Distribusi
  { key: 'bankdata.send_to_division', label: 'Kirim pekerjaan ke Divisi (Bank Data)', category: 'Bank Data & Distribusi',
    description: 'Mengirim satu pekerjaan ke divisi lain lewat alur Bank Data (membuat kartu assignment turunan di board divisi tujuan).' },
  { key: 'bankdata.intake', label: 'Input pekerjaan baru langsung ke Bank Data', category: 'Bank Data & Distribusi',
    description: 'Menginput pekerjaan client-offline langsung ke Bank Data suatu divisi, tanpa lewat kartu CS terlebih dulu.' },
  { key: 'bankdata.claim', label: 'Klaim / ambil pekerjaan dari Bank Data', category: 'Bank Data & Distribusi',
    description: 'Mengambil (klaim) pekerjaan yang masih menunggu di Bank Data suatu divisi supaya jadi PIC-nya.' },
  { key: 'bankdata.release', label: 'Lepaskan pekerjaan', category: 'Bank Data & Distribusi',
    description: 'Melepaskan kembali pekerjaan yang sedang dipegang, supaya bisa diklaim anggota divisi lain.' },
  { key: 'bankdata.takeover', label: 'Ambil alih pekerjaan orang lain', category: 'Bank Data & Distribusi',
    description: 'Mengambil alih pekerjaan yang sudah dipegang orang lain — permission khusus, biasanya cuma untuk supervisor ke atas.' },
  // Halaman agregat
  { key: 'hari.view', label: 'Buka halaman Board Harian (Hari 1-7)', category: 'Halaman',
    description: 'Membuka halaman Board Harian — peta tahap HARI 1 sampai 7/8 yang merangkum kartu lintas board.' },
  { key: 'hari.advance', label: 'Majukan tahap HARI pada Board Harian', category: 'Halaman',
    description: 'Memajukan kartu ke tahap HARI berikutnya langsung dari halaman Board Harian.' },
  { key: 'skor.view', label: 'Buka halaman Peta Skor Global', category: 'Halaman',
    description: 'Membuka halaman Peta Skor Global — ringkasan posisi semua kartu CS lintas board dalam satu tampilan.' },
  { key: 'report.view', label: 'Buka halaman Rekap & Performa (per user, per divisi, keuangan)', category: 'Halaman',
    description: 'Membuka halaman Rekap & Performa — omzet, performa per user/divisi, dan rekap data keuangan job.' },
  { key: 'ai.use', label: 'Pakai Asisten AI (Tanya AI)', category: 'Halaman',
    description: 'Membuka panel "Tanya AI" dan mengirim isi board / kartu / lampiran ke Claude untuk diringkas atau ditanya. Isi kartu yang dikirim mengikuti board yang boleh dilihat user.' },
  // Profil sendiri
  { key: 'profile.edit_name', label: 'Ubah nama sendiri', category: 'Profil',
    description: 'Mengubah nama sendiri di menu Profil. Kalau dimatikan, nama hanya bisa diubah oleh pengelola pengguna (Admin Panel).' },
  { key: 'profile.edit_email', label: 'Ubah email sendiri', category: 'Profil',
    description: 'Mengubah alamat email sendiri. Email adalah identitas login, jadi default-nya MATI — nyalakan hanya untuk divisi/peran yang boleh mengurus akunnya sendiri.' },
  { key: 'profile.edit_photo', label: 'Ubah foto profil & warna avatar sendiri', category: 'Profil',
    description: 'Mengunggah/menghapus foto profil dan mengganti warna avatar sendiri.' },
  // Keuangan
  { key: 'finance.manage', label: 'Input harga job & catat pembayaran (DP / lunas)', category: 'Keuangan',
    description: 'Mengisi/mengubah harga job dan mencatat pembayaran masuk (DP/pelunasan) — tetap dibatasi hanya PIC/pembuat/owner job itu, kecuali supervisor/super admin.' },
  { key: 'finance.delete_payment', label: 'Hapus catatan pembayaran (koreksi)', category: 'Keuangan',
    description: 'Menghapus catatan pembayaran yang salah input (koreksi) — tetap dibatasi hanya PIC/pembuat/owner job itu, kecuali supervisor/super admin.' },
  // Arsip & Backup — berisi data pribadi klien (KTP, NPWP), default hanya super admin.
  { key: 'archive.view', label: 'Buka halaman Arsip & Backup', category: 'Arsip & Backup',
    description: 'Melihat halaman Arsip: grafik penyimpanan, daftar pekerjaan beserta file & kelengkapan dokumennya, dan riwayat download.' },
  { key: 'archive.download', label: 'Download arsip pekerjaan (ZIP)', category: 'Arsip & Backup',
    description: 'Mengunduh seluruh file satu pekerjaan sekaligus (ZIP) — termasuk KTP/NPWP klien. Setiap unduhan tercatat.' },
  { key: 'archive.manage', label: 'Kelola jenis dokumen & data klien di Arsip', category: 'Arsip & Backup',
    description: 'Menambah/mengubah jenis dokumen (KTP, Akta, NIB, ...) beserta status wajibnya, dan mengisi no. telepon klien di halaman Arsip.' },
].map((p) => ({ ...p, kind: 'feature' }));

/** table.<Model> untuk tiap model Prisma. */
export function tablePermissionDefs() {
  return Prisma.dmmf.datamodel.models.map((m) => ({
    key: `table.${m.name}`,
    label: `Akses langsung tabel "${m.name}"`,
    category: 'Tabel Database',
    description: `Akses baca/tulis langsung ke tabel database "${m.name}" — teknis/debug, di luar aksi harian aplikasi. Default hanya super admin.`,
    kind: 'table',
  }));
}

export function allPermissionDefs() {
  return [...FEATURE_PERMISSIONS, ...tablePermissionDefs()];
}

// Default saat sync pertama / role belum punya baris untuk suatu key.
// Tujuan: TIDAK mengubah perilaku yang sudah berjalan; admin lalu bebas mengetatkan.
function defaultAllowed(role: string, def: { key: string; kind: string }): boolean {
  if (role === 'super_admin') return true;
  if (def.kind === 'table') return false; // Hanya super_admin (yg di atas) yg bisa akses tabel secara default
  const key = def.key;

  // Arsip memuat KTP/NPWP klien → tertutup untuk semua peran; super admin membuka lewat Hak Akses.
  if (key.startsWith('archive.')) return false;

  // Profil sendiri: semua peran sudah bisa ubah nama & avatar sejak awal —
  // pertahankan supaya menambah key ini tidak mendadak mengunci siapa pun.
  // Email dikecualikan: itu identitas login, jadi admin yang membuka.
  if (key === 'profile.edit_name' || key === 'profile.edit_photo') return true;
  if (key === 'profile.edit_email') return false;

  if (role === 'viewer') return key === 'hari.view' || key === 'skor.view';

  // supervisor, admin (operasional), cs, staff
  const adminOnly = new Set([
    'user.manage', 'division.manage', 'board.manage', 'automation.manage',
    'list.entry_requirements', 'permission.manage',
  ]);
  if (adminOnly.has(key)) return false;
  if (role === 'supervisor') return true;

  // Keuangan: CS / staff PIC boleh input harga & pembayaran, TAPI route
  // `canManageFinance` tetap membatasi ke PIC / pembuat / owner kartu itu.
  // admin (operasional) & viewer tidak. Super admin & supervisor bebas (di atas).
  if (key === 'finance.manage') return role === 'cs' || role === 'staff';

  // Hapus pembayaran (koreksi): sama pola dengan finance.manage — CS/staff PIC
  // job boleh, route `canDeletePayment` tetap membatasi ke PIC/pembuat/owner.
  if (key === 'finance.delete_payment') return role === 'cs' || role === 'staff';

  // Pindahkan kepemilikan (Owner Master Card): CS/staff lolos gerbang izin ini,
  // TAPI route `/transfer-owner` tetap membatasi ke Owner job itu sendiri
  // (kecuali supervisor/super admin) — sama pola dengan finance.manage.
  if (key === 'card.transfer_owner') return role === 'cs' || role === 'staff';

  // Ambil Alih PIC (§7.5 PRD): "permission khusus", default HANYA supervisor+
  // (di atas) — admin/cs/staff/viewer tidak, meski bisa dibuka lewat Hak Akses.
  if (key === 'bankdata.takeover') return false;

  // default OFF untuk hal lintas-divisi, struktur list, & rekap global
  const staffDenied = new Set([
    'list.manage', 'board.view_all', 'board.edit_all', 'board.manage_members',
    'report.view',
  ]);
  return !staffDenied.has(key);
}

/** Upsert katalog + isi baris role×key yang belum ada. Aman dipanggil berulang. */
export async function syncPermissions() {
  const defs = allPermissionDefs();
  let addedPerms = 0;
  let addedRows = 0;

  for (const d of defs) {
    const res = await db.appPermission.upsert({
      where: { key: d.key },
      update: { label: d.label, category: d.category, kind: d.kind },
      create: { key: d.key, label: d.label, category: d.category, kind: d.kind },
    });
    if (res) { /* noop */ }
  }
  // hapus katalog yang sudah tidak ada di kode (mis. model dihapus)
  const validKeys = new Set(defs.map((d) => d.key));
  const stale = await db.appPermission.findMany({ where: { key: { notIn: [...validKeys] } } });
  if (stale.length) await db.appPermission.deleteMany({ where: { key: { in: stale.map((s) => s.key) } } });

  // role yang dikenal = ROLES + role apa pun yang dipakai user di DB
  const usedRoles = (await db.user.findMany({ select: { role: true }, distinct: ['role'] })).map((u) => u.role);
  const roles = [...new Set([...ROLES, ...usedRoles])].filter(Boolean);

  const existing = await db.rolePermission.findMany();
  const have = new Set(existing.map((r) => `${r.role}::${r.permKey}`));

  const toCreate = [];
  for (const role of roles) {
    for (const d of defs) {
      if (have.has(`${role}::${d.key}`)) continue;
      toCreate.push({ role, permKey: d.key, allowed: defaultAllowed(role, d) });
      addedRows++;
    }
  }
  if (toCreate.length) {
    // createMany aman karena kombinasi role×key belum ada
    await db.rolePermission.createMany({ data: toCreate, skipDuplicates: true });
  }
  invalidatePermCache();
  return { permissions: defs.length, newRows: addedRows, roles };
}

// ── cache matriks ───────────────────────────────────────────────────────
let _cache: { at: number; map: Record<string, Set<string>>; div: Record<string, Record<string, boolean>> } | null = null;
const TTL_MS = 15_000;

export function invalidatePermCache() {
  _cache = null;
}

async function loadMatrix() {
  if (_cache && Date.now() - _cache.at < TTL_MS) return _cache;
  const rows = await db.rolePermission.findMany({ where: { allowed: true } });
  const map: Record<string, Set<string>> = {};
  for (const r of rows) (map[r.role] ||= new Set()).add(r.permKey);
  // Override per divisi disimpan apa adanya (true DAN false), karena "false"
  // di sini berarti "divisi ini dilarang walau perannya boleh".
  const divRows = await db.divisionPermission.findMany();
  const div: Record<string, Record<string, boolean>> = {};
  for (const r of divRows) (div[r.divisionId] ||= {})[r.permKey] = r.allowed;
  _cache = { at: Date.now(), map, div };
  return _cache;
}

/**
 * Override divisi untuk satu key: true/false kalau divisi user mengaturnya,
 * null kalau tidak diatur (ikut peran).
 */
function divisionOverride(cache: any, user: any, key: string): boolean | null {
  const divId = user?.divisionId || user?.division_id;
  if (!divId) return null;
  const row = cache.div[divId];
  if (!row || !(key in row)) return null;
  return row[key];
}

/** Apakah user boleh melakukan aksi `key`? super_admin selalu true. */
export async function can(user: any, key: string): Promise<boolean> {
  if (!user) return false;
  if (user.role === 'super_admin') return true;
  const cache = await loadMatrix();
  // Divisi menang atas peran — itu gunanya override (lihat model DivisionPermission).
  const ov = divisionOverride(cache, user, key);
  if (ov !== null) return ov;
  const set = cache.map[user.role];
  if (set && set.has(key)) return true;
  // Tidak ada baris "allowed": table.* → tolak; key di luar katalog → izinkan
  // (lenient, aksi yang belum sempat di-seed jangan mendadak memblokir);
  // key feature yang ADA di katalog tapi tidak dicentang → tolak.
  if (key.startsWith('table.')) return false;
  const known = allPermissionDefs().some((d) => d.key === key);
  return !known;
}

/** Lempar 403 kalau user tidak punya izin `key`. */
export async function requirePerm(c: any, key: string) {
  const user = c.get('user');
  if (!(await can(user, key))) {
    throw new HTTPException(403, { message: `Peran "${user?.role || 'tamu'}" tidak diizinkan: ${key}` });
  }
}

/** Semua key yang diizinkan untuk user (dipakai frontend untuk sembunyikan menu). */
export async function allowedKeysFor(user: any): Promise<string[]> {
  const defs = allPermissionDefs();
  if (!user) return [];
  if (user.role === 'super_admin') return defs.map((d) => d.key);
  const cache = await loadMatrix();
  const set = cache.map[user.role] || new Set();
  return defs
    .filter((d) => {
      const ov = divisionOverride(cache, user, d.key);
      return ov !== null ? ov : set.has(d.key);
    })
    .map((d) => d.key);
}

/** Matriks penuh untuk Panel Admin. */
export async function fullMatrix() {
  const defs = allPermissionDefs();
  const usedRoles = (await db.user.findMany({ select: { role: true }, distinct: ['role'] })).map((u) => u.role);
  const roles = [...new Set([...ROLES, ...usedRoles])].filter(Boolean);
  const rows = await db.rolePermission.findMany();
  const byKey: Record<string, Record<string, boolean>> = {};
  for (const r of rows) (byKey[r.permKey] ||= {})[r.role] = r.allowed;

  const divisions = await db.division.findMany({ orderBy: { name: 'asc' } });
  const divRows = await db.divisionPermission.findMany();
  // null = ikut peran (belum di-override)
  const divByKey: Record<string, Record<string, boolean>> = {};
  for (const r of divRows) (divByKey[r.permKey] ||= {})[r.divisionId] = r.allowed;

  return {
    roles,
    divisions: divisions.map((d: any) => ({ id: d.id, name: d.name, color: d.color })),
    permissions: defs.map((d) => ({
      key: d.key,
      label: d.label,
      description: d.description || '',
      category: d.category,
      kind: d.kind,
      allow: Object.fromEntries(roles.map((role) => [
        role,
        role === 'super_admin' ? true : (byKey[d.key]?.[role] ?? false),
      ])),
      division_allow: Object.fromEntries(divisions.map((dv: any) => [
        dv.id,
        divByKey[d.key]?.[dv.id] ?? null,
      ])),
    })),
  };
}
