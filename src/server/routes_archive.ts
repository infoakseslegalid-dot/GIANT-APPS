// @ts-nocheck
// ─────────────────────────────────────────────────────────────────────────
// ARSIP & BACKUP  (halaman super admin, /arsip)
//  - Jenis dokumen (KTP, NPWP, Akta, SK, NIB, ...) yang ditempel ke lampiran.
//  - Ringkasan penyimpanan + grafik, daftar pekerjaan & kelengkapan dokumen,
//    detail file per pekerjaan, data klien, download ZIP (tercatat di log).
//  - Integrasi: Google Drive (archive_sync.ts) & API dashboard klien
//    (/api/public/dashboard/* — pakai API key, bukan login).
// Logika pengumpulan data ada di archive_core.ts.
// ─────────────────────────────────────────────────────────────────────────
import { Hono } from 'hono';
import { PassThrough, Readable } from 'stream';
import { randomBytes, timingSafeEqual } from 'crypto';
import archiver from 'archiver';
import { requirePerm } from './permissions';
import { getObject } from './storage';
import { getSetting, setSetting } from './deps';
import {
  prisma, DOC_GROUPS, DASHBOARD_CATEGORIES, ensureDocTypes, fmtType, loadJobs, publicJob,
  monthKey, safeName, splitExt, escHtml, clientNotesHtml, clientDataPatch, ensureMasterCardFor,
  companyPayload,
} from './archive_core';
import * as drive from './gdrive';
import { syncJob, sweepArchive, markDirty, ensureRoots, postWebhook, DASHBOARD_SETTING_KEY } from './archive_sync';

const router = new Hono();

// Folder di dalam ZIP — sama dengan susunan Google Drive.
const ZIP_RAW = 'A. Data Mentah';
const ZIP_OUT = 'B. Dokumen Hasil';

const superOnly = (c: any) => {
  if (c.get('user')?.role !== 'super_admin') {
    return c.json({ detail: 'Hanya super admin yang boleh mengatur koneksi ini' }, 403);
  }
  return null;
};

// ═══════════════════════════════════════════════════════════════════════
//  JENIS DOKUMEN
// ═══════════════════════════════════════════════════════════════════════

// Dipakai juga dropdown lampiran di kartu → cukup login.
router.get('/archive/document-types', async (c) => {
  await ensureDocTypes();
  const rows = await prisma.documentType.findMany({ orderBy: [{ position: 'asc' }, { name: 'asc' }] });
  return c.json(rows.map(fmtType));
});

function typeData(body: any) {
  const data: any = {};
  if (body.group !== undefined && DOC_GROUPS.includes(body.group)) data.group = body.group;
  if (body.required !== undefined) data.required = !!body.required;
  if (body.is_active !== undefined) data.isActive = !!body.is_active;
  if (body.position !== undefined) data.position = Number(body.position) || 0;
  if (body.dashboard_category !== undefined) {
    data.dashboardCategory = DASHBOARD_CATEGORIES.includes(body.dashboard_category) ? body.dashboard_category : null;
  }
  if (body.subfolder !== undefined) data.subfolder = body.subfolder ? safeName(body.subfolder, 60) : null;
  return data;
}

router.post('/archive/document-types', async (c) => {
  await requirePerm(c, 'archive.manage');
  const body = await c.req.json();
  const name = String(body.name || '').trim();
  if (!name) return c.json({ detail: 'Nama jenis dokumen wajib diisi' }, 400);
  const exists = await prisma.documentType.findUnique({ where: { name } });
  if (exists) return c.json({ detail: `Jenis dokumen "${name}" sudah ada` }, 400);
  const max = await prisma.documentType.aggregate({ _max: { position: true } });
  const row = await prisma.documentType.create({
    data: { name, group: 'LAIN', ...typeData(body), position: (max._max.position ?? -1) + 1 },
  });
  return c.json(fmtType(row));
});

