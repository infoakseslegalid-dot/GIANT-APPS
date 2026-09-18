// @ts-nocheck
// ─────────────────────────────────────────────────────────────────────────
// Sinkron Arsip → Google Drive, lalu → dashboard klien.
//
// Susunan di Drive (folder akar dibuat otomatis saat akun dihubungkan):
//   AKSES LEGAL - ARSIP/
//     A. DATA MENTAH (INTERNAL)/            ← TIDAK PERNAH dibagikan
//        _SEDANG BERJALAN/<Perusahaan - Layanan [AL-XXXXXX]>/
//        2026/02 - Februari/<...>/          ← dipindah saat pekerjaan FINISH
//            Catatan Klien (Google Docs), KTP - ..., NPWP - ..., Foto TTD/
//     B. DOKUMEN HASIL (DASHBOARD KLIEN)/   ← file-nya "siapa saja yg punya link"
//        (susunan sama) Akta Pendirian - PT X.pdf, SK ..., NPWP ..., NIB ...
//
// Bulan = bulan pekerjaan FINISH. Sekali finish, folder tidak dipindah lagi
// walau pekerjaan dibuka ulang. Memindah file di Drive tidak mengubah link-nya,
// jadi link yang sudah masuk dashboard tetap berlaku.
//
// Pemicu: markDirty() dari upload / ganti jenis dokumen / hapus lampiran /
// ubah data klien, plus sapuan berkala (sweepArchive) tiap 5 menit yang juga
// menangkap pekerjaan yang baru finish.
// ─────────────────────────────────────────────────────────────────────────
import { createHmac } from 'crypto';
import {
  prisma, loadJobs, monthKey, monthFolderParts, safeName, splitExt, sha1,
  clientNotesHtml, companyPayload, companyOf, jobKeyForItem,
} from './archive_core';
import * as drive from './gdrive';
import { getObject } from './storage';
import { getSetting, setSetting } from './deps';

export const ROOT_NAME = 'AKSES LEGAL - ARSIP';
export const RAW_ROOT_NAME = 'A. DATA MENTAH (INTERNAL)';
export const OUT_ROOT_NAME = 'B. DOKUMEN HASIL (DASHBOARD KLIEN)';
const RUNNING = '_SEDANG BERJALAN';
const UNSORTED = 'Belum Dipilah';
export const DASHBOARD_SETTING_KEY = 'dashboard_integration';

// ── kunci: semua operasi Drive jalan satu per satu ─────────────────────
// Sapuan latar & tombol "Sinkron sekarang" bisa jalan bersamaan; tanpa kunci
// keduanya bisa membuat folder akar / folder pekerjaan yang sama dua kali.
let _chain: Promise<any> = Promise.resolve();
function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = _chain.then(fn, fn);
  _chain = run.catch(() => {});
  return run;
}

// ── folder akar ─────────────────────────────────────────────────────────
async function alive(id?: string | null) {
  if (!id) return false;
  try {
    const f = await drive.getFile(id, 'id,trashed');
    return !f.trashed;
  } catch (e: any) {
    if (e.status === 404) return false;
    throw e;
  }
}

/** Pastikan folder akar A & B ada (dibuat ulang kalau terhapus). */
export function ensureRoots() {
  return exclusive(ensureRootsUnlocked);
}
async function ensureRootsUnlocked() {
  const s = await drive.getDriveSettings();
  let { root_id, raw_root_id, out_root_id } = s || {};
  if (!(await alive(root_id))) { root_id = await drive.createFolder(ROOT_NAME); raw_root_id = null; out_root_id = null; }
  if (!(await alive(raw_root_id))) raw_root_id = await drive.ensureFolder(RAW_ROOT_NAME, root_id);
  if (!(await alive(out_root_id))) out_root_id = await drive.ensureFolder(OUT_ROOT_NAME, root_id);
  if (root_id !== s?.root_id || raw_root_id !== s?.raw_root_id || out_root_id !== s?.out_root_id) {
    await drive.saveDriveSettings({ root_id, raw_root_id, out_root_id });
  }
  return { root_id, raw_root_id, out_root_id };
}

