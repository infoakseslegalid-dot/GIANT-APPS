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
  { key: 'user.manage', label: 'Kelola pengguna (tambah / ubah / hapus / reset password)', category: 'Administrasi' },
  { key: 'division.manage', label: 'Kelola divisi', category: 'Administrasi' },
  { key: 'automation.manage', label: 'Kelola aturan otomatisasi', category: 'Administrasi' },
  { key: 'checklist_template.manage', label: 'Kelola template checklist', category: 'Administrasi' },
  { key: 'permission.manage', label: 'Kelola matriks hak akses ini', category: 'Administrasi' },
  // Board & List
  { key: 'board.view_all', label: 'Lihat SEMUA board (hanya-baca, lintas divisi)', category: 'Board & List' },
  { key: 'board.edit_all', label: 'Ubah SEMUA board (lintas divisi) — bukan hanya-baca', category: 'Board & List' },
  { key: 'board.manage', label: 'Buat / ubah / hapus board', category: 'Board & List' },
  { key: 'board.manage_members', label: 'Atur anggota board', category: 'Board & List' },
  { key: 'list.manage', label: 'Buat / ubah / hapus / urutkan list', category: 'Board & List' },
  { key: 'list.entry_requirements', label: 'Ubah syarat pindah list & warna list', category: 'Board & List' },
  { key: 'label.manage', label: 'Buat / ubah label board', category: 'Board & List' },
  // Pekerjaan / kartu
  { key: 'card.create', label: 'Buat kartu pekerjaan', category: 'Kartu / Pekerjaan' },
  { key: 'card.edit', label: 'Ubah isi kartu (judul, deskripsi, tanggal, cover)', category: 'Kartu / Pekerjaan' },
  { key: 'card.move', label: 'Pindahkan / geser kartu antar list & board', category: 'Kartu / Pekerjaan' },
  { key: 'card.archive', label: 'Arsipkan / kembalikan kartu', category: 'Kartu / Pekerjaan' },
  { key: 'card.delete', label: 'Hapus kartu / kartu mirror (assignment)', category: 'Kartu / Pekerjaan' },
  { key: 'card.comment', label: 'Tulis / ubah / hapus komentar', category: 'Kartu / Pekerjaan' },
  { key: 'card.assign_members', label: 'Tetapkan anggota / PIC ke kartu', category: 'Kartu / Pekerjaan' },
  { key: 'card.complete', label: 'Tandai selesai / buka kembali pekerjaan', category: 'Kartu / Pekerjaan' },
  // Bank Data & Distribusi
  { key: 'bankdata.send_to_division', label: 'Kirim pekerjaan ke Divisi (Bank Data)', category: 'Bank Data & Distribusi' },
  { key: 'bankdata.intake', label: 'Input pekerjaan baru langsung ke Bank Data', category: 'Bank Data & Distribusi' },
  { key: 'bankdata.claim', label: 'Klaim / ambil pekerjaan dari Bank Data', category: 'Bank Data & Distribusi' },
  { key: 'bankdata.release', label: 'Lepaskan pekerjaan', category: 'Bank Data & Distribusi' },
  { key: 'bankdata.takeover', label: 'Ambil alih pekerjaan orang lain', category: 'Bank Data & Distribusi' },
  // Halaman agregat
  { key: 'hari.view', label: 'Buka halaman Board Harian (Hari 1-7)', category: 'Halaman' },
  { key: 'hari.advance', label: 'Majukan tahap HARI pada Board Harian', category: 'Halaman' },
  { key: 'skor.view', label: 'Buka halaman Peta Skor Global', category: 'Halaman' },
  { key: 'report.view', label: 'Buka halaman Rekap & Performa (per user, per divisi, keuangan)', category: 'Halaman' },
  // Keuangan
  { key: 'finance.manage', label: 'Input harga job & catat pembayaran (DP / lunas)', category: 'Keuangan' },
].map((p) => ({ ...p, kind: 'feature' }));

/** table.<Model> untuk tiap model Prisma. */
export function tablePermissionDefs() {
  return Prisma.dmmf.datamodel.models.map((m) => ({
    key: `table.${m.name}`,
    label: `Akses langsung tabel "${m.name}"`,
    category: 'Tabel Database',
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
let _cache: { at: number; map: Record<string, Set<string>> } | null = null;
const TTL_MS = 15_000;

export function invalidatePermCache() {
  _cache = null;
}

async function loadMatrix() {
  if (_cache && Date.now() - _cache.at < TTL_MS) return _cache.map;
  const rows = await db.rolePermission.findMany({ where: { allowed: true } });
  const map: Record<string, Set<string>> = {};
  for (const r of rows) (map[r.role] ||= new Set()).add(r.permKey);
  _cache = { at: Date.now(), map };
  return map;
}

/** Apakah user boleh melakukan aksi `key`? super_admin selalu true. */
export async function can(user: any, key: string): Promise<boolean> {
  if (!user) return false;
  if (user.role === 'super_admin') return true;
  const map = await loadMatrix();
  const set = map[user.role];
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
  const map = await loadMatrix();
  const set = map[user.role] || new Set();
  return defs.filter((d) => set.has(d.key)).map((d) => d.key);
}

/** Matriks penuh untuk Panel Admin. */
export async function fullMatrix() {
  const defs = allPermissionDefs();
  const usedRoles = (await db.user.findMany({ select: { role: true }, distinct: ['role'] })).map((u) => u.role);
  const roles = [...new Set([...ROLES, ...usedRoles])].filter(Boolean);
  const rows = await db.rolePermission.findMany();
  const byKey: Record<string, Record<string, boolean>> = {};
  for (const r of rows) (byKey[r.permKey] ||= {})[r.role] = r.allowed;
  return {
    roles,
    permissions: defs.map((d) => ({
      key: d.key,
      label: d.label,
      category: d.category,
      kind: d.kind,
      allow: Object.fromEntries(roles.map((role) => [
        role,
        role === 'super_admin' ? true : (byKey[d.key]?.[role] ?? false),
      ])),
    })),
  };
}