router.patch('/archive/document-types/:id', async (c) => {
  await requirePerm(c, 'archive.manage');
  const id = c.req.param('id');
  const body = await c.req.json();
  const data: any = typeData(body);
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return c.json({ detail: 'Nama tidak boleh kosong' }, 400);
    const dup = await prisma.documentType.findFirst({ where: { name, NOT: { id } } });
    if (dup) return c.json({ detail: `Jenis dokumen "${name}" sudah ada` }, 400);
    data.name = name;
  }
  const row = await prisma.documentType.update({ where: { id }, data });
  // Nama/grup/subfolder memengaruhi nama & letak file di Drive → sinkron ulang pekerjaan terkait.
  if (data.name || data.group || data.subfolder !== undefined) {
    const items = await prisma.attachment.findMany({
      where: { documentTypeId: id, isDeleted: false },
      select: { workItem: { select: { id: true, masterCardId: true } } },
      distinct: ['workItemId'],
    });
    for (const a of items) await markDirty(a.workItem);
  }
  return c.json(fmtType(row));
});

// ═══════════════════════════════════════════════════════════════════════
//  RINGKASAN (grafik)
// ═══════════════════════════════════════════════════════════════════════
router.get('/archive/summary', async (c) => {
  await requirePerm(c, 'archive.view');
  const { jobs, types } = await loadJobs();
  const files = jobs.flatMap((j) => j.files.map((f: any) => ({ ...f, job: j })));

  // 12 bulan terakhir (termasuk bulan ini), walau kosong — supaya grafik tidak bolong.
  const now = new Date();
  const months: any[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ month: monthKey(d), bytes: 0, count: 0 });
  }
  const mIdx = Object.fromEntries(months.map((m, i) => [m.month, i]));
  for (const f of files) {
    const i = mIdx[monthKey(f.created_at)];
    if (i !== undefined) { months[i].bytes += f.size; months[i].count += 1; }
  }

  const byTypeMap: Record<string, any> = {};
  for (const f of files) {
    const k = f.document_type_id || '__none__';
    byTypeMap[k] ||= { name: f.document_type_name || 'Belum ditandai', group: f.document_group || null, bytes: 0, count: 0 };
    byTypeMap[k].bytes += f.size; byTypeMap[k].count += 1;
  }
  const byDivMap: Record<string, any> = {};
  for (const f of files) {
    const k = f.division_name || 'Tanpa divisi';
    byDivMap[k] ||= { name: k, bytes: 0, count: 0 };
    byDivMap[k].bytes += f.size; byDivMap[k].count += 1;
  }

  const thisMonth = monthKey(now);
  const withFiles = jobs.filter((j) => j.file_count > 0);
  return c.json({
    total_bytes: files.reduce((s, f) => s + f.size, 0),
    total_files: files.length,
    files_this_month: files.filter((f) => monthKey(f.created_at) === thisMonth).length,
    bytes_this_month: files.filter((f) => monthKey(f.created_at) === thisMonth).reduce((s, f) => s + f.size, 0),
    untyped_files: files.filter((f) => !f.document_type_id).length,
    drive_pending: files.filter((f) => !f.drive_file_id).length,
    drive_errors: files.filter((f) => f.drive_error).length,
    total_jobs: jobs.length,
    jobs_with_files: withFiles.length,
    jobs_done: jobs.filter((j) => j.done).length,
    jobs_complete_docs: jobs.filter((j) => j.required_total > 0 && j.required_done === j.required_total).length,
    // Pekerjaan sudah selesai tapi dokumen wajibnya belum lengkap → perlu dikejar.
    jobs_done_incomplete: jobs.filter((j) => j.done && j.required_done < j.required_total).length,
    by_month: months,
    by_type: Object.values(byTypeMap).sort((a: any, b: any) => b.bytes - a.bytes),
    by_division: Object.values(byDivMap).sort((a: any, b: any) => b.bytes - a.bytes),
    top_jobs: [...withFiles].sort((a, b) => b.total_bytes - a.total_bytes).slice(0, 10).map(publicJob),
    required_types: types.filter((t) => t.required && t.isActive).map((t) => t.name),
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  DAFTAR & DETAIL PEKERJAAN
// ═══════════════════════════════════════════════════════════════════════
function matchQuery(j: any, q: string) {
  const digits = q.replace(/\D/g, '');
  const hay = [j.title, j.client, j.company_name, j.client_phone, j.client_email, j.code].filter(Boolean).join(' ').toLowerCase();
  if (hay.includes(q)) return true;
  // cari no. WA tanpa peduli format (0812-xxx vs 62812xxx)
  if (digits.length >= 6 && j.client_phone) {
    const p = j.client_phone.replace(/\D/g, '').replace(/^62/, '0');
    return p.includes(digits.replace(/^62/, '0'));
  }
  return false;
}

router.get('/archive/jobs', async (c) => {
  await requirePerm(c, 'archive.view');
  const q = (c.req.query('q') || '').trim().toLowerCase();
  const month = c.req.query('month') || '';           // YYYY-MM (bulan pekerjaan dibuat)
  const status = c.req.query('status') || '';         // done | active
  const docs = c.req.query('docs') || '';             // complete | incomplete | empty
  const sort = c.req.query('sort') || 'newest';       // newest | size | name

  let { jobs } = await loadJobs();
  if (q) jobs = jobs.filter((j) => matchQuery(j, q));
  if (month) jobs = jobs.filter((j) => monthKey(j.created_at) === month);
  if (status === 'done') jobs = jobs.filter((j) => j.done);
  if (status === 'active') jobs = jobs.filter((j) => !j.done);
  if (docs === 'complete') jobs = jobs.filter((j) => j.required_total > 0 && j.required_done === j.required_total);
  if (docs === 'incomplete') jobs = jobs.filter((j) => j.required_done < j.required_total);
  if (docs === 'empty') jobs = jobs.filter((j) => j.file_count === 0);

  if (sort === 'size') jobs.sort((a, b) => b.total_bytes - a.total_bytes);
  else if (sort === 'name') jobs.sort((a, b) => a.title.localeCompare(b.title, 'id'));
  else jobs.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));

  return c.json(jobs.map(publicJob));
});