// ── antrean ringan ──────────────────────────────────────────────────────
let _kick: any = null;
/** Tandai pekerjaan perlu disinkron; sapuan jalan ±5 detik kemudian. */
export async function markDirty(jobKeyOrItem: any) {
  try {
    const key = typeof jobKeyOrItem === 'string' ? jobKeyOrItem : jobKeyForItem(jobKeyOrItem);
    await prisma.archiveJobSync.upsert({ where: { jobKey: key }, update: { dirty: true }, create: { jobKey: key, dirty: true } });
    if (!(await drive.isConnected())) return;
    clearTimeout(_kick);
    _kick = setTimeout(() => sweepArchive().catch((e) => console.error('[archive-sync] sweep gagal:', e)), 5000);
  } catch (e) {
    console.error('[archive-sync] markDirty gagal:', e);
  }
}

// ── sinkron satu pekerjaan ──────────────────────────────────────────────
function jobFolderName(job: any) {
  const service = job.service_type ? ` - ${job.service_type}` : '';
  const head = job.company_name ? `${job.company_name}${service}` : job.title;
  return safeName(`${head} [${job.code}]`, 120);
}

/** Pastikan folder pekerjaan ada di `parentId` dengan nama benar (pindah/rename bila perlu). */
async function placeFolder(existingId: string | null, name: string, parentId: string) {
  if (existingId) {
    try {
      const f = await drive.getFile(existingId, 'id,name,parents,trashed');
      if (!f.trashed) {
        if (!(f.parents || []).includes(parentId)) await drive.moveFile(existingId, parentId);
        if (f.name !== name) await drive.renameFile(existingId, name);
        return existingId;
      }
    } catch (e: any) {
      if (e.status !== 404) throw e;
    }
  }
  return drive.createFolder(name, parentId);
}

export function syncJob(key: string) {
  return exclusive(() => syncJobUnlocked(key));
}

