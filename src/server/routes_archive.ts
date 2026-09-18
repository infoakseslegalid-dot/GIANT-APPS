// @ts-nocheck
// ─────────────────────────────────────────────────────────────────────────
// ARSIP & BACKUP  (halaman super admin, /arsip)
//  - Jenis dokumen (KTP, NPWP, Akta, SK, NIB, ...) yang ditempel ke lampiran.
//  - "Pekerjaan" = satu grup Master Card (kartu CS + semua assignment divisi),
//    atau kartu tunggal tanpa Master Card yang punya lampiran.
//  - Ringkasan penyimpanan + grafik, daftar pekerjaan & kelengkapan dokumen,
//    detail file per pekerjaan, download ZIP per pekerjaan (tercatat di log).
// ─────────────────────────────────────────────────────────────────────────
import { Hono } from 'hono';
import { PrismaClient } from '@prisma/client';
import { PassThrough, Readable } from 'stream';
import archiver from 'archiver';
import { requirePerm } from './permissions';
import { getObject } from './storage';

const prisma = new PrismaClient();
const router = new Hono();

export const DOC_GROUPS = ['KLIEN', 'HASIL', 'LAIN'];
const GROUP_FOLDERS: Record<string, string> = {
  KLIEN: '1. Dokumen Klien',
  HASIL: '2. Dokumen Hasil',
  LAIN: '3. File Lainnya',
};

// Isi awal katalog jenis dokumen — hanya ditanam kalau tabel masih kosong,
// setelah itu sepenuhnya diatur admin dari tab "Jenis Dokumen".
const DEFAULT_DOC_TYPES: [string, string, boolean][] = [
  ['KTP', 'KLIEN', true],
  ['NPWP Pribadi', 'KLIEN', true],
  ['KK', 'KLIEN', false],
  ['Akta Pendirian', 'HASIL', true],
  ['SK Kemenkumham', 'HASIL', true],
  ['NPWP Perusahaan', 'HASIL', true],
  ['NIB', 'HASIL', true],
  ['Lainnya', 'LAIN', false],
];

let _seeded = false;
async function ensureDocTypes() {
  if (_seeded) return;
  const n = await prisma.documentType.count();
  if (n === 0) {
    await prisma.documentType.createMany({
      data: DEFAULT_DOC_TYPES.map(([name, group, required], i) => ({ name, group, required, position: i })),
      skipDuplicates: true,
    });
  }
  _seeded = true;
}

const fmtType = (t: any) => ({
  id: t.id, name: t.name, group: t.group, required: t.required, position: t.position, is_active: t.isActive,
});