router.get('/archive/jobs/:key', async (c) => {
  await requirePerm(c, 'archive.view');
  const key = c.req.param('key');
  const { jobs, types } = await loadJobs(key);
  const job = jobs.find((j) => j.key === key);
  if (!job) return c.json({ detail: 'Pekerjaan tidak ditemukan' }, 404);
  const have = new Set(job.files.map((f: any) => f.document_type_id).filter(Boolean));
  const logs = await prisma.archiveDownloadLog.findMany({ where: { jobKey: key }, orderBy: { createdAt: 'desc' }, take: 20 });
  return c.json({
    ...publicJob(job),
    drive_connected: await drive.isConnected(),
    raw_folder_url: drive.folderUrl(job.sync?.rawFolderId),
    out_folder_url: drive.folderUrl(job.sync?.outFolderId),
    notes_url: job.sync?.notesFileId ? `https://docs.google.com/document/d/${job.sync.notesFileId}/edit` : null,
    files: job.files.map(({ storage_path, ...f }: any) => f),
    links: job.links.map(({ storage_path, ...f }: any) => ({ ...f, url: storage_path })),
    checklist: types.filter((t) => t.isActive && (t.required || have.has(t.id))).map((t) => ({
      id: t.id, name: t.name, group: t.group, required: t.required,
      count: job.files.filter((f: any) => f.document_type_id === t.id).length,
    })),
    dashboard: companyPayload(job),
    downloads: logs.map((l) => ({ id: l.id, user_name: l.userName, file_count: l.fileCount, total_bytes: Number(l.totalBytes), created_at: l.createdAt })),
  });
});

// Data klien & perusahaan (disimpan di Master Card; kartu tunggal dibuatkan dulu).
router.patch('/archive/jobs/:key', async (c) => {
  await requirePerm(c, 'archive.manage');
  const key = c.req.param('key');
  const data = clientDataPatch(await c.req.json());

  let mcId: string | null = key.startsWith('mc_') ? key.slice(3) : null;
  if (!mcId && key.startsWith('wi_')) {
    const item = await prisma.workItem.findUnique({ where: { id: key.slice(3) } });
    if (!item) return c.json({ detail: 'Pekerjaan tidak ditemukan' }, 404);
    mcId = (await ensureMasterCardFor(item)).id;
  }
  if (!mcId) return c.json({ detail: 'Pekerjaan tidak ditemukan' }, 404);
  await prisma.masterCard.update({ where: { id: mcId }, data });
  await markDirty(`mc_${mcId}`);
  return c.json({ ok: true, key: `mc_${mcId}` });
});

