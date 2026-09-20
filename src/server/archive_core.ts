// @ts-nocheck
// ─────────────────────────────────────────────────────────────────────────
// Inti Arsip: katalog jenis dokumen, pengumpulan "pekerjaan" + file-nya,
// Catatan Klien, dan payload untuk dashboard klien. Dipakai routes_archive.ts
// (halaman /arsip + API dashboard) dan archive_sync.ts (Google Drive).
//
// "Pekerjaan" (job) = satu grup Master Card (kartu CS + semua assignment
// divisi) → key "mc_<id>", atau kartu tunggal tanpa Master Card yang punya
// lampiran → key "wi_<id>".
// ─────────────────────────────────────────────────────────────────────────
import { createHash } from 'crypto';
import { db as prisma, getSetting, setSetting } from './deps';

export { prisma };

export const DOC_GROUPS = ['KLIEN', 'HASIL', 'LAIN'];
export const DASHBOARD_CATEGORIES = ['Legalitas', 'Perpajakan', 'Perizinan', 'Sertifikat', 'Lainnya'];
export const MONTHS_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

// Katalog awal. Ditanam per "versi": nama yang belum ada ditambahkan sekali,
// setelah itu sepenuhnya diatur admin (rename/nonaktif tidak ditimpa lagi).
// [nama, grup, wajib, kategori dashboard, subfolder data mentah, per pihak]
// per pihak = dokumen milik ORANG (KTP, NPWP Pribadi, KK) → kalau wajib,
// dihitung sekali untuk setiap pihak/pengurus yang didaftarkan di kartu.
const DOC_TYPES_SEED_VERSION = 3;
const DEFAULT_DOC_TYPES: [string, string, boolean, string | null, string | null, boolean][] = [
  ['KTP', 'KLIEN', true, null, null, true],
  ['NPWP Pribadi', 'KLIEN', true, null, null, true],
  ['KK', 'KLIEN', false, null, null, true],
  ['Foto Dokumentasi TTD', 'KLIEN', false, null, 'Foto TTD', false],
  ['Akta Pendirian', 'HASIL', true, 'Legalitas', null, false],
  ['SK Kemenkumham', 'HASIL', true, 'Legalitas', null, false],
  ['NPWP Perusahaan', 'HASIL', true, 'Perpajakan', null, false],
  ['Suket Pajak', 'HASIL', false, 'Perpajakan', null, false],
  ['Akun Coretax', 'HASIL', false, 'Perpajakan', null, false],
  ['NIB', 'HASIL', true, 'Perizinan', null, false],
  ['Sertifikat Standar', 'HASIL', false, 'Sertifikat', null, false],
  ['Lainnya', 'LAIN', false, null, null, false],
];
const SEED_KEY = 'archive_doc_types_seed';

let _seeded = false;
export async function ensureDocTypes() {
  if (_seeded) return;
  const done = Number((await getSetting(SEED_KEY))?.version || 0);
  if (done < DOC_TYPES_SEED_VERSION) {
    const existing = await prisma.documentType.findMany();
    const byName = Object.fromEntries(existing.map((t) => [t.name.toLowerCase(), t]));
    let pos = existing.reduce((m, t) => Math.max(m, t.position), -1);
    for (const [name, group, required, category, subfolder, perParty] of DEFAULT_DOC_TYPES) {
      const cur = byName[name.toLowerCase()];
      if (!cur) {
        await prisma.documentType.create({ data: { name, group, required, dashboardCategory: category, subfolder, perParty, position: ++pos } });
        continue;
      }
      const patch: any = {};
      if (!cur.dashboardCategory && category) patch.dashboardCategory = category;
      if (!cur.subfolder && subfolder) patch.subfolder = subfolder;
      // v3: jenis bawaan yang memang milik orang ditandai sekali (admin boleh ubah lagi).
      if (done < 3 && perParty && !cur.perParty) patch.perParty = true;
      if (Object.keys(patch).length) await prisma.documentType.update({ where: { id: cur.id }, data: patch });
    }
    await setSetting(SEED_KEY, { version: DOC_TYPES_SEED_VERSION });
  }
  _seeded = true;
}