async function syncJobUnlocked(key: string) {
  if (!(await drive.isConnected())) return { ok: false, reason: 'Google Drive belum dihubungkan' };
  const { jobs } = await loadJobs(key);
  const job = jobs.find((j) => j.key === key);
  if (!job) {
    await prisma.archiveJobSync.deleteMany({ where: { jobKey: key } });
    return { ok: false, reason: 'Pekerjaan tidak ditemukan' };
  }
  const roots = await ensureRootsUnlocked();
  let row = job.sync || (await prisma.archiveJobSync.findUnique({ where: { jobKey: key } }));
  // Kartu tunggal yang belakangan jadi grup Master Card (mis. dikirim ke divisi):
  // pakai folder lamanya, jangan bikin folder baru.
  if (key.startsWith('mc_') && !row?.rawFolderId) {
    const old = await prisma.archiveJobSync.findFirst({
      where: { jobKey: { in: job.item_ids.map((id: string) => `wi_${id}`) }, rawFolderId: { not: null } },
    });
    if (old) {
      await prisma.archiveJobSync.deleteMany({ where: { jobKey: key } });
      row = await prisma.archiveJobSync.update({ where: { jobKey: old.jobKey }, data: { jobKey: key } });
    }
  }

  // Bulan = bulan finish; sekali terisi tidak berubah lagi.
  const month = row?.month || (job.done ? monthKey(job.completed_at || new Date()) : null);
  const parts = month ? monthFolderParts(month) : [RUNNING];
  const name = jobFolderName(job);
  const rawParent = await drive.ensurePath(parts, roots.raw_root_id);
  const outParent = await drive.ensurePath(parts, roots.out_root_id);
  const rawFolderId = await placeFolder(row?.rawFolderId, name, rawParent);
  const outFolderId = await placeFolder(row?.outFolderId, name, outParent);

  // ── file ──
  const subCache: Record<string, string> = {};
  const sub = async (folderName: string) => (subCache[folderName] ||= await drive.ensureFolder(folderName, rawFolderId));
  const used = new Set<string>();
  const company = safeName(companyOf(job), 80);
  let fileErrors = 0;

  for (const f of job.files) {
    const out = f.document_group === 'HASIL';
    const subName = out ? null : f.subfolder || (f.document_type_id ? null : UNSORTED);
    const side = out ? 'OUT' : subName ? `RAW/${subName}` : 'RAW';
    const { base, ext } = splitExt(f.original_filename || 'file');
    const stem = out
      ? safeName(`${f.document_type_name} - ${company}`, 150)
      : safeName(f.document_type_name ? `${f.document_type_name} - ${base}` : base, 150);
    let fname = `${stem}${ext}`;
    for (let n = 2; used.has(`${side}|${fname.toLowerCase()}`); n++) fname = `${stem} (${n})${ext}`;
    used.add(`${side}|${fname.toLowerCase()}`);

    try {
      const parent = out ? outFolderId : subName ? await sub(subName) : rawFolderId;
      let fileId = f.drive_file_id;
      let url = f.drive_url;
      if (fileId && f.drive_side !== side) {
        try {
          await drive.moveFile(fileId, parent);
          if (out) await drive.shareAnyoneReader(fileId);
          else if (f.drive_side === 'OUT') await drive.unshareAnyone(fileId); // turun kelas → tutup link
        } catch (e: any) {
          if (e.status !== 404) throw e;
          fileId = null; // terhapus di Drive → upload ulang
        }
      }
      if (fileId && f.drive_name !== fname) {
        try { await drive.renameFile(fileId, fname); } catch (e: any) { if (e.status !== 404) throw e; fileId = null; }
      }
      if (!fileId) {
        const { data } = await getObject(f.storage_path);
        const up = await drive.uploadFile({ name: fname, parentId: parent, mimeType: f.content_type || 'application/octet-stream', data });
        fileId = up.id;
        url = up.webViewLink;
        if (out) await drive.shareAnyoneReader(fileId);
      }
      await prisma.attachment.update({
        where: { id: f.id },
        data: { driveFileId: fileId, driveUrl: url, driveName: fname, driveSide: side, driveSyncedAt: new Date(), driveError: null },
      });
      f.drive_file_id = fileId; f.drive_url = url; f.drive_side = side; f.drive_error = null;
    } catch (e: any) {
      fileErrors++;
      f.drive_error = String(e?.message || e).slice(0, 300);
      await prisma.attachment.update({ where: { id: f.id }, data: { driveError: f.drive_error } });
    }
  }

  // Lampiran yang dihapus di aplikasi: dokumen hasil ditutup link-nya (arsip tetap disimpan).
  const deleted = await prisma.attachment.findMany({
    where: { workItemId: { in: job.item_ids }, isDeleted: true, driveSide: 'OUT' },
  });
  for (const d of deleted) {
    try {
      await drive.unshareAnyone(d.driveFileId);
      await drive.renameFile(d.driveFileId, `[DIHAPUS] ${d.driveName || d.originalFilename}`);
    } catch (e: any) { if (e.status !== 404) console.warn('[archive-sync] tutup file terhapus gagal:', e.message); }
    await prisma.attachment.update({ where: { id: d.id }, data: { driveSide: 'DELETED' } });
  }

  // ── Catatan Klien (Google Docs) ──
  const html = clientNotesHtml(job);
  const notesHash = sha1(html);
  let notesFileId = row?.notesFileId || null;
  if (notesFileId && row?.notesHash !== notesHash) {
    try { await drive.updateFileContent(notesFileId, Buffer.from(html, 'utf8'), 'text/html'); }
    catch (e: any) { if (e.status !== 404) throw e; notesFileId = null; }
  }
  if (!notesFileId) {
    const up = await drive.uploadFile({
      name: 'Catatan Klien', parentId: rawFolderId, mimeType: 'text/html',
      data: Buffer.from(html, 'utf8'), asMime: 'application/vnd.google-apps.document',
    });
    notesFileId = up.id;
  }

  const saved = await prisma.archiveJobSync.upsert({
    where: { jobKey: key },
    update: {
      rawFolderId, outFolderId, folderName: name, month: job.done ? month : row?.month || null,
      notesFileId, notesHash, dirty: fileErrors > 0, syncedAt: new Date(),
      error: fileErrors ? `${fileErrors} file gagal dikirim` : null,
    },
    create: {
      jobKey: key, rawFolderId, outFolderId, folderName: name, month: job.done ? month : null,
      notesFileId, notesHash, dirty: fileErrors > 0, syncedAt: new Date(),
      error: fileErrors ? `${fileErrors} file gagal dikirim` : null,
    },
  });
  job.sync = saved;

  const push = await maybePushDashboard(job).catch((e) => ({ pushed: false, error: e.message }));
  return { ok: fileErrors === 0, files: job.files.length, errors: fileErrors, month: saved.month, push };
}