// Sinkron satu pekerjaan ke Google Drive sekarang juga.
router.post('/archive/jobs/:key/sync', async (c) => {
  await requirePerm(c, 'archive.manage');
  if (!(await drive.isConnected())) return c.json({ detail: 'Google Drive belum dihubungkan' }, 400);
  try {
    return c.json(await syncJob(c.req.param('key')));
  } catch (e: any) {
    return c.json({ detail: e?.message || 'Sinkron gagal' }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════
//  DOWNLOAD ZIP per pekerjaan
// ═══════════════════════════════════════════════════════════════════════
function summaryHtml(job: any, failed: string[], user: any) {
  const rows = job.files.map((f: any, i: number) => `<tr><td>${i + 1}</td><td>${escHtml(f.document_type_name || '—')}</td><td>${escHtml(f.original_filename)}</td><td>${(f.size / 1024 / 1024).toFixed(2)} MB</td><td>${escHtml(f.uploaded_by_name || '')}</td><td>${escHtml(f.division_name || '')}</td><td>${new Date(f.created_at).toLocaleString('id-ID')}</td></tr>`).join('');
  const links = job.links.length
    ? `<h2>Tautan</h2><ul>${job.links.map((l: any) => `<li>${escHtml(l.original_filename)} — ${escHtml(l.storage_path)}</li>`).join('')}</ul>` : '';
  const fail = failed.length
    ? `<h2 style="color:#c9372c">File gagal diambil</h2><ul>${failed.map((f) => `<li>${escHtml(f)}</li>`).join('')}</ul>` : '';
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Ringkasan ${escHtml(job.title)}</title>
<style>body{font-family:system-ui,sans-serif;margin:32px;color:#172b4d}table{border-collapse:collapse;width:100%;font-size:13px}td,th{border:1px solid #dcdfe4;padding:6px 8px;text-align:left}th{background:#f1f2f4}dt{font-weight:600}dd{margin:0 0 8px}</style></head><body>
<h1>${escHtml(job.title)}</h1>
<dl>
<dt>Kode</dt><dd>${escHtml(job.code)}</dd>
<dt>Perusahaan</dt><dd>${escHtml(job.company_name || '—')}</dd>
<dt>Klien</dt><dd>${escHtml(job.client || '—')}</dd>
<dt>No. telepon</dt><dd>${escHtml(job.client_phone || '—')}</dd>
<dt>Owner (CS)</dt><dd>${escHtml(job.owner_name || '—')}</dd>
<dt>Divisi terlibat</dt><dd>${escHtml(job.divisions.map((d: any) => d.name).join(', ') || '—')}</dd>
<dt>Dibuat</dt><dd>${new Date(job.created_at).toLocaleString('id-ID')}</dd>
<dt>Status</dt><dd>${job.done ? 'Selesai' + (job.completed_at ? ' — ' + new Date(job.completed_at).toLocaleString('id-ID') : '') : 'Masih berjalan'}</dd>
<dt>Kelengkapan dokumen wajib</dt><dd>${job.required_done}/${job.required_total}${job.missing.length ? ' — belum ada: ' + escHtml(job.missing.join(', ')) : ''}</dd>
</dl>
<h2>Daftar file (${job.files.length})</h2>
<table><thead><tr><th>#</th><th>Jenis</th><th>Nama file</th><th>Ukuran</th><th>Diupload oleh</th><th>Divisi</th><th>Tanggal</th></tr></thead><tbody>${rows}</tbody></table>
${links}${fail}
<p style="color:#626f86;font-size:12px;margin-top:24px">Diunduh oleh ${escHtml(user?.name || '')} pada ${new Date().toLocaleString('id-ID')} dari GIANT-APPS.</p>
</body></html>`;
}

router.get('/archive/jobs/:key/download', async (c) => {
  await requirePerm(c, 'archive.download');
  const user = c.get('user');
  const key = c.req.param('key');
  const { jobs } = await loadJobs(key);
  const job = jobs.find((j) => j.key === key);
  if (!job) return c.json({ detail: 'Pekerjaan tidak ditemukan' }, 404);

  const root = safeName(`${job.company_name || job.title}${job.client ? ` (${job.client})` : ''}`);
  const pass = new PassThrough();
  const zip = archiver('zip', { zlib: { level: 6 } });
  zip.on('warning', (e) => console.warn('[archive] zip warning:', e?.message));
  zip.on('error', (e) => { console.error('[archive] zip error:', e); pass.destroy(e); });
  zip.pipe(pass);

  // Diisi di latar belakang supaya file dialirkan satu per satu (tidak semua ditahan di memori).
  (async () => {
    const used = new Set<string>();
    const failed: string[] = [];
    for (const f of job.files) {
      const out = f.document_group === 'HASIL';
      const folder = out ? ZIP_OUT
        : `${ZIP_RAW}${f.subfolder ? `/${safeName(f.subfolder, 60)}` : f.document_type_id ? '' : '/Belum Dipilah'}`;
      const { base, ext } = splitExt(f.original_filename || 'file');
      const stem = safeName(f.document_type_name ? `${f.document_type_name} - ${base}` : base, 120);
      let name = `${root}/${folder}/${stem}${ext}`;
      for (let n = 2; used.has(name.toLowerCase()); n++) name = `${root}/${folder}/${stem} (${n})${ext}`;
      used.add(name.toLowerCase());
      try {
        const { data } = await getObject(f.storage_path);
        const done = new Promise((res) => zip.once('entry', res));
        zip.append(data, { name, date: new Date(f.created_at) });
        await done;
      } catch (e: any) {
        failed.push(`${f.original_filename} (${e?.message || 'gagal'})`);
      }
    }
    zip.append(clientNotesHtml(job), { name: `${root}/${ZIP_RAW}/Catatan Klien.html` });
    zip.append(summaryHtml(job, failed, user), { name: `${root}/Ringkasan Pekerjaan.html` });
    await zip.finalize();
    await prisma.archiveDownloadLog.create({
      data: {
        jobKey: key, jobTitle: job.title, userId: user.id, userName: user.name,
        fileCount: job.files.length - failed.length, totalBytes: BigInt(job.total_bytes),
      },
    }).catch((e) => console.error('[archive] gagal mencatat log download:', e));
  })().catch((e) => { console.error('[archive] download gagal:', e); pass.destroy(e); });

  const fileName = `${root}.zip`;
  return new Response(Readable.toWeb(pass) as any, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${fileName.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      'Cache-Control': 'no-store',
    },
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  RIWAYAT DOWNLOAD
// ═══════════════════════════════════════════════════════════════════════
router.get('/archive/downloads', async (c) => {
  await requirePerm(c, 'archive.view');
  const rows = await prisma.archiveDownloadLog.findMany({ orderBy: { createdAt: 'desc' }, take: 300 });
  return c.json(rows.map((l) => ({
    id: l.id, job_key: l.jobKey, job_title: l.jobTitle, user_name: l.userName,
    file_count: l.fileCount, total_bytes: Number(l.totalBytes), created_at: l.createdAt,
  })));
});

// ═══════════════════════════════════════════════════════════════════════
//  INTEGRASI: status Google Drive + dashboard
// ═══════════════════════════════════════════════════════════════════════
router.get('/archive/integrations', async (c) => {
  await requirePerm(c, 'archive.manage');
  const s = await drive.getDriveSettings();
  const connected = await drive.isConnected();
  let quota = null;
  let driveError = s?.broken || null;
  if (connected && !driveError) {
    try {
      const a = await drive.about();
      quota = { usage: Number(a.storageQuota?.usage || 0), limit: a.storageQuota?.limit ? Number(a.storageQuota.limit) : null };
    } catch (e: any) { driveError = e.message; }
  }
  const [pending, errors, pushErrors] = await Promise.all([
    prisma.attachment.count({ where: { isDeleted: false, driveFileId: null, NOT: { contentType: 'link' } } }),
    prisma.attachment.count({ where: { isDeleted: false, driveError: { not: null } } }),
    prisma.archiveJobSync.count({ where: { pushError: { not: null } } }),
  ]);
  const dash = (await getSetting(DASHBOARD_SETTING_KEY)) || {};
  return c.json({
    drive: {
      configured: drive.gdriveConfigured(),
      connected,
      email: s?.email || null,
      connected_at: s?.connected_at || null,
      error: driveError,
      redirect_uri: drive.redirectUri(c),
      root_url: drive.folderUrl(s?.root_id),
      raw_url: drive.folderUrl(s?.raw_root_id),
      out_url: drive.folderUrl(s?.out_root_id),
      quota,
      pending_files: pending,
      error_files: errors,
      last_sweep_at: s?.last_sweep_at || null,
    },
    dashboard: {
      has_key: !!dash.api_key,
      key_preview: dash.api_key ? `${dash.api_key.slice(0, 8)}…${dash.api_key.slice(-4)}` : null,
      webhook_url: dash.webhook_url || null,
      last_push_at: dash.last_push_at || null,
      last_push_error: dash.last_push_error || null,
      push_errors: pushErrors,
      api_base: `${drive.publicBaseUrl(c)}/api/public/dashboard`,
    },
  });
});

// ── Google Drive: hubungkan / putuskan / sinkron ──
router.get('/integrations/google/connect', async (c) => {
  const d = superOnly(c); if (d) return d;
  if (!drive.gdriveConfigured()) return c.text('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET belum diisi di .env server', 400);
  const state = randomBytes(16).toString('hex');
  await setSetting('gdrive_oauth_state', { state, user_id: c.get('user').id, at: Date.now() });
  return c.redirect(drive.authUrl(c, state));
});

router.get('/integrations/google/callback', async (c) => {
  const back = (qs: string) => c.redirect(`/arsip?tab=integrasi&${qs}`);
  const d = superOnly(c); if (d) return back('drive=forbidden');
  const saved = await getSetting('gdrive_oauth_state');
  const { code, state, error } = c.req.query();
  if (error) return back(`drive=error&msg=${encodeURIComponent(error)}`);
  if (!saved?.state || saved.state !== state || Date.now() - saved.at > 15 * 60_000) return back('drive=error&msg=state');
  try {
    const tok = await drive.exchangeCode(c, code);
    if (!tok.refresh_token) return back('drive=error&msg=no_refresh_token');
    const email = await drive.userEmailFromToken(tok.access_token);
    const prev = await drive.getDriveSettings();
    const sameAccount = !!prev?.email && prev.email === email;
    // Akun berbeda → folder & file yang tercatat milik akun lama, harus dibuat ulang di akun baru.
    // Akun sama (mis. hubungkan ulang setelah token kedaluwarsa) → lanjutkan apa adanya.
    if (!sameAccount) await drive.clearDrive();
    await drive.saveDriveSettings({
      refresh_token: tok.refresh_token, email, connected_at: new Date().toISOString(),
      connected_by: c.get('user').name, broken: null,
    });
    await setSetting('gdrive_oauth_state', null);
    if (!sameAccount) {
      await prisma.attachment.updateMany({ where: { driveFileId: { not: null } }, data: { driveFileId: null, driveUrl: null, driveName: null, driveSide: null, driveError: null } });
      await prisma.archiveJobSync.updateMany({ data: { rawFolderId: null, outFolderId: null, notesFileId: null, notesHash: null, month: null, pushedHash: null, dirty: true } });
    }
    await ensureRoots();
    setTimeout(() => sweepArchive().catch((e) => console.error('[archive-sync] sweep awal gagal:', e)), 1000);
    return back('drive=ok');
  } catch (e: any) {
    return back(`drive=error&msg=${encodeURIComponent(e?.message || 'gagal')}`);
  }
});

router.post('/archive/drive/disconnect', async (c) => {
  const d = superOnly(c); if (d) return d;
  await drive.clearDrive();
  return c.json({ ok: true });
});

router.post('/archive/drive/sync-all', async (c) => {
  await requirePerm(c, 'archive.manage');
  if (!(await drive.isConnected())) return c.json({ detail: 'Google Drive belum dihubungkan' }, 400);
  // File yang sebelumnya gagal dicoba lagi.
  await prisma.attachment.updateMany({ where: { driveError: { not: null } }, data: { driveError: null } });
  sweepArchive().catch((e) => console.error('[archive-sync] sync-all gagal:', e));
  return c.json({ ok: true, started: true });
});

// ── Dashboard: API key & webhook ──
router.post('/archive/dashboard/key', async (c) => {
  const d = superOnly(c); if (d) return d;
  const cfg = (await getSetting(DASHBOARD_SETTING_KEY)) || {};
  const api_key = 'gak_' + randomBytes(24).toString('hex');
  await setSetting(DASHBOARD_SETTING_KEY, { ...cfg, api_key, key_created_at: new Date().toISOString() });
  return c.json({ api_key }); // ditampilkan SEKALI di layar
});

router.put('/archive/dashboard/webhook', async (c) => {
  const d = superOnly(c); if (d) return d;
  const { url } = await c.req.json();
  const clean = String(url || '').trim();
  if (clean && !/^https?:\/\/\S+$/i.test(clean)) return c.json({ detail: 'URL webhook tidak valid' }, 400);
  const cfg = (await getSetting(DASHBOARD_SETTING_KEY)) || {};
  await setSetting(DASHBOARD_SETTING_KEY, { ...cfg, webhook_url: clean || null, last_push_error: null });
  return c.json({ ok: true });
});

router.post('/archive/dashboard/test', async (c) => {
  const d = superOnly(c); if (d) return d;
  const cfg = (await getSetting(DASHBOARD_SETTING_KEY)) || {};
  if (!cfg.webhook_url || !cfg.api_key) return c.json({ detail: 'Isi URL webhook & buat API key dulu' }, 400);
  try {
    const status = await postWebhook(cfg.webhook_url, cfg.api_key, { event: 'ping', sent_at: new Date().toISOString(), data: null });
    return c.json({ ok: true, status });
  } catch (e: any) {
    return c.json({ detail: `Webhook gagal: ${e?.message || e}` }, 502);
  }
});

// ═══════════════════════════════════════════════════════════════════════
//  API PUBLIK untuk dashboard klien — header "X-API-Key: gak_..."
//  (dilewatkan dari cek login di index.ts)
// ═══════════════════════════════════════════════════════════════════════
async function apiKeyOk(c: any) {
  const cfg = await getSetting(DASHBOARD_SETTING_KEY);
  const given = c.req.header('x-api-key') || (c.req.header('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!cfg?.api_key || !given) return false;
  const a = Buffer.from(given), b = Buffer.from(cfg.api_key);
  return a.length === b.length && timingSafeEqual(a, b);
}

router.get('/public/dashboard/companies', async (c) => {
  if (!(await apiKeyOk(c))) return c.json({ detail: 'API key salah atau belum dibuat' }, 401);
  const q = (c.req.query('q') || '').trim().toLowerCase();
  const phone = (c.req.query('phone') || '').trim();
  const email = (c.req.query('email') || '').trim().toLowerCase();
  const status = c.req.query('status') || 'done'; // done | all
  const since = c.req.query('since') ? new Date(c.req.query('since')) : null;

  let { jobs } = await loadJobs();
  if (status !== 'all') jobs = jobs.filter((j) => j.done);
  if (q) jobs = jobs.filter((j) => matchQuery(j, q));
  if (phone) jobs = jobs.filter((j) => matchQuery(j, phone));
  if (email) jobs = jobs.filter((j) => (j.client_email || '').toLowerCase() === email);
  if (since && !isNaN(+since)) jobs = jobs.filter((j) => j.sync?.syncedAt && new Date(j.sync.syncedAt) >= since);
  jobs.sort((a, b) => +new Date(b.completed_at || b.created_at) - +new Date(a.completed_at || a.created_at));
  return c.json({ count: jobs.length, companies: jobs.map(companyPayload) });
});

router.get('/public/dashboard/companies/:code', async (c) => {
  if (!(await apiKeyOk(c))) return c.json({ detail: 'API key salah atau belum dibuat' }, 401);
  const code = c.req.param('code').toUpperCase();
  const { jobs } = await loadJobs();
  const job = jobs.find((j) => j.code === code || j.key.toUpperCase() === code);
  if (!job) return c.json({ detail: 'Perusahaan tidak ditemukan' }, 404);
  return c.json(companyPayload(job));
});

export default router;