export const fmtType = (t: any) => ({
  id: t.id, name: t.name, group: t.group, required: t.required, position: t.position, is_active: t.isActive,
  dashboard_category: t.dashboardCategory || null, subfolder: t.subfolder || null,
  per_party: !!t.perParty,
});

export const fmtParty = (p: any) => ({ id: p.id, name: p.name, role: p.role, position: p.position });
/** "Budi (Direktur)" — dipakai di label UI, nama file Drive & Catatan Klien. */
export const partyLabel = (p: any) => (p ? `${p.name}${p.role ? ` (${p.role})` : ''}` : null);

export const PARTY_ROLES = ['Direktur', 'Komisaris', 'Pemegang Saham', 'Pengurus', 'Pemohon', 'Lainnya'];

/**
 * Daftar slot dokumen wajib sebuah pekerjaan.
 *  - jenis wajib biasa  → 1 slot (party null)
 *  - jenis wajib "per pihak" → 1 slot untuk SETIAP pihak yang terdaftar
 * Kalau belum ada pihak sama sekali, jenis per-pihak tetap dihitung 1 slot
 * tanpa pemilik supaya kelengkapan tidak diam-diam jadi 100%.
 */
export function requiredSlots(requiredTypes: any[], parties: any[]) {
  const slots: any[] = [];
  for (const t of requiredTypes) {
    if (!t.perParty) {
      slots.push({ key: t.id, type_id: t.id, type_name: t.name, group: t.group, party_id: null, party_name: null, party_role: null });
      continue;
    }
    if (!parties.length) {
      slots.push({ key: `${t.id}|?`, type_id: t.id, type_name: t.name, group: t.group, party_id: null, party_name: null, party_role: null });
      continue;
    }
    for (const p of parties) {
      slots.push({ key: `${t.id}|${p.id}`, type_id: t.id, type_name: t.name, group: t.group, party_id: p.id, party_name: p.name, party_role: p.role });
    }
  }
  return slots;
}
/** Label slot untuk pesan "kurang: ..." — "KTP — Budi (Direktur)". */
export const slotLabel = (s: any) => (s.party_name ? `${s.type_name} — ${partyLabel(s)}` : s.type_name);