// ── sapuan berkala ──────────────────────────────────────────────────────
let _sweeping = false;
export async function sweepArchive() {
  if (_sweeping) return { skipped: true };
  if (!(await drive.isConnected())) return { skipped: true };
  _sweeping = true;
  const done: string[] = [];
  try {
    const keys = new Set<string>();
    // 1) ditandai kotor
    for (const r of await prisma.archiveJobSync.findMany({ where: { dirty: true }, select: { jobKey: true }, take: 200 })) keys.add(r.jobKey);
    // 2) file yang belum pernah naik ke Drive (termasuk data lama saat pertama terhubung)
    const pending = await prisma.attachment.findMany({
      where: { isDeleted: false, driveFileId: null, driveError: null, NOT: { contentType: 'link' } },
      select: { workItem: { select: { id: true, masterCardId: true } } },
      take: 500,
    });
    for (const a of pending) keys.add(jobKeyForItem(a.workItem));
    // 3) pekerjaan yang baru finish (masih di _SEDANG BERJALAN), atau selesai tapi belum terkirim ke dashboard
    const { jobs } = await loadJobs();
    const dash = await getSetting(DASHBOARD_SETTING_KEY);
    for (const j of jobs) {
      if (!j.sync?.rawFolderId) continue;
      if (j.done && !j.sync.month) keys.add(j.key);
      if (dash?.webhook_url && j.done && !j.sync.pushedAt && j.files.some((f: any) => f.document_group === 'HASIL')) keys.add(j.key);
    }
    for (const key of keys) {
      try {
        await syncJob(key); // lewat kunci, bergantian dengan sinkron manual
        done.push(key);
      } catch (e: any) {
        console.error(`[archive-sync] ${key} gagal:`, e?.message || e);
        await prisma.archiveJobSync.upsert({
          where: { jobKey: key },
          update: { error: String(e?.message || e).slice(0, 300) },
          create: { jobKey: key, dirty: true, error: String(e?.message || e).slice(0, 300) },
        }).catch(() => {});
      }
    }
    await drive.saveDriveSettings({ last_sweep_at: new Date().toISOString(), last_sweep_count: done.length });
    return { synced: done.length };
  } finally {
    _sweeping = false;
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  Dashboard klien — webhook (push) saat pekerjaan selesai / dokumen berubah
// ═══════════════════════════════════════════════════════════════════════
export function signBody(body: string, secret: string) {
  return 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
}

export async function postWebhook(url: string, secret: string, payload: any) {
  const body = JSON.stringify(payload);
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Giant-Signature': signBody(body, secret), 'User-Agent': 'GIANT-APPS-Arsip/1' },
    body,
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error(`Dashboard membalas ${r.status}`);
  return r.status;
}

/**
 * Kirim ke dashboard bila: webhook diatur, pekerjaan SELESAI, semua dokumen
 * hasil sudah punya link Drive, dan isinya berubah sejak kiriman terakhir.
 */
export async function maybePushDashboard(job: any) {
  const cfg = await getSetting(DASHBOARD_SETTING_KEY);
  if (!cfg?.webhook_url || !cfg?.api_key) return { pushed: false, reason: 'webhook belum diatur' };
  if (!job.done) return { pushed: false, reason: 'pekerjaan belum selesai' };
  const data = companyPayload(job);
  // Sudah pernah terkirim lalu dokumennya dicabut → tetap kirim (daftar kosong) supaya dashboard ikut menghapus.
  if (!data.documents_total && !job.sync?.pushedHash) return { pushed: false, reason: 'belum ada dokumen hasil' };
  if (data.documents_ready < data.documents_total) return { pushed: false, reason: 'dokumen hasil belum semua di Drive' };
  const hash = sha1(JSON.stringify(data));
  if (job.sync?.pushedHash === hash) return { pushed: false, reason: 'tidak ada perubahan' };
  try {
    await postWebhook(cfg.webhook_url, cfg.api_key, { event: 'company.documents_ready', sent_at: new Date().toISOString(), data });
    await prisma.archiveJobSync.update({ where: { jobKey: job.key }, data: { pushedHash: hash, pushedAt: new Date(), pushError: null } });
    await setSetting(DASHBOARD_SETTING_KEY, { ...cfg, last_push_at: new Date().toISOString(), last_push_error: null });
    return { pushed: true };
  } catch (e: any) {
    const msg = String(e?.message || e).slice(0, 300);
    await prisma.archiveJobSync.update({ where: { jobKey: job.key }, data: { pushError: msg } }).catch(() => {});
    await setSetting(DASHBOARD_SETTING_KEY, { ...cfg, last_push_error: msg });
    return { pushed: false, error: msg };
  }
}