// ── util ────────────────────────────────────────────────────────────────
const monthKey = (d: any) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`;
};
const isDoneItem = (w: any) => w?.status === 'done' || w?.workStatus === 'COMPLETED';

/** Nama aman untuk file/folder di ZIP & Google Drive. */
function safeName(s: string, max = 90) {
  const clean = String(s || '').replace(/[\\/:*?"<>|\x00-\x1f]+/g, '-').replace(/\s+/g, ' ').trim();
  return (clean || 'tanpa-nama').slice(0, max).trim();
}
function splitExt(name: string) {
  const i = name.lastIndexOf('.');
  if (i <= 0 || i < name.length - 8) return { base: name, ext: '' };
  return { base: name.slice(0, i), ext: name.slice(i) };
}
const escHtml = (s: any) => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

/**
 * Kumpulkan semua pekerjaan beserta lampirannya.
 * key: "mc_<masterCardId>" untuk grup Master Card, "wi_<workItemId>" untuk kartu tunggal.
 * `onlyKey` membatasi ke satu pekerjaan (untuk detail/download).
 */
async function loadJobs(onlyKey?: string) {
  await ensureDocTypes();
  const types = await prisma.documentType.findMany({ orderBy: [{ position: 'asc' }, { name: 'asc' }] });
  const typeById = Object.fromEntries(types.map((t) => [t.id, t]));
  const requiredTypes = types.filter((t) => t.required && t.isActive);

  let itemWhere: any = {};
  let mcWhere: any = {};
  if (onlyKey?.startsWith('mc_')) {
    itemWhere = { masterCardId: onlyKey.slice(3) };
    mcWhere = { id: onlyKey.slice(3) };
  } else if (onlyKey?.startsWith('wi_')) {
    itemWhere = { id: onlyKey.slice(3), masterCardId: null };
    mcWhere = { id: '__none__' };
  }

  const itemSelect = {
    id: true, title: true, clientName: true, masterCardId: true, targetDivisionId: true,
    status: true, workStatus: true, completedAt: true, createdAt: true, archived: true,
    board: { select: { name: true, division: { select: { id: true, name: true, color: true } } } },
    targetDivision: { select: { id: true, name: true, color: true } },
  };

  const [masterCards, attachments] = await Promise.all([
    prisma.masterCard.findMany({
      where: mcWhere,
      select: {
        id: true, title: true, client: true, clientPhone: true, createdAt: true,
        owner: { select: { name: true } },
        assignments: { select: itemSelect },
      },
    }),
    prisma.attachment.findMany({
      where: { isDeleted: false, workItem: itemWhere },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true, workItemId: true, originalFilename: true, contentType: true, size: true, storagePath: true,
        uploadedByName: true, createdAt: true, documentTypeId: true,
        workItem: { select: itemSelect },
      },
    }),
  ]);

  const jobs: Record<string, any> = {};
  const division = (w: any) => w?.targetDivision || w?.board?.division || null;

  for (const mc of masterCards) {
    const rep = mc.assignments.find((a: any) => !a.targetDivisionId) || mc.assignments[0] || null;
    const allDone = rep ? isDoneItem(rep) : false;
    jobs[`mc_${mc.id}`] = {
      key: `mc_${mc.id}`,
      master_card_id: mc.id,
      title: mc.title || rep?.title || 'Tanpa judul',
      client: mc.client || rep?.clientName || null,
      client_phone: mc.clientPhone || null,
      owner_name: mc.owner?.name || null,
      created_at: mc.createdAt,
      done: allDone,
      completed_at: allDone ? rep?.completedAt || null : null,
      rep_item_id: rep?.id || null,
      divisions: [...new Map(mc.assignments.map((a: any) => division(a)).filter(Boolean).map((d: any) => [d.id, d])).values()],
      files: [],
      links: [],
    };
  }

  for (const a of attachments) {
    const w = a.workItem;
    const key = w.masterCardId ? `mc_${w.masterCardId}` : `wi_${w.id}`;
    if (!jobs[key]) {
      if (w.masterCardId) continue; // Master Card tak terbaca (sudah dihapus) — lewati
      jobs[key] = {
        key,
        master_card_id: null,
        title: w.title || 'Tanpa judul',
        client: w.clientName || null,
        client_phone: null,
        owner_name: null,
        created_at: w.createdAt,
        done: isDoneItem(w),
        completed_at: w.completedAt || null,
        rep_item_id: w.id,
        divisions: division(w) ? [division(w)] : [],
        files: [],
        links: [],
      };
    }
    const t = a.documentTypeId ? typeById[a.documentTypeId] : null;
    const row = {
      id: a.id,
      work_item_id: a.workItemId,
      card_title: w.title,
      division_name: division(w)?.name || w.board?.name || null,
      original_filename: a.originalFilename,
      content_type: a.contentType,
      size: a.contentType === 'link' ? 0 : a.size || 0,
      uploaded_by_name: a.uploadedByName,
      created_at: a.createdAt,
      document_type_id: t?.id || null,
      document_type_name: t?.name || null,
      document_group: t?.group || null,
      storage_path: a.storagePath,
    };
    if (a.contentType === 'link') jobs[key].links.push(row);
    else jobs[key].files.push(row);
  }

  for (const j of Object.values(jobs) as any[]) {
    j.file_count = j.files.length;
    j.total_bytes = j.files.reduce((s: number, f: any) => s + (f.size || 0), 0);
    j.last_upload_at = j.files.length ? j.files[j.files.length - 1].created_at : null;
    j.untyped_count = j.files.filter((f: any) => !f.document_type_id).length;
    const have = new Set(j.files.map((f: any) => f.document_type_id).filter(Boolean));
    j.required_total = requiredTypes.length;
    j.required_done = requiredTypes.filter((t) => have.has(t.id)).length;
    j.missing = requiredTypes.filter((t) => !have.has(t.id)).map((t) => t.name);
  }
  return { jobs: Object.values(jobs) as any[], types };
}

const publicJob = (j: any) => {
  const { files, links, ...rest } = j;
  return rest;
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

router.post('/archive/document-types', async (c) => {
  await requirePerm(c, 'archive.manage');
  const body = await c.req.json();
  const name = String(body.name || '').trim();
  if (!name) return c.json({ detail: 'Nama jenis dokumen wajib diisi' }, 400);
  const group = DOC_GROUPS.includes(body.group) ? body.group : 'LAIN';
  const exists = await prisma.documentType.findUnique({ where: { name } });
  if (exists) return c.json({ detail: `Jenis dokumen "${name}" sudah ada` }, 400);
  const max = await prisma.documentType.aggregate({ _max: { position: true } });
  const row = await prisma.documentType.create({
    data: { name, group, required: !!body.required, position: (max._max.position ?? -1) + 1 },
  });
  return c.json(fmtType(row));
});

router.patch('/archive/document-types/:id', async (c) => {
  await requirePerm(c, 'archive.manage');
  const id = c.req.param('id');
  const body = await c.req.json();
  const data: any = {};
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return c.json({ detail: 'Nama tidak boleh kosong' }, 400);
    const dup = await prisma.documentType.findFirst({ where: { name, NOT: { id } } });
    if (dup) return c.json({ detail: `Jenis dokumen "${name}" sudah ada` }, 400);
    data.name = name;
  }
  if (body.group !== undefined && DOC_GROUPS.includes(body.group)) data.group = body.group;
  if (body.required !== undefined) data.required = !!body.required;
  if (body.is_active !== undefined) data.isActive = !!body.is_active;
  if (body.position !== undefined) data.position = Number(body.position) || 0;
  const row = await prisma.documentType.update({ where: { id }, data });
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
  let beforeBytes = 0;
  for (const f of files) {
    const i = mIdx[monthKey(f.created_at)];
    if (i !== undefined) { months[i].bytes += f.size; months[i].count += 1; }
    else if (new Date(f.created_at) < new Date(months[0].month + '-01T00:00:00')) beforeBytes += f.size;
  }
  let running = beforeBytes;
  for (const m of months) { running += m.bytes; m.cumulative_bytes = running; }

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
router.get('/archive/jobs', async (c) => {
  await requirePerm(c, 'archive.view');
  const q = (c.req.query('q') || '').trim().toLowerCase();
  const month = c.req.query('month') || '';           // YYYY-MM (bulan pekerjaan dibuat)
  const status = c.req.query('status') || '';         // done | active
  const docs = c.req.query('docs') || '';             // complete | incomplete | empty
  const sort = c.req.query('sort') || 'newest';       // newest | size | name

  let { jobs } = await loadJobs();
  if (q) jobs = jobs.filter((j) => `${j.title} ${j.client || ''} ${j.client_phone || ''}`.toLowerCase().includes(q));
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
    files: job.files.map(({ storage_path, ...f }: any) => f),
    links: job.links.map(({ storage_path, ...f }: any) => ({ ...f, url: storage_path })),
    checklist: types.filter((t) => t.isActive && (t.required || have.has(t.id))).map((t) => ({
      id: t.id, name: t.name, group: t.group, required: t.required,
      count: job.files.filter((f: any) => f.document_type_id === t.id).length,
    })),
    downloads: logs.map((l) => ({ id: l.id, user_name: l.userName, file_count: l.fileCount, total_bytes: Number(l.totalBytes), created_at: l.createdAt })),
  });
});

// No. telepon klien disimpan di Master Card. Kartu tunggal dibuatkan Master Card
// dulu (pola sama dengan harga job di routes_report.ts → ensureMC).
router.patch('/archive/jobs/:key', async (c) => {
  await requirePerm(c, 'archive.manage');
  const key = c.req.param('key');
  const body = await c.req.json();
  const phone = body.client_phone == null ? null : String(body.client_phone).trim().slice(0, 40) || null;

  let mcId: string | null = key.startsWith('mc_') ? key.slice(3) : null;
  let newKey = key;
  if (!mcId && key.startsWith('wi_')) {
    const item = await prisma.workItem.findUnique({ where: { id: key.slice(3) } });
    if (!item) return c.json({ detail: 'Pekerjaan tidak ditemukan' }, 404);
    if (item.masterCardId) mcId = item.masterCardId;
    else {
      const ownerUserId = item.currentPicId || item.createdById || null;
      const owner = ownerUserId ? await prisma.user.findUnique({ where: { id: ownerUserId }, select: { divisionId: true } }) : null;
      const mc = await prisma.masterCard.create({
        data: { title: item.title, client: item.clientName || null, ownerUserId, ownerDivisionId: owner?.divisionId || null },
      });
      await prisma.workItem.update({ where: { id: item.id }, data: { masterCardId: mc.id } });
      mcId = mc.id;
    }
    newKey = `mc_${mcId}`;
  }
  if (!mcId) return c.json({ detail: 'Pekerjaan tidak ditemukan' }, 404);
  await prisma.masterCard.update({ where: { id: mcId }, data: { clientPhone: phone } });
  return c.json({ ok: true, key: newKey });
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

  const root = safeName(`${job.title}${job.client ? ` (${job.client})` : ''}`);
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
      const folder = GROUP_FOLDERS[f.document_group] || GROUP_FOLDERS.LAIN;
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

export default router;