// ── util ────────────────────────────────────────────────────────────────
export const monthKey = (d: any) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`;
};
/** "2026-02" → ["2026", "02 - Februari"] */
export const monthFolderParts = (ym: string) => {
  const [y, m] = ym.split('-');
  return [y, `${m} - ${MONTHS_ID[Number(m) - 1]}`];
};
export const isDoneItem = (w: any) => w?.status === 'done' || w?.workStatus === 'COMPLETED';
export const sha1 = (s: string) => createHash('sha1').update(s).digest('hex');

/** Nama aman untuk file/folder di ZIP & Google Drive. */
export function safeName(s: string, max = 90) {
  const clean = String(s || '').replace(/[\\/:*?"<>|\x00-\x1f]+/g, '-').replace(/\s+/g, ' ').trim();
  return (clean || 'tanpa-nama').slice(0, max).trim();
}
export function splitExt(name: string) {
  const i = name.lastIndexOf('.');
  if (i <= 0 || i < name.length - 8) return { base: name, ext: '' };
  return { base: name.slice(0, i), ext: name.slice(i) };
}
export const escHtml = (s: any) => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

/** Kode pendek pekerjaan, mis. "AL-9CC77D" — dipakai di nama folder Drive & API dashboard. */
export const jobCode = (key: string) => 'AL-' + key.slice(3, 9).toUpperCase();
export const jobKeyForItem = (item: any) => (item.masterCardId ? `mc_${item.masterCardId}` : `wi_${item.id}`);
/** Nama perusahaan untuk tampilan: isian "Nama perusahaan" → klien → judul kartu. */
export const companyOf = (job: any) => job.company_name || job.client || job.title;

export const CLIENT_FIELDS: Record<string, string> = {
  company_name: 'companyName',
  service_type: 'serviceType',
  client: 'client',
  client_phone: 'clientPhone',
  client_email: 'clientEmail',
  client_address: 'clientAddress',
  client_notes: 'clientNotes',
  akta_number: 'aktaNumber',
  nib_number: 'nibNumber',
  established_date: 'establishedDate',
};
export function clientDataOf(mc: any) {
  const out: any = {};
  for (const [k, col] of Object.entries(CLIENT_FIELDS)) out[k] = mc?.[col] ?? null;
  return out;
}
/** Ambil field data klien yang dikirim (hanya yang ada di body), dipangkas. */
export function clientDataPatch(body: any) {
  const data: any = {};
  for (const [k, col] of Object.entries(CLIENT_FIELDS)) {
    if (body[k] === undefined) continue;
    const v = body[k] == null ? null : String(body[k]).trim();
    data[col] = v ? v.slice(0, k === 'client_notes' ? 5000 : 200) : null;
  }
  if (data.establishedDate && !/^\d{4}-\d{2}-\d{2}$/.test(data.establishedDate)) delete data.establishedDate;
  return data;
}

/**
 * Pastikan kartu punya Master Card (tempat data klien disimpan). Kartu tunggal
 * dibuatkan Master Card — pola sama dengan harga job (routes_report.ts → ensureMC).
 */
export async function ensureMasterCardFor(item: any) {
  if (item.masterCardId) return prisma.masterCard.findUnique({ where: { id: item.masterCardId } });
  const ownerUserId = item.currentPicId || item.createdById || null;
  const owner = ownerUserId ? await prisma.user.findUnique({ where: { id: ownerUserId }, select: { divisionId: true } }) : null;
  const mc = await prisma.masterCard.create({
    data: { title: item.title, client: item.clientName || null, ownerUserId, ownerDivisionId: owner?.divisionId || null },
  });
  await prisma.workItem.update({ where: { id: item.id }, data: { masterCardId: mc.id } });
  // status sinkron Drive yang sudah ada ikut pindah ke key baru (folder tidak dobel)
  await prisma.archiveJobSync.updateMany({ where: { jobKey: `wi_${item.id}` }, data: { jobKey: `mc_${mc.id}`, dirty: true } });
  return mc;
}

// ═══════════════════════════════════════════════════════════════════════
//  Kumpulkan pekerjaan + file
// ═══════════════════════════════════════════════════════════════════════
/** `onlyKey` membatasi ke satu pekerjaan (detail/download/sinkron). */
export async function loadJobs(onlyKey?: string) {
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
    status: true, workStatus: true, completedAt: true, createdAt: true, updatedAt: true, archived: true,
    board: { select: { name: true, division: { select: { id: true, name: true, color: true } } } },
    targetDivision: { select: { id: true, name: true, color: true } },
  };

  const [masterCards, attachments, syncRows] = await Promise.all([
    prisma.masterCard.findMany({
      where: mcWhere,
      include: {
        owner: { select: { name: true } },
        assignments: { select: itemSelect },
        parties: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] },
      },
    }),
    prisma.attachment.findMany({
      where: { isDeleted: false, workItem: itemWhere },
      orderBy: { createdAt: 'asc' },
      include: { workItem: { select: itemSelect }, party: true },
    }),
    onlyKey
      ? prisma.archiveJobSync.findMany({ where: { jobKey: onlyKey } })
      : prisma.archiveJobSync.findMany(),
  ]);
  const syncByKey = Object.fromEntries(syncRows.map((r) => [r.jobKey, r]));

  const jobs: Record<string, any> = {};
  const division = (w: any) => w?.targetDivision || w?.board?.division || null;
  const base = (key: string, extra: any) => ({
    key,
    code: jobCode(key),
    files: [],
    links: [],
    sync: syncByKey[key] || null,
    ...extra,
  });

  for (const mc of masterCards) {
    const rep = mc.assignments.find((a: any) => !a.targetDivisionId) || mc.assignments[0] || null;
    const done = rep ? isDoneItem(rep) : false;
    jobs[`mc_${mc.id}`] = base(`mc_${mc.id}`, {
      master_card_id: mc.id,
      title: mc.title || rep?.title || 'Tanpa judul',
      ...clientDataOf(mc),
      client: mc.client || rep?.clientName || null,
      owner_name: mc.owner?.name || null,
      created_at: mc.createdAt,
      done,
      completed_at: done ? rep?.completedAt || rep?.updatedAt || null : null,
      rep_item_id: rep?.id || null,
      item_ids: mc.assignments.map((a: any) => a.id),
      parties: mc.parties.map(fmtParty),
      divisions: [...new Map(mc.assignments.map((a: any) => division(a)).filter(Boolean).map((d: any) => [d.id, d])).values()],
    });
  }

  for (const a of attachments) {
    const w = a.workItem;
    const key = jobKeyForItem(w);
    if (!jobs[key]) {
      if (w.masterCardId) continue; // Master Card sudah dihapus — lewati
      const done = isDoneItem(w);
      jobs[key] = base(key, {
        master_card_id: null,
        title: w.title || 'Tanpa judul',
        ...clientDataOf(null),
        client: w.clientName || null,
        owner_name: null,
        created_at: w.createdAt,
        done,
        completed_at: done ? w.completedAt || w.updatedAt : null,
        rep_item_id: w.id,
        item_ids: [w.id],
        parties: [],
        divisions: division(w) ? [division(w)] : [],
      });
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
      per_party: !!t?.perParty,
      party_id: a.partyId || null,
      party_name: a.party?.name || null,
      party_role: a.party?.role || null,
      party_label: partyLabel(a.party),
      dashboard_category: t?.dashboardCategory || null,
      subfolder: t?.subfolder || null,
      storage_path: a.storagePath,
      drive_file_id: a.driveFileId || null,
      drive_url: a.driveUrl || null,
      drive_name: a.driveName || null,
      drive_side: a.driveSide || null,
      drive_synced_at: a.driveSyncedAt || null,
      drive_error: a.driveError || null,
    };
    if (a.contentType === 'link') jobs[key].links.push(row);
    else jobs[key].files.push(row);
  }

  for (const j of Object.values(jobs) as any[]) {
    j.file_count = j.files.length;
    j.total_bytes = j.files.reduce((s: number, f: any) => s + (f.size || 0), 0);
    j.last_upload_at = j.files.length ? j.files[j.files.length - 1].created_at : null;
    j.untyped_count = j.files.filter((f: any) => !f.document_type_id).length;
    // File "per pihak" yang jenisnya sudah ditandai tapi pemiliknya belum.
    j.unassigned_party_count = j.files.filter((f: any) => f.document_type_id && f.per_party && !f.party_id).length;

    // Kelengkapan: satu slot per jenis wajib, dikali jumlah pihak untuk jenis
    // "per pihak" (2 pengurus → slot KTP Budi & KTP Sari terpisah).
    const have = new Set(
      j.files
        .filter((f: any) => f.document_type_id)
        .map((f: any) => (f.per_party && f.party_id ? `${f.document_type_id}|${f.party_id}` : f.document_type_id)),
    );
    const slots = requiredSlots(requiredTypes, j.parties || []);
    for (const sl of slots) sl.done = have.has(sl.party_id ? `${sl.type_id}|${sl.party_id}` : sl.type_id);
    j.required_slots = slots;
    j.required_total = slots.length;
    j.required_done = slots.filter((sl: any) => sl.done).length;
    j.missing = slots.filter((sl: any) => !sl.done).map(slotLabel);
    j.drive_pending = j.files.filter((f: any) => !f.drive_file_id).length;
    j.drive_errors = j.files.filter((f: any) => f.drive_error).length;
  }
  return { jobs: Object.values(jobs) as any[], types };
}

/**
 * Kelengkapan dokumen satu pekerjaan, versi ringan untuk kartu (tanpa memuat
 * seluruh Arsip). Cakupannya sama dengan /arsip: semua lampiran satu grup
 * Master Card, bukan cuma kartu yang sedang dibuka.
 */
export async function jobDocStatus(item: any) {
  await ensureDocTypes();
  const workItem = item.masterCardId ? { masterCardId: item.masterCardId } : { id: item.id };
  const [types, partyRows, atts] = await Promise.all([
    prisma.documentType.findMany({ where: { isActive: true }, orderBy: [{ position: 'asc' }, { name: 'asc' }] }),
    item.masterCardId
      ? prisma.cardParty.findMany({ where: { masterCardId: item.masterCardId }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] })
      : Promise.resolve([]),
    prisma.attachment.findMany({
      where: { isDeleted: false, NOT: { contentType: 'link' }, workItem },
      select: { documentTypeId: true, partyId: true },
    }),
  ]);
  const typeById = Object.fromEntries(types.map((t: any) => [t.id, t]));
  const have = new Set(
    atts
      .filter((a: any) => a.documentTypeId)
      .map((a: any) =>
        typeById[a.documentTypeId]?.perParty && a.partyId ? `${a.documentTypeId}|${a.partyId}` : a.documentTypeId,
      ),
  );
  const slots = requiredSlots(types.filter((t: any) => t.required), partyRows);
  for (const sl of slots) sl.done = have.has(sl.party_id ? `${sl.type_id}|${sl.party_id}` : sl.type_id);
  return {
    parties: partyRows.map(fmtParty),
    slots,
    required_total: slots.length,
    required_done: slots.filter((sl: any) => sl.done).length,
    missing: slots.filter((sl: any) => !sl.done).map(slotLabel),
    untyped_count: atts.filter((a: any) => !a.documentTypeId).length,
    unassigned_party_count: atts.filter((a: any) => a.documentTypeId && typeById[a.documentTypeId]?.perParty && !a.partyId).length,
  };
}

/**
 * Versi massal jobDocStatus untuk satu board: cukup 3 query, hasilnya dipetakan
 * per work item (kartu segrup Master Card berbagi angka yang sama).
 */
export async function docBadgesFor(items: any[]) {
  if (!items.length) return {};
  await ensureDocTypes();
  const mcIds = [...new Set(items.map((i: any) => i.masterCardId).filter(Boolean))] as string[];
  const wiIds = items.filter((i: any) => !i.masterCardId).map((i: any) => i.id) as string[];

  const [types, partyRows, atts] = await Promise.all([
    prisma.documentType.findMany({ where: { isActive: true }, orderBy: [{ position: 'asc' }, { name: 'asc' }] }),
    mcIds.length
      ? prisma.cardParty.findMany({ where: { masterCardId: { in: mcIds } }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] })
      : Promise.resolve([]),
    prisma.attachment.findMany({
      where: {
        isDeleted: false,
        NOT: { contentType: 'link' },
        OR: [
          ...(mcIds.length ? [{ workItem: { masterCardId: { in: mcIds } } }] : []),
          ...(wiIds.length ? [{ workItemId: { in: wiIds } }] : []),
        ],
      },
      select: { documentTypeId: true, partyId: true, workItem: { select: { id: true, masterCardId: true } } },
    }),
  ]);
  if (!types.some((t: any) => t.required)) return {};

  const typeById = Object.fromEntries(types.map((t: any) => [t.id, t]));
  const requiredTypes = types.filter((t: any) => t.required);
  const partiesByMc: Record<string, any[]> = {};
  for (const p of partyRows) (partiesByMc[p.masterCardId] ||= []).push(p);

  const attsByKey: Record<string, any[]> = {};
  for (const a of atts) (attsByKey[jobKeyForItem(a.workItem)] ||= []).push(a);

  const byKey: Record<string, any> = {};
  const out: Record<string, any> = {};
  for (const item of items) {
    const key = jobKeyForItem(item);
    if (!byKey[key]) {
      const mine = attsByKey[key] || [];
      const have = new Set(
        mine
          .filter((a: any) => a.documentTypeId)
          .map((a: any) => (typeById[a.documentTypeId]?.perParty && a.partyId ? `${a.documentTypeId}|${a.partyId}` : a.documentTypeId)),
      );
      const slots = requiredSlots(requiredTypes, item.masterCardId ? partiesByMc[item.masterCardId] || [] : []);
      const done = slots.filter((sl: any) => have.has(sl.party_id ? `${sl.type_id}|${sl.party_id}` : sl.type_id)).length;
      byKey[key] = {
        total: slots.length,
        done,
        untyped: mine.filter((a: any) => !a.documentTypeId).length,
        unassigned: mine.filter((a: any) => a.documentTypeId && typeById[a.documentTypeId]?.perParty && !a.partyId).length,
      };
    }
    out[item.id] = byKey[key];
  }
  return out;
}

export const publicJob = (j: any) => {
  const { files, links, sync, item_ids, ...rest } = j;
  return {
    ...rest,
    drive: sync ? {
      month: sync.month, synced_at: sync.syncedAt, error: sync.error, dirty: sync.dirty,
      raw_folder_id: sync.rawFolderId, out_folder_id: sync.outFolderId,
      pushed_at: sync.pushedAt, push_error: sync.pushError,
    } : null,
  };
};

// ═══════════════════════════════════════════════════════════════════════
//  Catatan Klien (HTML → Google Docs di folder data mentah, & di ZIP)
// ═══════════════════════════════════════════════════════════════════════
export function clientNotesHtml(job: any) {
  const row = (label: string, v: any) => `<tr><th style="text-align:left;padding:4px 12px 4px 0;vertical-align:top">${escHtml(label)}</th><td style="padding:4px 0">${escHtml(v || '—').replace(/\n/g, '<br>')}</td></tr>`;
  const files = job.files.map((f: any) => {
    const who = f.party_label ? ` <i>(${escHtml(f.party_label)})</i>` : '';
    return `<li>${escHtml(f.document_type_name || 'Belum ditandai')}${who} — ${escHtml(f.original_filename)}</li>`;
  }).join('');
  const parties = (job.parties || []).map((p: any) => `<li>${escHtml(p.name)} — ${escHtml(p.role)}</li>`).join('');
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Catatan Klien</title></head><body style="font-family:Arial,sans-serif">
<h1>Catatan Klien — ${escHtml(companyOf(job))}</h1>
<table>
${row('Kode pekerjaan', job.code)}
${row('Pekerjaan', job.title)}
${row('Nama perusahaan', job.company_name)}
${row('Jenis layanan', job.service_type)}
${row('Nama klien', job.client)}
${row('No. telepon / WA', job.client_phone)}
${row('Email', job.client_email)}
${row('Alamat', job.client_address)}
${row('No. akta', job.akta_number)}
${row('NIB', job.nib_number)}
${row('Tanggal pendirian', job.established_date)}
${row('Owner (CS)', job.owner_name)}
${row('Divisi terlibat', job.divisions.map((d: any) => d.name).join(', '))}
${row('Status', job.done ? 'Selesai' : 'Masih berjalan')}
</table>
<h2>Pengurus / Pihak (${(job.parties || []).length})</h2>
<ul>${parties || '<li>—</li>'}</ul>
<h2>Catatan</h2>
<p>${escHtml(job.client_notes || '—').replace(/\n/g, '<br>')}</p>
<h2>Daftar dokumen (${job.files.length})</h2>
<ul>${files || '<li>—</li>'}</ul>
<p style="color:#666;font-size:11px">Dibuat otomatis oleh GIANT-APPS. Perubahan di aplikasi akan memperbarui dokumen ini.</p>
</body></html>`;
}

// ═══════════════════════════════════════════════════════════════════════
//  Payload untuk dashboard klien (akseslegal.id/dashboard)
// ═══════════════════════════════════════════════════════════════════════
export function companyPayload(job: any) {
  const company = companyOf(job);
  const outFiles = job.files.filter((f: any) => f.document_group === 'HASIL');
  return {
    code: job.code,
    job_key: job.key,
    company_name: company,
    service_type: job.service_type || null,
    status: job.done ? 'SELESAI' : 'PROSES',
    akta_number: job.akta_number || null,
    nib_number: job.nib_number || null,
    established_date: job.established_date || null,
    finished_at: job.completed_at || null,
    client: { name: job.client || null, phone: job.client_phone || null, email: job.client_email || null },
    drive_folder_url: job.sync?.outFolderId ? `https://drive.google.com/drive/folders/${job.sync.outFolderId}` : null,
    documents_total: outFiles.length,
    documents_ready: outFiles.filter((f: any) => f.drive_url).length,
    documents: outFiles.filter((f: any) => f.drive_url).map((f: any) => ({
      id: f.id,
      name: `${f.document_type_name} ${company}`.toUpperCase(),
      type: f.document_type_name,
      category: f.dashboard_category || 'Lainnya',
      status: 'VALID',
      number: /akta/i.test(f.document_type_name || '') ? job.akta_number || null
        : /^nib/i.test(f.document_type_name || '') ? job.nib_number || null : null,
      date: f.created_at,
      url: f.drive_url,
      drive_file_id: f.drive_file_id,
    })),
  };
}
