// @ts-nocheck
import { formatWorkItem, canViewBoard, canEditBoard, runAutomation as realRunAutomation, broadcastItem as depsBroadcastItem, wsManager, autoSpawnAssignment } from './deps';
import {  Hono } from 'hono';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { putObject, getObject } from './storage';
import { requirePerm } from './permissions';

const prisma = new PrismaClient();
const router = new Hono();

// Helper placeholders
const nowIso = () => new Date().toISOString();
const newId = () => uuidv4();
const ADMIN_ROLES = ['super_admin', 'admin'];
const SUPERVISOR_ROLES = ['super_admin', 'admin', 'supervisor'];
const HARI_DIVISION_KEYS = ['draf', 'pajak', 'perizinan', 'desain'];
const PRIORITIES = ['none', 'low', 'medium', 'high', 'urgent'];
const STAGE_GATES: Record<number, string[]> = { 4: ['AKTA', 'SK'], 6: ['NPWP', 'AKUN CORETAX', 'SUKET'], 8: ['NIB'] };

async function logActivity(workItemId: string | null, boardId: string | null, user: any, action: string) {
  await prisma.activity.create({
    data: { id: newId(), workItemId: workItemId || '', boardId, userId: user.id, userName: user.name, action }
  });
}
async function notify(userIds: string[], type: string, title: string, body: string, workItemId: string | null, boardId: string | null, exclude: Set<string> = new Set()) {
  const targets = userIds.filter(id => !exclude.has(id));
  if (targets.length === 0) return;
  await prisma.notification.createMany({
    data: targets.map(id => ({ id: newId(), userId: id, type, title, body, workItemId, boardId }))
  });
}
// Broadcast realtime ke semua klien. Selain board & mirror-board item ini,
// ikut sebarkan ke seluruh sibling satu Master Card supaya feed grup (komentar,
// lampiran, aktivitas) langsung sinkron di kartu Master & semua assignment.
async function broadcastItem(item: any) {
  try {
    if (!item) return;
    await depsBroadcastItem(item);
    const mcId = item.masterCardId || item.master_card_id;
    if (mcId) {
      const sibs = await prisma.workItem.findMany({
        where: { masterCardId: mcId },
        select: { id: true, boardId: true },
      });
      for (const s of sibs) {
        if (s.id === item.id) continue;
        await wsManager.broadcast({ type: 'board_update', board_id: s.boardId, work_item_id: s.id });
      }
    }
  } catch (e) {
    console.error('[broadcastItem]', e);
  }
}
// runAutomation asli di-import dari ./deps (realRunAutomation) — jalankan aman, jgn ganggu response.
async function runAutomation(boardId: string, event: string, item: any, user: any, listId?: string) {
  try {
    const full = await prisma.workItem.findUnique({ where: { id: item.id }, include: { masterCard: true } });
    await realRunAutomation(boardId, event, full || item, user, listId ?? null);
  } catch (e) {
    console.error('[automation]', event, e);
  }
}

// canViewBoard di-import dari ./deps — admin, atau member board, atau se-divisi.
// Board yang dilempar ke sini WAJIB di-include { members: true }.
function requireSupervisor(user: any) { if (!SUPERVISOR_ROLES.includes(user.role)) throw new Error('Forbidden'); }

/**
 * Saat card pindah board, label lama (milik board asal) tidak berlaku di board tujuan.
 * Cocokkan berdasarkan NAMA label (case-insensitive) → remap ke label board tujuan;
 * label yang tak punya padanan di-drop dan namanya dikembalikan supaya FE bisa
 * meminta user assign ulang.
 */
async function remapLabelsForBoard(item: any, targetBoardId: string) {
  const oldLabelIds: string[] = (item.labels || []).map((l: any) => l.labelId);
  if (!oldLabelIds.length) return { labelUpdate: undefined as any, droppedLabels: [] as string[], remappedCount: 0 };
  const [oldLabels, targetLabels] = await Promise.all([
    prisma.label.findMany({ where: { id: { in: oldLabelIds } } }),
    prisma.label.findMany({ where: { boardId: targetBoardId } }),
  ]);
  const byName = new Map(targetLabels.map((l: any) => [(l.name || '').trim().toLowerCase(), l.id]));
  const keep: string[] = [];
  const droppedLabels: string[] = [];
  for (const ol of oldLabels) {
    const match = byName.get((ol.name || '').trim().toLowerCase());
    if (match) keep.push(match);
    else droppedLabels.push(ol.name);
  }
  return {
    labelUpdate: { deleteMany: {}, create: keep.map((labelId) => ({ labelId })) },
    droppedLabels,
    remappedCount: keep.length,
  };
}

async function getWorkItem(id: string) {
  const item = await prisma.workItem.findUnique({ where: { id }, include: { members: true, divisionIds: true, labels: true, mirrorBoards: true, currentPic: true, sourceUser: true, masterCard: { include: { owner: true } } } });
  if (!item) throw new Error('Not found');
  return item;
}

// ── Label: single source of truth di Master Card ─────────────────────────
// sharedLabels = [{name,color}] kanonik. Setiap WorkItem di grup (rep + semua
// assignment) di-mirror ke daftar ini: untuk tiap board dibuat/dicocokkan row
// Label by-name, lalu WorkItemLabel item disetel persis. Jadi tampilan lama
// (item.label_ids + board_labels) langsung ikut tanpa ubah frontend.
type SharedLabel = { name: string; color: string };

function normLabelList(v: any): SharedLabel[] {
  const arr = Array.isArray(v) ? v : [];
  const seen = new Set<string>();
  const out: SharedLabel[] = [];
  for (const x of arr) {
    const name = String(x?.name ?? '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, color: String(x?.color ?? '#8590A2') });
  }
  return out;
}

async function labelIdsToShared(labelIds: string[]): Promise<SharedLabel[]> {
  if (!labelIds?.length) return [];
  const rows = await prisma.label.findMany({ where: { id: { in: labelIds } } });
  return normLabelList(rows.map((r: any) => ({ name: r.name, color: r.color || '#8590A2' })));
}

/** Terapkan daftar label kanonik ke SEMUA WorkItem satu grup Master Card. */
export async function syncGroupLabels(masterCardId: string, shared: SharedLabel[], actor: any) {
  const canon = normLabelList(shared);
  await prisma.masterCard.update({ where: { id: masterCardId }, data: { sharedLabels: canon } });

  const groupItems = await prisma.workItem.findMany({ where: { masterCardId }, select: { id: true, boardId: true } });
  const boardLabelCache = new Map<string, any[]>();

  for (const gi of groupItems) {
    let boardLabels = boardLabelCache.get(gi.boardId);
    if (!boardLabels) {
      boardLabels = await prisma.label.findMany({ where: { boardId: gi.boardId } });
      boardLabelCache.set(gi.boardId, boardLabels);
    }
    const wantIds: string[] = [];
    for (const sl of canon) {
      let row = boardLabels.find((l: any) => (l.name || '').trim().toLowerCase() === sl.name.toLowerCase());
      if (!row) {
        row = await prisma.label.create({ data: { boardId: gi.boardId, name: sl.name, color: sl.color } });
        boardLabels.push(row);
      } else if ((row.color || '') !== sl.color) {
        row = await prisma.label.update({ where: { id: row.id }, data: { color: sl.color } });
        const i = boardLabels.findIndex((l: any) => l.id === row.id);
        if (i >= 0) boardLabels[i] = row;
      }
      wantIds.push(row.id);
    }
    await prisma.workItem.update({
      where: { id: gi.id },
      data: { labels: { deleteMany: {}, create: wantIds.map((labelId) => ({ labelId })) }, updatedAt: new Date() },
    });
  }
  for (const gi of groupItems) {
    try { await broadcastItem(await getWorkItem(gi.id)); } catch (e) { /* ignore */ }
  }
}

/**
 * Aturan otomasi GLOBAL yang admin buat sendiri dari Admin Panel → Otomasi
 * ("kejadian → aksi", lintas board) — beda dari runAutomation() bawaan yang
 * per-board. Dipanggil dari titik-titik kejadian level Master Card/job: kartu
 * dibuat, harga diisi, status pembayaran berubah.
 */
export async function runGlobalAutomation(
  trigger: 'card_created' | 'price_set' | 'payment_status_changed',
  ctx: { item: any; masterCardId?: string | null; status?: string; actor: any },
) {
  const rules = await prisma.globalAutomationRule.findMany({ where: { trigger, enabled: true } });
  if (!rules.length) return;

  for (const rule of rules) {
    if (trigger === 'payment_status_changed' && rule.conditionValue && rule.conditionValue !== ctx.status) continue;
    try {
      let desc = '';
      if (rule.action === 'add_label') {
        let parsed: { name?: string; color?: string } = {};
        try { parsed = JSON.parse(rule.actionValue || '{}'); } catch { parsed = {}; }
        const name = (parsed.name || '').trim();
        if (!name) continue;
        const color = parsed.color || '#8590A2';
        if (ctx.masterCardId) {
          const mc = await prisma.masterCard.findUnique({ where: { id: ctx.masterCardId } });
          let shared: any[] = [];
          try { shared = Array.isArray((mc as any)?.sharedLabels) ? (mc as any).sharedLabels : JSON.parse((mc as any)?.sharedLabels || '[]'); } catch { shared = []; }
          if (!shared.some((l: any) => (l?.name || '').trim().toLowerCase() === name.toLowerCase())) {
            await syncGroupLabels(ctx.masterCardId, [...shared, { name, color }], ctx.actor);
          }
        } else {
          let row = await prisma.label.findFirst({ where: { boardId: ctx.item.boardId, name: { equals: name, mode: 'insensitive' } } });
          if (!row) row = await prisma.label.create({ data: { boardId: ctx.item.boardId, name, color } });
          await prisma.workItemLabel.upsert({
            where: { workItemId_labelId: { workItemId: ctx.item.id, labelId: row.id } },
            create: { workItemId: ctx.item.id, labelId: row.id },
            update: {},
          });
        }
        desc = `pasang label "${name}"`;
      } else if (rule.action === 'set_priority') {
        if (!rule.actionValue) continue;
        await prisma.workItem.update({ where: { id: ctx.item.id }, data: { priority: rule.actionValue, updatedAt: new Date() } });
        desc = `ubah prioritas jadi "${rule.actionValue}"`;
      } else if (rule.action === 'send_to_division') {
        if (!rule.actionValue) continue;
        await autoSpawnAssignment(ctx.item, rule.actionValue, { actor: ctx.actor });
        desc = `kirim ke divisi "${rule.actionValue}"`;
      } else {
        continue;
      }
      await logActivity(ctx.item.id, ctx.item.boardId, ctx.actor, `Otomasi: ${desc}`);
    } catch (e) {
      console.error('[global-automation]', rule.id, e);
    }
  }
}

async function getItemChecked(id: string, user: any) {
  const item = await getWorkItem(id);
  // check board access
  return item;
}

// ── STATUS PEKERJAAN — satu sumber tampilan ──────────────────────────────
// Menyatukan status kartu (active/submitted/done), workStatus, dan posisi list
// jadi SATU label jelas untuk user (banyak user usia lanjut → wajib gamblang).
function isDoneListName(name: string | null | undefined) {
  const n = (name || '').toUpperCase();
  return /(^|\b)(FINISH|DONE|SELESAI)(\b|$)/.test(n) || n.startsWith('SKOR 6');
}

/** { code, label, tone } — dipakai badge di UI. */
function displayStatus(item: any) {
  const isAssignment = !!item.targetDivisionId;
  if (item.archived) return { code: 'ARCHIVED', label: 'Diarsipkan', tone: 'gray' };
  if (item.status === 'done' || item.workStatus === 'COMPLETED') return { code: 'DONE', label: 'Selesai', tone: 'green' };
  if (item.status === 'submitted') return { code: 'REVIEW', label: 'Menunggu persetujuan', tone: 'amber' };
  if (isAssignment && item.distributionStatus === 'AVAILABLE') return { code: 'WAITING_CLAIM', label: 'Menunggu diambil', tone: 'slate' };
  if (isAssignment && item.distributionStatus === 'RELEASED') return { code: 'RELEASED', label: 'Dilepas', tone: 'slate' };
  if (item.workStatus === 'REVISION') return { code: 'REVISION', label: 'Perlu revisi', tone: 'amber' };
  return { code: 'IN_PROGRESS', label: 'Sedang dikerjakan', tone: 'blue' };
}

/**
 * Status Master Card = TURUNAN dari assignment-nya, bukan diset manual.
 * "Selesai" hanya jika SEMUA assignment selesai; kalau ada yang dibuka lagi,
 * Master ikut dibuka lagi. Idempotent — aman dipanggil berkali-kali.
 * Mengembalikan { changed, allDone, done, total }.
 */
async function recomputeMasterStatus(masterCardId: string, actor: any) {
  if (!masterCardId) return { changed: false, allDone: false, done: 0, total: 0 };
  const rows = await prisma.workItem.findMany({ where: { masterCardId } });
  const rep = rows.find((r: any) => !r.targetDivisionId);
  const assigns = rows.filter((r: any) => r.targetDivisionId);
  if (!rep || assigns.length === 0) return { changed: false, allDone: false, done: 0, total: assigns.length };

  const done = assigns.filter((a: any) => a.status === 'done').length;
  const allDone = done === assigns.length;
  // Rep dianggap "selesai" bila SALAH SATU penanda menunjukkan selesai — supaya
  // data yang keburu tidak sinkron (status vs workStatus) ikut dirapikan.
  const repDone = rep.status === 'done' || rep.workStatus === 'COMPLETED';
  let changed = false;

  if (allDone && !repDone) {
    await prisma.workItem.update({ where: { id: rep.id }, data: { status: 'done', workStatus: 'COMPLETED', completedAt: new Date(), updatedAt: new Date() } });
    await logActivity(rep.id, rep.boardId, actor, `pekerjaan "${rep.title}" selesai — semua divisi telah menyelesaikan bagiannya`);
    changed = true;
  } else if (!allDone && repDone) {
    await prisma.workItem.update({ where: { id: rep.id }, data: { status: 'active', workStatus: 'IN_PROGRESS', completedAt: null, updatedAt: new Date() } });
    await logActivity(rep.id, rep.boardId, actor, `pekerjaan "${rep.title}" dibuka kembali — masih ada divisi yang belum selesai`);
    changed = true;
  } else if (allDone && repDone && (rep.status !== 'done' || rep.workStatus !== 'COMPLETED')) {
    // rapikan penanda yang belum konsisten walau kesimpulannya sama
    await prisma.workItem.update({ where: { id: rep.id }, data: { status: 'done', workStatus: 'COMPLETED', updatedAt: new Date() } });
    changed = true;
  }
  if (changed) await broadcastItem(await getWorkItem(rep.id));
  return { changed, allDone, done, total: assigns.length };
}

function doneChecklistTexts(item: any) {
  const done: string[] = [];
  let checklists = item.checklists; if (typeof checklists === 'string') checklists = JSON.parse(checklists); checklists = Array.isArray(checklists) ? checklists : [];
  for (const cl of checklists) {
    for (const it of cl.items || []) {
      if (it.done) done.push((it.text || '').toLowerCase());
    }
  }
  return done;
}
/** entryRequirements bisa tersimpan sebagai array ATAU string JSON — normalkan. */
function asReqArray(v: any): string[] {
  if (Array.isArray(v)) return v.filter((x) => typeof x === 'string');
  if (typeof v === 'string') {
    try { const p = JSON.parse(v); return Array.isArray(p) ? p.filter((x) => typeof x === 'string') : []; }
    catch { return v.trim() ? [v] : []; }
  }
  return [];
}
function unmetRequirements(item: any, required: any) {
  const done = doneChecklistTexts(item);
  return asReqArray(required).filter((req) => {
    const r = req.trim().toLowerCase();
    return r && !done.some((t) => t.includes(r));
  });
}
async function ensureRequirementChecklist(item: any, lst: any) {
  const reqs = asReqArray(lst.entryRequirements);
  if (!reqs.length) return;
  let checklists = item.checklists; if (typeof checklists === 'string') checklists = JSON.parse(checklists); checklists = Array.isArray(checklists) ? checklists : [];
  const title = `Syarat ${lst.name}`;
  let target = checklists.find((c: any) => c.title === title);
  let changed = false;
  if (!target) {
    target = { id: newId(), title, items: [] };
    checklists.push(target);
    changed = true;
  }
  const existing = new Set((target.items || []).map((i: any) => i.text.trim().toLowerCase()));
  for (const req of reqs) {
    if (!existing.has(req.trim().toLowerCase())) {
      target.items.push({ id: newId(), text: req, done: false });
      changed = true;
    }
  }
  if (changed) {
    await prisma.workItem.update({ where: { id: item.id }, data: { checklists } });
    item.checklists = checklists;
  }
}
async function userDivision(user: any) {
  if (!user.divisionId) return null;
  return prisma.division.findUnique({ where: { id: user.divisionId } });
}
async function canAccessHari(user: any) {
  if (ADMIN_ROLES.includes(user.role)) return true;
  const div = await userDivision(user);
  return !!(div && HARI_DIVISION_KEYS.includes(div.key));
}

router.post('/work-items', async (c) => {
  await requirePerm(c, 'card.create');
  const user = c.get('user');
  const body = await c.req.json();
  const board = await prisma.board.findUnique({ where: { id: body.board_id } });
  const lst = await prisma.list.findFirst({ where: { id: body.list_id, boardId: body.board_id } });
  if (!lst) return c.json({ error: 'List not found' }, 404);
  if (!(await canEditOnBoard(user, body.board_id))) {
    return c.json({ detail: 'Anda hanya bisa membuat kartu di board Anda sendiri.' }, 403);
  }
  const count = await prisma.workItem.count({ where: { listId: body.list_id, archived: false } });
  
  const divIds = body.division_ids?.length ? body.division_ids : (board?.divisionId ? [board.divisionId] : []);

  // Pembuat SELALU jadi anggota kartu. Untuk kartu di board CS (atau dibuat orang
  // CS) → pembuat otomatis jadi Pemilik (Owner) + PIC: klien WA yang dibuat manual
  // pun langsung jelas siapa penanggung jawabnya.
  const csDiv = await prisma.division.findFirst({ where: { key: 'cs' } });
  const csContext = !!csDiv && ((user.divisionId && user.divisionId === csDiv.id) || (board?.divisionId && board.divisionId === csDiv.id));
  const memberIds = [...new Set([user.id, ...(body.member_ids || [])])];

  const item = await prisma.workItem.create({
    data: {
      id: newId(), title: body.title.trim(), clientName: body.clientName?.trim() || '', description: body.description || '',
      boardId: body.board_id, listId: body.list_id, position: (count + 1) * 1000.0,
      dueDate: body.due_date || null, priority: PRIORITIES.includes(body.priority) ? body.priority : 'none',
      status: 'active', archived: false, needsApproval: !!body.needs_approval,
      createdById: user.id, createdByName: user.name,
      currentPicId: user.id,
      workStatus: 'IN_PROGRESS',
      checklists: [],
      labels: { create: (body.label_ids || []).map((id: string) => ({ labelId: id })) },
      members: { create: memberIds.map((id: string) => ({ userId: id })) },
      divisionIds: { create: divIds.map((id: string) => ({ divisionId: id })) }
    },
    include: { members: true, labels: true, divisionIds: true }
  });

  // Board CS → buat Master Card (Owner = pembuat) + checklist "Progres Legalitas".
  if (csContext) {
    try { await ensureMasterCard(prisma, item); } catch (e) { console.error('[work-items ensureMasterCard]', e); }
  }

  await logActivity(item.id, item.boardId, user, `membuat pekerjaan "${item.title}"`);
  await ensureRequirementChecklist(item, lst);
  await runAutomation(item.boardId, 'card_created', item, user, item.listId);
  await runGlobalAutomation('card_created', { item, masterCardId: item.masterCardId, actor: user });
  if (body.member_ids?.length) {
    await notify(body.member_ids, 'assigned', 'Anda ditugaskan', `${user.name} menugaskan Anda pada "${item.title}"`, item.id, item.boardId, new Set([user.id]));
  }
  await broadcastItem(item);
  return c.json(formatWorkItem(item));
});

router.get('/work-items/:item_id', async (c) => {
  const user = c.get('user');
  const itemId = c.req.param('item_id');
  let item: any;
  try { item = await getItemChecked(itemId, user); }
  catch { return c.json({ detail: 'Kartu tidak ditemukan atau sudah dihapus' }, 404); }

  // Self-heal: pastikan status Master Card selaras dengan assignment-nya
  // (memperbaiki data lama yang ter-set manual "selesai").
  if (item.masterCardId) {
    try {
      const rc = await recomputeMasterStatus(item.masterCardId, user);
      if (rc.changed) item = await getItemChecked(itemId, user);
    } catch (e) { /* jangan gagalkan GET */ }
  }

  // Feed di-scope ke GRUP Master Card (master + semua assignment).
  const ids = await groupItemIds(item);
  const origins = await originMap(ids);
  const tag = (wid: string) => (wid === itemId ? null : origins[wid] || null);

  const comments = (await prisma.comment.findMany({ where: { workItemId: { in: ids } }, orderBy: { createdAt: 'desc' } }))
    .map((c) => ({ id: c.id, work_item_id: c.workItemId, created_by_id: c.createdById, created_by_name: c.createdByName, text: c.text, attachment_id: c.attachmentId, created_at: c.createdAt, updated_at: c.updatedAt, origin: tag(c.workItemId) }));
  const attachments = (await prisma.attachment.findMany({ where: { workItemId: { in: ids }, isDeleted: false } }))
    .map((a) => ({ id: a.id, work_item_id: a.workItemId, original_filename: a.originalFilename, content_type: a.contentType, size: a.size, uploaded_by_name: a.uploadedByName, uploaded_by_id: a.uploadedById, created_at: a.createdAt, external_url: a.storagePath, origin: tag(a.workItemId) }));
  const activities = (await prisma.activity.findMany({ where: { workItemId: { in: ids } }, orderBy: { createdAt: 'desc' }, take: 120 }))
    .map((a: any) => ({ ...a, origin: tag(a.workItemId) }));

  const boardLabels = await prisma.label.findMany({ where: { boardId: item.boardId } });
  const lst = await prisma.list.findUnique({ where: { id: item.listId } });
  const board = await prisma.board.findUnique({ where: { id: item.boardId } });

  // Untuk assignment (kartu grup): judul, deskripsi & checklist DITAMPILKAN dari
  // Master Card rep (canonical) supaya "tampil sama" di semua board — konsisten
  // dengan field BERSAMA di PATCH /work-items/:item_id (judul, klien, deskripsi).
  const host = await canonicalItem(item);
  const itemOut: any = formatWorkItem(item);
  if (host.id !== item.id) {
    itemOut.title = host.title || itemOut.title;
    itemOut.description = host.description || '';
    itemOut.checklists = normChecklists(host.checklists);
    itemOut.client_name = host.clientName ?? itemOut.client_name;
  }

  // Ringkasan assignment saudara (untuk panel di Master Card).
  const sibRows = item.masterCardId
    ? await prisma.workItem.findMany({
        where: { masterCardId: item.masterCardId, targetDivisionId: { not: null } },
        include: { targetDivision: true, currentPic: true, list: true },
        orderBy: { createdAt: 'asc' },
      })
    : [];
  const siblings = sibRows.map((s: any) => {
    const ds = displayStatus(s);
    return {
      id: s.id, title: s.title, division_name: s.targetDivision?.name || null,
      division_key: s.targetDivision?.key || null, pic_name: s.currentPic?.name || null,
      distribution_status: s.distributionStatus, work_status: s.workStatus,
      list_name: s.list?.name || null, updated_at: s.updatedAt,
      display_status: ds.code, display_status_label: ds.label, display_status_tone: ds.tone,
      is_done: ds.code === 'DONE',
    };
  });
  const groupProgress = siblings.length
    ? { done: siblings.filter((s: any) => s.is_done).length, total: siblings.length }
    : null;

  return c.json({
    item: itemOut,
    comments, attachments, activities,
    board_labels: boardLabels, list_name: lst?.name, board_name: board?.name,
    shared_labels: item.masterCardId ? normLabelList((item as any).masterCard?.sharedLabels) : null,
    mirror_boards: [],
    assignments: siblings,
    group_progress: groupProgress,
    master: await masterInfo(item),
    is_assignment: !!(item.masterCardId && item.targetDivisionId),
    mentionable_users: await mentionableUsers(item),
    can_edit: await canEditItem(user, item),
    can_comment: await canCommentItem(user, item),
  });
});

router.patch('/work-items/:item_id', async (c) => {
  await requirePerm(c, 'card.edit');
  const user = c.get('user');
  const itemId = c.req.param('item_id');
  const item = await getItemChecked(itemId, user);
  const denied = await editDenied(c, user, item);
  if (denied) return denied;
  const body = await c.req.json();

  // Field BERSAMA (satu sumber di Master Card rep untuk kartu grup): judul,
  // nama klien, deskripsi. Field LOKAL per kartu: cover, prioritas, tanggal.
  const shared: any = {};
  if (body.title !== undefined) shared.title = body.title;
  if (body.client_name !== undefined) shared.clientName = body.client_name;
  if (body.description !== undefined) shared.description = body.description;

  const local: any = {};
  if (body.start_date !== undefined) local.startDate = body.start_date;
  if (body.due_date !== undefined) local.dueDate = body.due_date;
  if (body.needs_approval !== undefined) local.needsApproval = body.needs_approval;
  if (body.cover_color !== undefined) local.coverColor = body.cover_color;
  if (body.cover_attachment_id !== undefined) local.coverAttachmentId = body.cover_attachment_id;
  if (body.priority && PRIORITIES.includes(body.priority)) local.priority = body.priority;

  if (!Object.keys(shared).length && !Object.keys(local).length && !body.label_ids) {
    return c.json(formatWorkItem(item));
  }

  const host = await canonicalItem(item);
  const grouped = host.id !== item.id;

  // label kartu grup → single source of truth
  const groupedLabelChange = body.label_ids !== undefined && item.masterCardId;
  if (body.label_ids !== undefined && !item.masterCardId) {
    local.labels = { deleteMany: {}, create: body.label_ids.map((id: string) => ({ labelId: id })) };
  }

  // Susun pesan aktivitas per field yang benar-benar berubah supaya tercatat detail.
  const changes: string[] = [];
  if (shared.title !== undefined && shared.title !== host.title) changes.push(`mengubah judul menjadi "${shared.title}"`);
  if (shared.clientName !== undefined && shared.clientName !== host.clientName) changes.push(`mengubah nama klien menjadi "${shared.clientName || '-'}"`);
  if (shared.description !== undefined && shared.description !== host.description) changes.push('mengubah deskripsi');
  if (local.startDate !== undefined && String(local.startDate || '') !== String(item.startDate || '')) changes.push(local.startDate ? 'mengatur tanggal mulai' : 'menghapus tanggal mulai');
  if (local.dueDate !== undefined && String(local.dueDate || '') !== String(item.dueDate || '')) changes.push(local.dueDate ? 'mengatur tanggal deadline' : 'menghapus tanggal deadline');
  if (local.needsApproval !== undefined && local.needsApproval !== item.needsApproval) changes.push(local.needsApproval ? 'mengaktifkan perlu persetujuan' : 'menonaktifkan perlu persetujuan');
  if (local.priority !== undefined && local.priority !== item.priority) changes.push(`mengubah prioritas menjadi "${local.priority}"`);
  if (local.coverColor !== undefined && local.coverColor !== item.coverColor) changes.push('mengubah warna cover');
  if (local.coverAttachmentId !== undefined && local.coverAttachmentId !== item.coverAttachmentId) changes.push('mengubah gambar cover');
  if (body.label_ids !== undefined && !item.masterCardId) changes.push('mengubah label');

  if (Object.keys(local).length) {
    await prisma.workItem.update({ where: { id: itemId }, data: { ...local, updatedAt: new Date() } });
  }
  if (Object.keys(shared).length) {
    await prisma.workItem.update({ where: { id: host.id }, data: { ...shared, updatedAt: new Date() } });
  }

  if (groupedLabelChange) {
    const sh = await labelIdsToShared(body.label_ids || []);
    await syncGroupLabels(item.masterCardId, sh, user);
    await logActivity(host.id, host.boardId, user, `mengubah label "${host.title}"`);
  }
  if (changes.length) {
    await logActivity(host.id, host.boardId, user, `${changes.join(', ')} pada "${host.title}"`);
  } else if (!groupedLabelChange) {
    await logActivity(host.id, host.boardId, user, `mengubah pekerjaan "${host.title}"`);
  }
  if (grouped && Object.keys(shared).length) await broadcastItem(await getWorkItem(host.id));
  await broadcastItem(await getWorkItem(itemId));
  return c.json(formatWorkItem(await getWorkItem(itemId)));
});

router.delete('/work-items/:item_id', async (c) => {
  await requirePerm(c, 'card.delete');
  const user = c.get('user');
  const itemId = c.req.param('item_id');
  const item = await getWorkItem(itemId);

  const isAssignment = !!item.targetDivisionId;
  const mc = item.masterCardId ? await prisma.masterCard.findUnique({ where: { id: item.masterCardId } }) : null;
  // Hapus kartu MIRROR / assignment: tidak menyentuh Master Card sama sekali —
  // hanya baris assignment ini yang dihapus. Boleh oleh supervisor/admin, PIC,
  // pembuat assignment, atau Owner Master Card.
  const canDeleteAssignment =
    isAssignment &&
    (SUPERVISOR_ROLES.includes(user.role) ||
      item.currentPicId === user.id ||
      item.createdById === user.id ||
      mc?.ownerUserId === user.id);

  if (!canDeleteAssignment && !ADMIN_ROLES.includes(user.role)) {
    return c.json({ error: isAssignment
      ? 'Hanya PIC, pengirim, Owner, atau supervisor yang dapat menghapus assignment ini.'
      : 'Hanya admin yang dapat menghapus kartu ini.' }, 403);
  }

  // Catat DULU (mumpung baris masih ada — Activity.workItemId itu FK wajib),
  // baru hapus. Untuk assignment: catat di representasi Master Card supaya
  // jejaknya kelihatan di grup; representasi TIDAK ikut terhapus.
  let repIdToBroadcast: string | null = null;
  if (isAssignment && item.masterCardId) {
    const rep = await prisma.workItem.findFirst({ where: { masterCardId: item.masterCardId, targetDivisionId: null } });
    const divName = item.targetDivisionId
      ? (await prisma.division.findUnique({ where: { id: item.targetDivisionId } }))?.name
      : null;
    if (rep) {
      await logActivity(rep.id, rep.boardId, user, `menghapus kartu mirror "${item.title}"${divName ? ` di Bank Data ${divName}` : ''} — Master Card tetap ada`);
      repIdToBroadcast = rep.id;
    }
  }

  // Hapus Master Card rep → ikut hapus SEMUA assignment turunannya + baris
  // MasterCard, supaya tidak ada assignment yatim.
  const isMasterRep = !!item.masterCardId && !item.targetDivisionId;
  let removedAssignments = 0;
  const boardsToRefresh = new Set<string>([item.boardId]);
  if (isMasterRep) {
    const sibs = await prisma.workItem.findMany({
      where: { masterCardId: item.masterCardId, targetDivisionId: { not: null } },
      select: { id: true, boardId: true },
    });
    for (const s of sibs) {
      boardsToRefresh.add(s.boardId);
      await prisma.attachment.updateMany({ where: { workItemId: s.id }, data: { isDeleted: true } });
      await prisma.workItem.delete({ where: { id: s.id } });
      removedAssignments++;
    }
  }

  await prisma.attachment.updateMany({ where: { workItemId: itemId }, data: { isDeleted: true } });
  await prisma.workItem.delete({ where: { id: itemId } }); // cascade: comment, activity, dll ikut terhapus

  if (isMasterRep && item.masterCardId) {
    await prisma.masterCard.delete({ where: { id: item.masterCardId } }).catch(() => {});
  }

  if (repIdToBroadcast) {
    const rb = await getWorkItem(repIdToBroadcast).catch(() => null);
    if (rb) await broadcastItem(rb);
  }
  for (const b of boardsToRefresh) await wsManager.broadcast({ type: 'board_update', board_id: b });
  await broadcastItem(item); // item stale tapi cukup untuk kabari board asal
  return c.json({ ok: true, deleted_assignment: isAssignment, removed_assignments: removedAssignments });
});

router.post('/work-items/:item_id/move', async (c) => {
  await requirePerm(c, 'card.move');
  const user = c.get('user');
  const itemId = c.req.param('item_id');
  const body = await c.req.json();
  const item = await getItemChecked(itemId, user);
  const denied = await editDenied(c, user, item);
  if (denied) return denied;
  const targetList = await prisma.list.findUnique({ where: { id: body.list_id } });
  if (!targetList) return c.json({ error: 'List tujuan tidak ditemukan' }, 404);
  const targetBoard = await prisma.board.findUnique({
    where: { id: targetList.boardId },
    include: { members: true },
  });
  if (!targetBoard) return c.json({ error: 'Board tujuan tidak ditemukan' }, 404);

  const isCrossBoard = targetBoard.id !== item.boardId;
  // Hak akses: hanya boleh memindahkan ke board yang bisa diakses user
  // (admin, member board tujuan, atau satu divisi). Berlaku untuk pindah antar-board.
  if (isCrossBoard && !canViewBoard(user, targetBoard)) {
    return c.json({ error: 'Anda tidak punya akses ke board tujuan' }, 403);
  }

  const reqs = asReqArray(targetList.entryRequirements);
  if (reqs.length && targetList.id !== item.listId) {
    const missing = unmetRequirements(item, reqs);
    if (missing.length) {
      if (SUPERVISOR_ROLES.includes(user.role)) {
        await logActivity(itemId, targetBoard.id, user, `memindahkan "${item.title}" tanpa syarat: ${missing.join(', ')}`);
      } else {
        return c.json({ error: `Syarat belum terpenuhi: ${missing.join(', ')}` }, 400);
      }
    }
  }
  
  let hariStage = item.hariStage;
  let hariEnteredAt = item.hariEnteredAt;
  const oldList = await prisma.list.findUnique({ where: { id: item.listId } });
  if (oldList && oldList.id !== targetList.id) {
    const oldName = oldList.name.toUpperCase();
    const newName = targetList.name.toUpperCase();
    let isCs = false;
    if (targetBoard.divisionId) {
      const div = await prisma.division.findUnique({ where: { id: targetBoard.divisionId } });
      isCs = div?.key === 'cs';
    }
    if (isCs && newName.startsWith('SKOR 5') && !hariStage) {
      hariStage = 1;
      hariEnteredAt = new Date();
      await logActivity(itemId, targetBoard.id, user, `"${item.title}" masuk HARI 1`);
    } else if (hariStage && oldName.startsWith('SKOR 5') && !newName.startsWith('SKOR 5')) {
      hariStage = null;
      hariEnteredAt = null;
    }
  }
  
  // Pindah antar-board: checklist (kolom JSON), attachment & comment (relasi workItemId)
  // otomatis ikut karena row-nya sama. Yang perlu ditangani hanya label (board-scoped).
  let droppedLabels: string[] = [];
  let labelUpdate: any;
  if (isCrossBoard) {
    const res = await remapLabelsForBoard(item, targetBoard.id);
    labelUpdate = res.labelUpdate;
    droppedLabels = res.droppedLabels;
  }

  // Pindah ke list "selesai" (FINISH/DONE/SELESAI/SKOR 6) → tandai selesai.
  // Keluar dari list selesai ke list biasa → buka kembali. Semua status
  // (status kartu + workStatus) diselaraskan sekaligus.
  const toDone = isDoneListName(targetList.name);
  const fromDone = isDoneListName(oldList?.name);
  const statusSync: any = {};
  if (toDone && item.status !== 'done') {
    statusSync.status = 'done';
    statusSync.workStatus = 'COMPLETED';
    statusSync.completedAt = new Date();
  } else if (!toDone && fromDone && item.status === 'done') {
    statusSync.status = 'active';
    statusSync.workStatus = item.targetDivisionId || item.currentPicId ? 'IN_PROGRESS' : (item.workStatus ?? null);
    statusSync.completedAt = null;
  }

  const updated = await prisma.workItem.update({
    where: { id: itemId },
    data: {
      listId: body.list_id,
      boardId: targetBoard.id,
      position: body.position,
      hariStage,
      hariEnteredAt,
      updatedAt: new Date(),
      ...statusSync,
      ...(labelUpdate ? { labels: labelUpdate } : {}),
    },
  });

  await ensureRequirementChecklist(updated, targetList);
  await runAutomation(targetBoard.id, 'card_moved', updated, user, body.list_id);
  // Log lengkap untuk SEMUA perpindahan antar-list (bukan cuma antar-board):
  // "<user> memindahkan "<judul>" dari "<list asal>" ke "<list tujuan>"".
  const fromListName = oldList?.name || '(tidak diketahui)';
  const listChanged = !oldList || oldList.id !== targetList.id;
  if (listChanged || isCrossBoard) {
    const boardPart = isCrossBoard ? ` (board ${targetBoard.name})` : '';
    const labelPart = droppedLabels.length ? ` — label dilepas: ${droppedLabels.join(', ')}` : '';
    await logActivity(
      itemId,
      targetBoard.id,
      user,
      `memindahkan "${item.title}" dari "${fromListName}" ke "${targetList.name}"${boardPart}${labelPart}`,
    );
  }
  await broadcastItem(updated);
  // Board asal juga perlu di-refresh (kartu keluar dari sana).
  if (isCrossBoard) await wsManager.broadcast({ type: 'board_update', board_id: item.boardId, work_item_id: itemId });
  // Kalau assignment pindah ke/keluar dari list selesai → status Master ikut dihitung ulang.
  if (Object.keys(statusSync).length && item.targetDivisionId && item.masterCardId) {
    await recomputeMasterStatus(item.masterCardId, user);
  }
  return c.json({
    ok: true,
    board_id: targetBoard.id,
    list_id: body.list_id,
    cross_board: isCrossBoard,
    dropped_labels: droppedLabels,
    needs_label_reassign: droppedLabels.length > 0,
  });
});

// ── Bank Data helpers (PRD v1.0) ────────────────────────────────────────
const TAKEOVER_ROLES = ['super_admin', 'admin', 'supervisor'];

/**
 * Tentukan Owner Master Card untuk sebuah kartu:
 *  1. Pembuat kartu, bila dia anggota divisi CS.
 *  2. Selain itu, bila kartu berada di board milik divisi CS → anggota board tsb yang CS.
 *  3. Kalau tetap tidak ketemu → owner null (client offline), ownerDivisionId dari board.
 */
async function resolveOwner(tx: any, item: any) {
  const csDiv = await tx.division.findFirst({ where: { key: 'cs' } });
  const csId = csDiv?.id || null;
  const creator = item.createdById ? await tx.user.findUnique({ where: { id: item.createdById } }) : null;
  if (creator?.divisionId && creator.divisionId === csId) {
    return { ownerUserId: creator.id, ownerDivisionId: csId };
  }
  const board = await tx.board.findUnique({
    where: { id: item.boardId },
    include: { members: { include: { user: true } } },
  });
  if (board?.divisionId === csId) {
    const csMember = board.members.find((m: any) => m.user?.divisionId === csId);
    return { ownerUserId: csMember?.userId || null, ownerDivisionId: csId };
  }
  return { ownerUserId: null, ownerDivisionId: board?.divisionId || creator?.divisionId || null };
}

const MASTER_CHECKLIST_TITLE = 'Progres Legalitas';
const MASTER_CHECKLIST_ITEMS = ['Akta', 'SK Kemenkumham', 'NPWP', 'NIB'];

/** Tempelkan checklist "Progres Legalitas" ke kartu master bila belum ada. */
async function ensureProgressChecklist(tx: any, item: any) {
  let cls: any[] = [];
  try { cls = typeof item.checklists === 'string' ? JSON.parse(item.checklists) : (item.checklists || []); } catch { cls = []; }
  if (!Array.isArray(cls)) cls = [];
  if (cls.some((c: any) => c.title === MASTER_CHECKLIST_TITLE)) return;
  cls.push({
    id: newId(),
    title: MASTER_CHECKLIST_TITLE,
    items: MASTER_CHECKLIST_ITEMS.map((t) => ({ id: newId(), text: t, done: false })),
  });
  await tx.workItem.update({ where: { id: item.id }, data: { checklists: cls } });
}

/** Pastikan item punya Master Card induk + checklist progres. */
async function ensureMasterCard(tx: any, item: any): Promise<string> {
  if (item.masterCardId) {
    await ensureProgressChecklist(tx, item);
    return item.masterCardId;
  }
  const owner = await resolveOwner(tx, item);
  const mc = await tx.masterCard.create({
    data: { title: item.title, client: item.clientName || null, ...owner },
  });
  await tx.workItem.update({ where: { id: item.id }, data: { masterCardId: mc.id } });
  await ensureProgressChecklist(tx, { ...item, checklists: item.checklists });
  return mc.id;
}

/** id user yang wajib dinotifikasi saat status distribusi berubah (owner + pengirim). */
function stakeholderIds(item: any, mc: any): string[] {
  return [...new Set([mc?.ownerUserId, item.sourceUserId, item.createdById].filter(Boolean))] as string[];
}

// ─────────────────────────────────────────────────────────────────────────
// GRUP MASTER CARD — feed komentar/lampiran/aktivitas dibagikan ke satu grup
// (Master Card + semua Assignment turunannya). Post dari kartu mana pun,
// semua di grup melihatnya, ditandai asalnya.
// ─────────────────────────────────────────────────────────────────────────
async function groupItemIds(item: any): Promise<string[]> {
  if (!item.masterCardId) return [item.id];
  const rows = await prisma.workItem.findMany({ where: { masterCardId: item.masterCardId }, select: { id: true } });
  const ids = rows.map((r) => r.id);
  return ids.length ? ids : [item.id];
}

async function originMap(ids: string[]): Promise<Record<string, any>> {
  const rows = await prisma.workItem.findMany({
    where: { id: { in: ids } },
    include: { board: { include: { division: true } }, targetDivision: true, currentPic: true },
  });
  const m: Record<string, any> = {};
  for (const r of rows) {
    const div = r.targetDivision || r.board?.division;
    m[r.id] = {
      work_item_id: r.id,
      is_master: !r.targetDivisionId,
      division_key: div?.key || null,
      label: div?.name || r.board?.name || (r.targetDivisionId ? 'Assignment' : 'Kartu asal'),
      pic_name: r.currentPic?.name || null,
    };
  }
  return m;
}

/** Info Master Card untuk assignment (penanda "kartu mirror" + asal board/list). */
async function masterInfo(item: any) {
  if (!item.masterCardId || !item.targetDivisionId) return null;
  const m = await prisma.workItem.findFirst({
    where: { masterCardId: item.masterCardId, targetDivisionId: null },
    include: { board: true, list: true, currentPic: true },
  });
  if (!m) return null;
  return {
    id: m.id, title: m.title, board_id: m.boardId, board_name: m.board?.name || null, list_name: m.list?.name || null,
    // Siapa CS pemegang job ini — supaya kartu assignment (mis. di Admin Draf)
    // menampilkan konteks "job ini dari CS siapa", bukan cuma nama board.
    pic_name: m.currentPic?.name || null,
  };
}

/** User yang relevan untuk di-mention (punya akses ke kartu ini). */
async function mentionableUsers(item: any): Promise<any[]> {
  const set = new Map<string, any>();
  const add = (u: any) => { if (u) set.set(u.id, { id: u.id, name: u.name, avatar_color: u.avatarColor }); };
  (await prisma.user.findMany({ where: { role: { in: TAKEOVER_ROLES }, isActive: true } })).forEach(add);
  if (item.targetDivisionId) (await prisma.user.findMany({ where: { divisionId: item.targetDivisionId, isActive: true } })).forEach(add);
  const bd = await prisma.board.findUnique({
    where: { id: item.boardId },
    include: { members: { include: { user: true } }, division: { include: { users: true } } },
  });
  bd?.members?.forEach((m: any) => add(m.user));
  bd?.division?.users?.forEach(add);
  if (item.masterCardId) {
    const mc = await prisma.masterCard.findUnique({ where: { id: item.masterCardId }, include: { owner: true } });
    add(mc?.owner);
  }
  const gIds = await groupItemIds(item);
  (await prisma.workItemMember.findMany({ where: { workItemId: { in: gIds } }, include: { user: true } })).forEach((m: any) => add(m.user));
  return [...set.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** id user yang perlu dinotifikasi saat ada komentar/lampiran di grup ini. */
async function groupNotifyIds(item: any): Promise<string[]> {
  const ids = await groupItemIds(item);
  const rows = await prisma.workItem.findMany({ where: { id: { in: ids } }, select: { currentPicId: true, sourceUserId: true, createdById: true } });
  const set = new Set<string>();
  for (const r of rows) [r.currentPicId, r.sourceUserId, r.createdById].forEach((x) => x && set.add(x));
  if (item.masterCardId) {
    const mc = await prisma.masterCard.findUnique({ where: { id: item.masterCardId } });
    if (mc?.ownerUserId) set.add(mc.ownerUserId);
  }
  return [...set];
}

// ─────────────────────────────────────────────────────────────────────────
// HAK AKSES
//  - canEditItem  : ubah field / list / checklist / selesai.
//    → admin/supervisor · PIC · anggota divisi tujuan (kolaboratif) · member board.
//  - canCommentItem: komentar & lampiran di feed grup.
//    → siapa saja yang bisa "lihat": canEdit ∪ Owner Master Card ∪ pembuat kartu.
// ─────────────────────────────────────────────────────────────────────────
async function canEditItem(user: any, item: any): Promise<boolean> {
  if (TAKEOVER_ROLES.includes(user.role)) return true;
  if (item.currentPicId === user.id) return true;
  if (item.createdById === user.id) return true; // pembuat kartu selalu boleh
  // Assignment: anggota divisi tujuan boleh mengerjakan (kolaboratif).
  if (item.targetDivisionId && user.divisionId && item.targetDivisionId === user.divisionId) return true;
  const board = await prisma.board.findUnique({ where: { id: item.boardId }, include: { members: true, division: true } });
  if (board?.members?.some((m: any) => m.userId === user.id)) return true;
  // Kolaborasi se-divisi HANYA untuk divisi non-CS (Admin Draf, Pajak, Perizinan,
  // Desain). CS dikecualikan: tiap CS hanya boleh di BOARD-nya sendiri
  // (lewat keanggotaan board / PIC / pembuat / Owner Master Card).
  if (
    board?.divisionId && user.divisionId &&
    board.divisionId === user.divisionId &&
    board.division?.key !== 'cs'
  ) return true;
  if (item.masterCardId) {
    const mc = await prisma.masterCard.findUnique({ where: { id: item.masterCardId } });
    if (mc?.ownerUserId === user.id) return true;
  }
  return false;
}

/** Boleh membuat kartu di board ini? */
async function canEditOnBoard(user: any, boardId: string): Promise<boolean> {
  const board = await prisma.board.findUnique({ where: { id: boardId }, include: { members: true, division: true } });
  return canEditBoard(user, board);
}

async function canCommentItem(user: any, item: any): Promise<boolean> {
  if (await canEditItem(user, item)) return true;
  if (item.createdById === user.id) return true;
  if (item.masterCardId) {
    const mc = await prisma.masterCard.findUnique({ where: { id: item.masterCardId } });
    if (mc?.ownerUserId === user.id) return true;
  }
  return false;
}

/** Return response 403 kalau tidak boleh edit, atau null kalau boleh. */
async function editDenied(c: any, user: any, item: any) {
  if (await canEditItem(user, item)) return null;
  return c.json({ error: 'Hanya PIC / anggota divisi terkait yang dapat mengubah kartu ini.' }, 403);
}
async function commentDenied(c: any, user: any, item: any) {
  if (await canCommentItem(user, item)) return null;
  return c.json({ error: 'Anda tidak punya akses ke kartu ini.' }, 403);
}

/**
 * Cari board divisi + list awal yang VALID (board harus punya list).
 * DB bisa punya beberapa board dgn nama sama / board kosong sisa re-seed —
 * jadi jangan asal ambil yang pertama. Prioritas: board yg punya paling banyak list.
 */
async function resolveDivisionBoardList(tx: any, divisionId: string, preferBoardId?: string, preferListId?: string) {
  let board: any = null;
  if (preferBoardId) {
    board = await tx.board.findFirst({ where: { id: preferBoardId, isArchived: false }, include: { lists: { where: { archived: false }, orderBy: { position: 'asc' } } } });
    if (board && board.lists.length === 0) board = null;
  }
  if (!board) {
    const candidates = await tx.board.findMany({
      where: { divisionId, isArchived: false, lists: { some: {} } },
      include: { lists: { where: { archived: false }, orderBy: { position: 'asc' } }, _count: { select: { lists: true } } },
    });
    candidates.sort((a: any, b: any) => b._count.lists - a._count.lists);
    board = candidates[0] || null;
  }
  if (!board) return { board: null, listId: null };
  const listId =
    (preferListId && board.lists.find((l: any) => l.id === preferListId)?.id) ||
    board.lists[0]?.id ||
    null;
  return { board, listId };
}

/**
 * Board milik seorang user (Board User / Board pribadi) yang punya list.
 * "Milik" = board di mana user itu jadi anggota (BUKAN board yang dia buat —
 * board CS biasanya dibuat admin saat seed/setup, bukan oleh CS-nya sendiri).
 * Kalau user anggota di beberapa board, pilih yang paling "personal" (anggota
 * paling sedikit, mis. board 1-orang "CS Julia Ali") sebelum board bersama.
 */
async function resolveDivisionBoardListByCreator(tx: any, userId: string) {
  const candidates = await tx.board.findMany({
    where: { isArchived: false, lists: { some: {} }, members: { some: { userId } } },
    include: { lists: { where: { archived: false }, orderBy: { position: 'asc' } }, _count: { select: { lists: true, members: true } } },
  });
  candidates.sort((a: any, b: any) => a._count.members - b._count.members || b._count.lists - a._count.lists);
  const board = candidates[0] || null;
  return { board, listId: board?.lists[0]?.id || null };
}

router.post('/work-items/:item_id/claim', async (c) => {
  await requirePerm(c, 'bankdata.claim');
  const user = c.get('user');
  const itemId = c.req.param('item_id');
  const body = await c.req.json().catch(() => ({}));
  const item = await getItemChecked(itemId, user);
  if (item.currentPicId === user.id) return c.json({ error: 'Anda sudah menjadi PIC' }, 400);

  // Board tujuan PIC — harus board yang punya list
  let userBoardId = body.board_id;
  let userListId = body.list_id;
  if (!userBoardId || !userListId) {
    const pb = await resolveDivisionBoardListByCreator(prisma, user.id);
    if (pb.board) { userBoardId = userBoardId || pb.board.id; userListId = userListId || pb.listId; }
  }

  // Flow B: Assignment masuk Bank Data Customer Service & belum ada Owner
  const csDiv = await prisma.division.findFirst({ where: { key: 'cs' } });
  const isCsBankData = !!(csDiv && item.targetDivisionId === csDiv.id);

  const claimedAt = new Date();
  let picName = '';

  const result = await prisma.$transaction(async (tx) => {
    // Klaim ATOMIC — hanya lolos bila masih AVAILABLE & belum ada PIC (§7.4 / §12)
    const upd = await tx.workItem.updateMany({
      where: { id: itemId, currentPicId: null, distributionStatus: 'AVAILABLE', archived: false },
      data: {
        currentPicId: user.id,
        distributionStatus: 'CLAIMED',
        workStatus: 'CLAIMED',
        claimedAt,
        releasedAt: null,
        ...(userBoardId ? { boardId: userBoardId } : {}),
        ...(userListId ? { listId: userListId } : {}),
        // Flow B: kartu ini LAHIR sebagai "assignment ke Bank Data CS"
        // (targetDivisionId = divisi CS) karena belum ada Master Card. Begitu
        // di-claim, dia LULUS jadi Master Card / kartu representatif sendiri —
        // targetDivisionId dilepas supaya isMasterCard/masterInfo() & panel
        // "Status Pengerjaan per Divisi" berfungsi benar (banner mirror di
        // assignment lain, siblings di kartu ini).
        ...(isCsBankData ? { targetDivisionId: null, targetBoardId: null, targetListId: null } : {}),
        updatedAt: new Date(),
      },
    });
    if (upd.count === 0) return { ok: false as const };

    await tx.workItemMember.upsert({
      where: { workItemId_userId: { workItemId: itemId, userId: user.id } },
      create: { workItemId: itemId, userId: user.id },
      update: {},
    });
    await tx.workItemAssignmentHistory.create({
      data: { id: newId(), workItemId: itemId, toUserId: user.id, action: 'CLAIM', createdById: user.id },
    });

    const mcId = await ensureMasterCard(tx, item);
    let mc = await tx.masterCard.findUnique({ where: { id: mcId } });

    // Flow B — CS yang claim menjadi Owner Master Card
    if (isCsBankData && mc && !mc.ownerUserId) {
      mc = await tx.masterCard.update({
        where: { id: mcId },
        data: { ownerUserId: user.id, ownerDivisionId: user.divisionId || csDiv!.id },
      });
    }
    return { ok: true as const, mc };
  });

  if (!result.ok) {
    const fresh = await prisma.workItem.findUnique({ where: { id: itemId }, include: { currentPic: true } });
    picName = fresh?.currentPic?.name || 'orang lain';
    return c.json({ error: `Pekerjaan ini baru saja diambil oleh ${picName}.` }, 409);
  }

  const mc = result.mc;
  await logActivity(itemId, item.targetDivisionId ? (item.targetBoardId || item.boardId) : item.boardId, user, `mengambil pekerjaan "${item.title}"`);
  await notify(
    stakeholderIds(item, mc),
    'claimed',
    'Pekerjaan diambil',
    `${user.name} telah mengambil pekerjaan "${item.title}".`,
    itemId,
    item.boardId,
    new Set([user.id]),
  );
  await broadcastItem(await getWorkItem(itemId));
  return c.json({ ok: true, flow: isCsBankData ? 'B' : 'A' });
});

router.post('/work-items/:item_id/release', async (c) => {
  await requirePerm(c, 'bankdata.release');
  const user = c.get('user');
  const itemId = c.req.param('item_id');
  const body = await c.req.json().catch(() => ({}));
  const item = await getItemChecked(itemId, user);

  const isPic = item.currentPicId === user.id;
  if (!isPic && !TAKEOVER_ROLES.includes(user.role)) {
    return c.json({ error: 'Hanya PIC atau supervisor yang dapat melepaskan pekerjaan ini' }, 403);
  }

  const releasedAt = new Date();
  const mc = item.masterCardId ? await prisma.masterCard.findUnique({ where: { id: item.masterCardId } }) : null;

  await prisma.$transaction(async (tx) => {
    await tx.workItem.update({
      where: { id: itemId },
      data: {
        currentPicId: null,
        distributionStatus: 'AVAILABLE',
        workStatus: 'WAITING_CLAIM',
        releasedAt,
        updatedAt: new Date(),
        ...(item.targetBoardId ? { boardId: item.targetBoardId } : {}),
        ...(item.targetListId ? { listId: item.targetListId } : {}),
        members: item.currentPicId ? { deleteMany: { userId: item.currentPicId } } : undefined,
      },
    });
    await tx.workItemAssignmentHistory.create({
      data: {
        id: newId(),
        workItemId: itemId,
        fromUserId: item.currentPicId || user.id,
        action: 'UNCLAIM',
        reason: body.reason || null,
        createdById: user.id,
      },
    });
  });

  const reason = body.reason ? ` — Alasan: ${body.reason}` : '';
  await logActivity(itemId, item.targetBoardId || item.boardId, user, `melepaskan pekerjaan "${item.title}"${reason}`);
  await notify(
    stakeholderIds(item, mc),
    'released',
    'Pekerjaan dilepaskan',
    `${user.name} telah melepaskan pekerjaan "${item.title}"${reason}`,
    itemId,
    item.boardId,
    new Set([user.id]),
  );
  await broadcastItem(await getWorkItem(itemId));
  return c.json({ ok: true });
});

// Ambil Alih (§7.5) — ganti PIC lama ke PIC baru secara langsung. "Permission
// khusus" (default hanya supervisor+) — sepenuhnya diatur oleh matriks Hak
// Akses (`bankdata.takeover`), TIDAK ada lagi gerbang role hardcode di sini.
router.post('/work-items/:item_id/takeover', async (c) => {
  await requirePerm(c, 'bankdata.takeover');
  const user = c.get('user');
  const itemId = c.req.param('item_id');
  const body = await c.req.json().catch(() => ({}));
  const newPicId = body.pic_user_id || user.id;
  const item = await getItemChecked(itemId, user);
  const oldPicId = item.currentPicId || null;
  if (oldPicId === newPicId) return c.json({ error: 'PIC baru sama dengan PIC saat ini' }, 400);

  const newPic = await prisma.user.findUnique({ where: { id: newPicId } });
  if (!newPic) return c.json({ error: 'User PIC baru tidak ditemukan' }, 404);
  const oldPic = oldPicId ? await prisma.user.findUnique({ where: { id: oldPicId } }) : null;
  const mc = item.masterCardId ? await prisma.masterCard.findUnique({ where: { id: item.masterCardId } }) : null;

  let picBoardId = body.board_id;
  let picListId = body.list_id;
  if (!picBoardId || !picListId) {
    const pb = await resolveDivisionBoardListByCreator(prisma, newPicId);
    if (pb.board) { picBoardId = picBoardId || pb.board.id; picListId = picListId || pb.listId; }
  }

  await prisma.$transaction(async (tx) => {
    await tx.workItem.update({
      where: { id: itemId },
      data: {
        currentPicId: newPicId,
        distributionStatus: 'CLAIMED',
        workStatus: 'CLAIMED',
        claimedAt: new Date(),
        updatedAt: new Date(),
        ...(picBoardId ? { boardId: picBoardId } : {}),
        ...(picListId ? { listId: picListId } : {}),
      },
    });
    if (oldPicId) await tx.workItemMember.deleteMany({ where: { workItemId: itemId, userId: oldPicId } });
    await tx.workItemMember.upsert({
      where: { workItemId_userId: { workItemId: itemId, userId: newPicId } },
      create: { workItemId: itemId, userId: newPicId },
      update: {},
    });
    await tx.workItemAssignmentHistory.create({
      data: {
        id: newId(),
        workItemId: itemId,
        fromUserId: oldPicId,
        toUserId: newPicId,
        action: 'TAKE_OVER',
        reason: body.reason || null,
        createdById: user.id,
      },
    });
  });

  await logActivity(
    itemId,
    picBoardId || item.boardId,
    user,
    `mengambil alih "${item.title}" dari ${oldPic?.name || '—'} ke ${newPic.name}`,
  );
  await notify(
    [...new Set([...stakeholderIds(item, mc), oldPicId, newPicId].filter(Boolean))] as string[],
    'takeover',
    'Pekerjaan dialihkan',
    `Pekerjaan "${item.title}" telah dialihkan dari ${oldPic?.name || '—'} ke ${newPic.name}.`,
    itemId,
    item.boardId,
    new Set([user.id]),
  );
  await broadcastItem(await getWorkItem(itemId));
  return c.json({ ok: true });
});

router.post('/work-items/:item_id/assign', async (c) => {
  await requirePerm(c, 'card.assign_members');
  const user = c.get('user');
  const itemId = c.req.param('item_id');
  const body = await c.req.json();
  const item = await getItemChecked(itemId, user);
  
  if (body.remove_user_ids?.length && !SUPERVISOR_ROLES.includes(user.role)) {
    if (body.remove_user_ids.some((id: string) => id !== user.id)) return c.json({ error: 'Hanya supervisor' }, 403);
  }
  
  const updateData: any = { updatedAt: new Date() };
  if (body.add_user_ids || body.remove_user_ids) {
    updateData.members = {};
    if (body.remove_user_ids?.length) updateData.members.deleteMany = body.remove_user_ids.map((id: string) => ({ userId: id }));
    if (body.add_user_ids?.length) updateData.members.create = body.add_user_ids.map((id: string) => ({ userId: id }));
  }
  if (body.add_division_ids || body.remove_division_ids) {
    updateData.divisionIds = {};
    if (body.remove_division_ids?.length) updateData.divisionIds.deleteMany = body.remove_division_ids.map((id: string) => ({ divisionId: id }));
    if (body.add_division_ids?.length) updateData.divisionIds.create = body.add_division_ids.map((id: string) => ({ divisionId: id }));
  }
  
  await prisma.workItem.update({ where: { id: itemId }, data: updateData });

  if (body.remove_user_ids?.length) {
    const removed = await prisma.user.findMany({ where: { id: { in: body.remove_user_ids } }, select: { name: true } });
    const names = removed.map((u: any) => u.name).filter(Boolean).join(', ');
    await logActivity(itemId, item.boardId, user, `menghapus anggota${names ? ` ${names}` : ''} dari "${item.title}"`);
  }
  if (body.add_division_ids?.length || body.remove_division_ids?.length) {
    const divIds = [...(body.add_division_ids || []), ...(body.remove_division_ids || [])];
    const divs = await prisma.division.findMany({ where: { id: { in: divIds } }, select: { id: true, name: true } });
    const divName = (id: string) => divs.find((d: any) => d.id === id)?.name || id;
    if (body.add_division_ids?.length) await logActivity(itemId, item.boardId, user, `menambahkan divisi ${body.add_division_ids.map(divName).join(', ')} pada "${item.title}"`);
    if (body.remove_division_ids?.length) await logActivity(itemId, item.boardId, user, `menghapus divisi ${body.remove_division_ids.map(divName).join(', ')} pada "${item.title}"`);
  }

  // "Join" (menambahkan diri sendiri) → kalau kartu BELUM ada PIC, otomatis jadi PIC.
  let becamePic = false;
  const joinedSelf = Array.isArray(body.add_user_ids) && body.add_user_ids.length === 1 && body.add_user_ids[0] === user.id;
  if (joinedSelf && !item.currentPicId) {
    await prisma.workItem.update({
      where: { id: itemId },
      data: { currentPicId: user.id, workStatus: item.workStatus === 'COMPLETED' ? item.workStatus : 'IN_PROGRESS' },
    });
    becamePic = true;
    await logActivity(itemId, item.boardId, user, `mengambil "${item.title}" sebagai PIC`);
  } else if (body.add_user_ids?.length) {
    await logActivity(itemId, item.boardId, user, `menambahkan anggota pada "${item.title}"`);
    await notify(body.add_user_ids.filter((id: string) => id !== user.id), 'assigned', 'Anda ditambahkan ke kartu', `${user.name} menambahkan Anda ke "${item.title}"`, itemId, item.boardId, new Set([user.id]));
  }
  await broadcastItem(await getWorkItem(itemId));
  return c.json({ ok: true, became_pic: becamePic });
});

// "Jadikan saya PIC" / tetapkan PIC — untuk kartu CS biasa (bukan alur klaim Bank Data).
router.post('/work-items/:item_id/set-pic', async (c) => {
  await requirePerm(c, 'card.assign_members');
  const user = c.get('user');
  const itemId = c.req.param('item_id');
  const body = await c.req.json().catch(() => ({}));
  const item = await getItemChecked(itemId, user);
  { const _d = await editDenied(c, user, item); if (_d) return _d; }

  const targetId: string = body.user_id || user.id;
  const target = await prisma.user.findUnique({ where: { id: targetId } });
  if (!target) return c.json({ error: 'Pengguna tidak ditemukan' }, 404);
  if (item.currentPicId === targetId) return c.json({ ok: true, pic_user_id: targetId });

  await prisma.workItem.update({
    where: { id: itemId },
    data: { currentPicId: targetId, workStatus: item.workStatus === 'COMPLETED' ? item.workStatus : 'IN_PROGRESS' },
  });
  await prisma.workItemMember.upsert({
    where: { workItemId_userId: { workItemId: itemId, userId: targetId } },
    update: {}, create: { workItemId: itemId, userId: targetId },
  });
  const self = targetId === user.id;
  await logActivity(itemId, item.boardId, user, self ? `mengambil "${item.title}" sebagai PIC` : `menetapkan ${target.name} sebagai PIC "${item.title}"`);
  if (!self) {
    await notify([targetId], 'assigned', 'Anda jadi PIC', `${user.name} menetapkan Anda sebagai PIC "${item.title}".`, itemId, item.boardId, new Set([user.id]));
  }
  await broadcastItem(await getWorkItem(itemId));
  return c.json({ ok: true, pic_user_id: targetId });
});

// Oper kepemilikan kartu: Pemilik (Owner Master Card) + PIC dipindah sekaligus
// ke user lain. HANYA Owner job saat ini, atau supervisor/super admin — BUKAN
// sekadar PIC assignment atau pembuat kartu (itu tidak sama dengan pemilik job).
router.post('/work-items/:item_id/transfer-owner', async (c) => {
  await requirePerm(c, 'card.transfer_owner');
  const user = c.get('user');
  const itemId = c.req.param('item_id');
  const body = await c.req.json().catch(() => ({}));
  const targetId: string = body.user_id;
  if (!targetId) return c.json({ error: 'user_id wajib diisi' }, 400);

  const item = await getItemChecked(itemId, user);
  const mc = item.masterCardId ? await prisma.masterCard.findUnique({ where: { id: item.masterCardId } }) : null;
  const allowed = TAKEOVER_ROLES.includes(user.role) || mc?.ownerUserId === user.id;
  if (!allowed) return c.json({ detail: 'Hanya Pemilik job ini atau supervisor/super admin yang dapat mengoper kepemilikan.' }, 403);

  const target = await prisma.user.findUnique({ where: { id: targetId } });
  if (!target) return c.json({ error: 'Pengguna tidak ditemukan' }, 404);

  // Owner disimpan di Master Card. Kartu grup: update MC. Kartu biasa: buatkan MC
  // supaya kepemilikan tercatat.
  let mcId = item.masterCardId as string | null;
  if (!mcId) {
    try { mcId = await ensureMasterCard(prisma, item); } catch { mcId = null; }
  }
  if (mcId) {
    await prisma.masterCard.update({ where: { id: mcId }, data: { ownerUserId: targetId, ownerDivisionId: target.divisionId || null } });
  }
  // Pindahkan fisik kartu ke board milik pemilik baru (sama seperti /claim &
  // /takeover) — supaya TIDAK nyangkut di board pemilik lama.
  const pb = await resolveDivisionBoardListByCreator(prisma, targetId);
  await prisma.workItem.update({
    where: { id: itemId },
    data: {
      currentPicId: targetId,
      workStatus: item.workStatus === 'COMPLETED' ? item.workStatus : 'IN_PROGRESS',
      ...(pb.board ? { boardId: pb.board.id } : {}),
      ...(pb.listId ? { listId: pb.listId } : {}),
    },
  });
  await prisma.workItemMember.upsert({
    where: { workItemId_userId: { workItemId: itemId, userId: targetId } },
    update: {}, create: { workItemId: itemId, userId: targetId },
  });
  await logActivity(itemId, item.boardId, user, `mengoper kepemilikan "${item.title}" ke ${target.name}`);
  await notify([targetId], 'assigned', 'Kepemilikan kartu dioper ke Anda', `${user.name} mengoper kepemilikan "${item.title}" kepada Anda (Pemilik + PIC).`, itemId, item.boardId, new Set([user.id]));
  await broadcastItem(await getWorkItem(itemId));
  return c.json({ ok: true, owner_user_id: targetId, pic_user_id: targetId });
});

router.post('/work-items/:item_id/submit', async (c) => {
  await requirePerm(c, 'card.complete');
  const user = c.get('user');
  const itemId = c.req.param('item_id');
  const item = await getItemChecked(itemId, user);
  { const _d = await editDenied(c, user, item); if (_d) return _d; }
  if (item.status === 'done') return c.json({ error: 'Sudah selesai' }, 400);

  // Master Card yang PUNYA assignment → status-nya turunan. Tidak bisa diselesaikan manual.
  const isMasterRep = !!item.masterCardId && !item.targetDivisionId;
  if (isMasterRep) {
    const nAssign = await prisma.workItem.count({ where: { masterCardId: item.masterCardId, targetDivisionId: { not: null } } });
    if (nAssign > 0) {
      return c.json({ detail: 'Kartu ini selesai otomatis saat semua divisi menyelesaikan bagiannya. Tandai selesai di kartu divisinya.' }, 400);
    }
  }

  if (item.needsApproval) {
    await prisma.workItem.update({ where: { id: itemId }, data: { status: 'submitted', workStatus: 'WAITING', submittedById: user.id, updatedAt: new Date() } });
    await logActivity(itemId, item.boardId, user, `mengajukan penyelesaian "${item.title}"`);
  } else {
    await prisma.workItem.update({ where: { id: itemId }, data: { status: 'done', workStatus: 'COMPLETED', completedAt: new Date(), updatedAt: new Date() } });
    await logActivity(itemId, item.boardId, user, `menyelesaikan pekerjaan "${item.title}"`);
  }
  const updated = await getWorkItem(itemId);
  await broadcastItem(updated);
  if (item.targetDivisionId && item.masterCardId) await recomputeMasterStatus(item.masterCardId, user);
  return c.json(formatWorkItem(updated));
});

router.post('/work-items/:item_id/approve', async (c) => {
  await requirePerm(c, 'card.complete');
  const user = c.get('user');
  requireSupervisor(user);
  const itemId = c.req.param('item_id');
  const item = await getItemChecked(itemId, user);
  if (item.status !== 'submitted') return c.json({ error: 'Tidak menunggu persetujuan' }, 400);
  
  await prisma.workItem.update({ where: { id: itemId }, data: { status: 'done', workStatus: 'COMPLETED', completedAt: new Date(), approvedById: user.id, updatedAt: new Date() } });
  await logActivity(itemId, item.boardId, user, `menyetujui penyelesaian "${item.title}"`);
  const updated = await getWorkItem(itemId);
  await broadcastItem(updated);
  if (item.targetDivisionId && item.masterCardId) await recomputeMasterStatus(item.masterCardId, user);
  return c.json(formatWorkItem(updated));
});

router.post('/work-items/:item_id/reopen', async (c) => {
  await requirePerm(c, 'card.complete');
  const user = c.get('user');
  const itemId = c.req.param('item_id');
  const item = await getItemChecked(itemId, user);
  { const _d = await editDenied(c, user, item); if (_d) return _d; }
  const reopenWork = item.targetDivisionId ? 'IN_PROGRESS' : (item.currentPicId ? 'IN_PROGRESS' : null);
  await prisma.workItem.update({ where: { id: itemId }, data: { status: 'active', workStatus: reopenWork ?? item.workStatus ?? null, completedAt: null, approvedById: null, updatedAt: new Date() } });
  await logActivity(itemId, item.boardId, user, `membuka kembali pekerjaan "${item.title}"`);
  const updated = await getWorkItem(itemId);
  await broadcastItem(updated);
  if (item.targetDivisionId && item.masterCardId) await recomputeMasterStatus(item.masterCardId, user);
  return c.json(formatWorkItem(updated));
});

router.post('/work-items/:item_id/archive', async (c) => {
  await requirePerm(c, 'card.archive');
  const user = c.get('user');
  const itemId = c.req.param('item_id');
  const item = await getItemChecked(itemId, user);
  await prisma.workItem.update({ where: { id: itemId }, data: { archived: true, updatedAt: new Date() } });
  await logActivity(itemId, item.boardId, user, `mengarsipkan "${item.title}"`);
  await broadcastItem(await getWorkItem(itemId));
  return c.json({ ok: true });
});

router.post('/work-items/:item_id/unarchive', async (c) => {
  await requirePerm(c, 'card.archive');
  const user = c.get('user');
  const itemId = c.req.param('item_id');
  const item = await getItemChecked(itemId, user);
  await prisma.workItem.update({ where: { id: itemId }, data: { archived: false, updatedAt: new Date() } });
  await logActivity(itemId, item.boardId, user, `mengembalikan "${item.title}" dari arsip`);
  await broadcastItem(await getWorkItem(itemId));
  return c.json({ ok: true });
});


/**
 * Kirim ke Divisi (§7.1 / §34): Master Card TIDAK dipindah/diduplikasi.
 * Untuk tiap divisi tujuan dibuat satu WorkItem baru = Assignment, anak dari Master Card
 * sumber. Item sumber tetap di board CS sebagai representasi Master Card.
 * body: { target_division_id | target_division_ids[], target_list_id?, assign_to_user_id?,
 *         title?, description?, note?, priority?, due_date? }
 */
router.post('/work-items/:item_id/send-to-division', async (c) => {
  await requirePerm(c, 'bankdata.send_to_division');
  const user = c.get('user');
  const itemId = c.req.param('item_id');
  const body = await c.req.json();
  const item = await getItemChecked(itemId, user);

  // Hanya Owner Master Card, pembuat kartu, atau admin/supervisor yang boleh mengirim.
  const mcSend = item.masterCardId ? await prisma.masterCard.findUnique({ where: { id: item.masterCardId } }) : null;
  const isOwnerOrCreator = item.createdById === user.id || mcSend?.ownerUserId === user.id;
  if (!TAKEOVER_ROLES.includes(user.role) && !isOwnerOrCreator) {
    return c.json({ error: 'Hanya pemilik kartu (CS) atau supervisor yang dapat mengirim pekerjaan.' }, 403);
  }

  const targetDivIds: string[] = body.target_division_ids?.length
    ? body.target_division_ids
    : (body.target_division_id ? [body.target_division_id] : []);
  if (!targetDivIds.length) return c.json({ error: 'Divisi tujuan diperlukan' }, 400);

  const direct = !!body.assign_to_user_id;
  const title = (body.title || item.title).trim();
  // Deskripsi HANYA warisan dari Master Card (info klien & layanan). Catatan untuk
  // penerima TIDAK masuk deskripsi — dikirim sebagai komentar pertama di bawah.
  const description = body.description ?? item.description ?? '';
  const receiverNote = (body.note ?? '').trim();
  const priority = PRIORITIES.includes(body.priority) ? body.priority : (item.priority || 'none');
  const dueDate = body.due_date ?? item.dueDate ?? null;

  const created: { id: string; division: string }[] = [];
  let mcId = '';

  await prisma.$transaction(async (tx) => {
    mcId = await ensureMasterCard(tx, item);
    // sumber ditandai sebagai Master Card yang sedang punya assignment berjalan
    await tx.workItem.update({ where: { id: item.id }, data: { workStatus: item.workStatus || 'IN_PROGRESS', updatedAt: new Date() } });

    for (const divId of targetDivIds) {
      const single = targetDivIds.length === 1;
      
      let currentDirect = direct;
      let currentAssignTo = body.assign_to_user_id;

      // Tidak ada auto-assign round-robin: CS (atau divisi lain) tanpa
      // assign_to_user_id eksplisit SELALU jatuh ke Bank Data (AVAILABLE,
      // belum ada PIC/Owner) — menunggu ada yang klaim secara manual (§7.2 PRD).
      const div = await tx.division.findUnique({ where: { id: divId } });

      const resolved = await resolveDivisionBoardList(
        tx,
        divId,
        single ? body.target_board_id : undefined,
        single ? body.target_list_id : undefined,
      );
      if (!resolved.board || !resolved.listId) throw new Error('Divisi tujuan belum punya board/list yang valid');
      const targetBoardId = resolved.board.id;
      let listId = resolved.listId;

      // Direct assignment → langsung ke board PIC
      let boardId = targetBoardId;
      if (currentDirect && currentAssignTo) {
        const pb = await resolveDivisionBoardListByCreator(tx, currentAssignTo);
        if (pb.board && pb.listId) { boardId = pb.board.id; listId = pb.listId; }
      }

      const count = await tx.workItem.count({ where: { listId } });
      const assignment = await tx.workItem.create({
        data: {
          id: newId(),
          title,
          clientName: item.clientName || null,
          description,
          boardId,
          listId,
          position: (count + 1) * 1000,
          priority,
          dueDate,
          status: 'active',
          createdById: user.id,
          createdByName: user.name,
          masterCardId: mcId,
          sourceUserId: user.id,
          sourceBoardId: item.boardId,
          sourceListId: item.listId,
          targetDivisionId: divId,
          targetBoardId,
          targetListId: listId,
          distributionStatus: currentDirect ? 'DIRECT_ASSIGNED' : 'AVAILABLE',
          workStatus: currentDirect ? 'CLAIMED' : 'WAITING_CLAIM',
          currentPicId: currentDirect ? currentAssignTo : null,
          claimedAt: currentDirect ? new Date() : null,
          divisionIds: { create: [{ divisionId: divId }] },
          ...(currentDirect ? { members: { create: [{ userId: currentAssignTo }] } } : {}),

        },
      });
      if (currentDirect) {
        await tx.workItemAssignmentHistory.create({
          data: { id: newId(), workItemId: assignment.id, toUserId: currentAssignTo, action: 'DIRECT_ASSIGN', createdById: user.id },
        });
      }
      created.push({ id: assignment.id, division: div?.name || divId });
    }
  });

  for (const a of created) {
    await logActivity(a.id, null, user, `mengirim pekerjaan "${title}" ke Bank Data ${a.division}`);
    await notify([user.id], 'sent', 'Pekerjaan terkirim', `Pekerjaan "${title}" berhasil dikirim ke Bank Data ${a.division}.`, a.id, null);
    if (receiverNote) {
      await prisma.comment.create({
        data: {
          workItemId: a.id,
          createdById: user.id,
          createdByName: user.name,
          text: `📩 Catatan dari ${user.name} saat mengirim pekerjaan:\n\n${receiverNote}`,
        },
      });
    }
    if (direct && body.assign_to_user_id) {
      await notify([body.assign_to_user_id], 'assigned', 'Anda ditugaskan', `${user.name} menugaskan Anda pada "${title}".`, a.id, null, new Set([user.id]));
    }
  }
  await logActivity(item.id, item.boardId, user, `membuat ${created.length} assignment dari "${item.title}"`);

  // Label single source of truth: pastikan assignment baru ikut label grup.
  // Kalau Master Card belum punya sharedLabels, ambil dari label lokal kartu sumber.
  try {
    const mcRow = await prisma.masterCard.findUnique({ where: { id: mcId } });
    let shared = normLabelList(mcRow?.sharedLabels);
    if (!shared.length) {
      const srcLabels = (item.labels || []).map((l: any) => l.labelId);
      shared = await labelIdsToShared(srcLabels);
    }
    if (shared.length) await syncGroupLabels(mcId, shared, user);
  } catch (e) { console.error('[send-to-division syncGroupLabels]', e); }

  await broadcastItem(await getWorkItem(item.id));
  return c.json({ ok: true, master_card_id: mcId, assignment_ids: created.map((x) => x.id) });
});

router.post('/work-items/:item_id/mirror', async (c) => {
  const user = c.get('user');
  const itemId = c.req.param('item_id');
  const body = await c.req.json();
  const item = await getItemChecked(itemId, user);
  const target = await prisma.board.findUnique({ where: { id: body.board_id }, include: { members: true } });
  if (!target || !canViewBoard(user, target)) return c.json({ error: 'Tidak ada akses' }, 403);
  
  if (item.boardId === body.board_id || item.mirrorBoards.some((m: any) => m.boardId === body.board_id)) {
    return c.json({ error: 'Sudah ada' }, 400);
  }
  
  await prisma.workItem.update({
    where: { id: itemId },
    data: { mirrorBoards: { create: { boardId: body.board_id } }, updatedAt: new Date() }
  });
  await logActivity(itemId, item.boardId, user, `me-mirror "${item.title}" ke board ${target.name}`);
  await broadcastItem(await getWorkItem(itemId));
  return c.json({ ok: true });
});

router.post('/work-items/:item_id/unmirror', async (c) => {
  const user = c.get('user');
  const itemId = c.req.param('item_id');
  const body = await c.req.json();
  const item = await getItemChecked(itemId, user);
  
  await prisma.workItem.update({
    where: { id: itemId },
    data: { mirrorBoards: { deleteMany: { boardId: body.board_id } }, updatedAt: new Date() }
  });
  await logActivity(itemId, item.boardId, user, `menghapus mirror "${item.title}"`);
  await broadcastItem(await getWorkItem(itemId));
  return c.json({ ok: true });
});

// Untuk kartu grup Bank Data: checklist & deskripsi = milik Master Card rep
// (canonical). Semua sibling (assignment) menampilkan & mengubah yang sama.
async function canonicalItem(item) {
  if (!item || !item.masterCardId || !item.targetDivisionId) return item;
  const rep = await prisma.workItem.findFirst({ where: { masterCardId: item.masterCardId, targetDivisionId: null } });
  return rep || item;
}

/**
 * Versi batch dari canonicalItem() — buat endpoint LISTING (kalender, pencarian,
 * peta HARI, daftar "Semua Pekerjaan") yang menampilkan banyak kartu sekaligus.
 * Judul & nama klien kartu grup (assignment) = satu sumber di Master Card rep
 * (lihat komentar di GET /work-items/:item_id) — tanpa ini, listing tetap
 * menampilkan judul lama walau sudah diubah dari kartu master.
 * Return: Map<masterCardId, {title, clientName}> untuk item yang PUNYA host lain.
 */
async function hostTitlesByMasterCardId(items: { masterCardId: string | null; targetDivisionId: string | null }[]) {
  const mcIds = [...new Set(items.filter((i) => i.masterCardId && i.targetDivisionId).map((i) => i.masterCardId as string))];
  if (!mcIds.length) return {} as Record<string, { title: string; clientName: string | null }>;
  const reps = await prisma.workItem.findMany({
    where: { masterCardId: { in: mcIds }, targetDivisionId: null },
    select: { masterCardId: true, title: true, clientName: true },
  });
  const map: Record<string, { title: string; clientName: string | null }> = {};
  for (const r of reps) if (r.masterCardId) map[r.masterCardId] = { title: r.title, clientName: r.clientName };
  return map;
}
/** Judul kanonik satu item, pakai hasil hostTitlesByMasterCardId(). */
function canonTitle(i: { masterCardId: string | null; targetDivisionId: string | null; title: string }, hostMap: Record<string, { title: string; clientName: string | null }>) {
  if (i.masterCardId && i.targetDivisionId && hostMap[i.masterCardId]) return hostMap[i.masterCardId].title;
  return i.title;
}
function canonClientName(i: { masterCardId: string | null; targetDivisionId: string | null; clientName: string | null }, hostMap: Record<string, { title: string; clientName: string | null }>) {
  if (i.masterCardId && i.targetDivisionId && hostMap[i.masterCardId]) return hostMap[i.masterCardId].clientName ?? i.clientName;
  return i.clientName;
}
function normChecklists(v) {
  let cl = v;
  if (typeof cl === 'string') { try { cl = JSON.parse(cl); } catch { cl = []; } }
  return Array.isArray(cl) ? cl : [];
}

// ── WATCH / UNWATCH ──────────────────────────────────────────────────────
router.post('/work-items/:item_id/watch', async (c) => {
  const user = c.get('user');
  const itemId = c.req.param('item_id');
  const item = await getItemChecked(itemId, user);
  const ids = Array.isArray(item.watcherUserIds) ? item.watcherUserIds : [];
  if (!ids.includes(user.id)) {
    await prisma.workItem.update({ where: { id: itemId }, data: { watcherUserIds: [...ids, user.id] } });
  }
  await broadcastItem(await getWorkItem(itemId));
  return c.json({ ok: true, watching: true });
});

router.post('/work-items/:item_id/unwatch', async (c) => {
  const user = c.get('user');
  const itemId = c.req.param('item_id');
  const item = await getItemChecked(itemId, user);
  const ids = Array.isArray(item.watcherUserIds) ? item.watcherUserIds : [];
  if (ids.includes(user.id)) {
    await prisma.workItem.update({ where: { id: itemId }, data: { watcherUserIds: ids.filter((x) => x !== user.id) } });
  }
  await broadcastItem(await getWorkItem(itemId));
  return c.json({ ok: true, watching: false });
});

// ── CHECKLISTS (shared via Master Card rep untuk kartu grup) ──────────────
router.post('/work-items/:item_id/checklists', async (c) => {
  await requirePerm(c, 'card.edit');
  const user = c.get('user');
  const itemId = c.req.param('item_id');
  const body = await c.req.json();
  const item = await getItemChecked(itemId, user);
  { const _d = await editDenied(c, user, item); if (_d) return _d; }
  const host = await canonicalItem(item);
  const checklists = normChecklists(host.checklists);
  const cl = { id: newId(), title: body.title.trim(), items: [] };
  checklists.push(cl);
  await prisma.workItem.update({ where: { id: host.id }, data: { checklists, updatedAt: new Date() } });
  await logActivity(host.id, host.boardId, user, `menambahkan checklist "${body.title}"`);
  await broadcastItem(await getWorkItem(host.id));
  return c.json({ ok: true, id: cl.id });
});

router.delete('/work-items/:item_id/checklists/:cl_id', async (c) => {
  await requirePerm(c, 'card.edit');
  const user = c.get('user');
  const itemId = c.req.param('item_id');
  const clId = c.req.param('cl_id');
  const item = await getItemChecked(itemId, user);
  { const _d = await editDenied(c, user, item); if (_d) return _d; }
  const host = await canonicalItem(item);
  const deleted = normChecklists(host.checklists).find((x) => x.id === clId);
  const checklists = normChecklists(host.checklists).filter((x) => x.id !== clId);
  await prisma.workItem.update({ where: { id: host.id }, data: { checklists, updatedAt: new Date() } });
  if (deleted) await logActivity(host.id, host.boardId, user, `menghapus checklist "${deleted.title}"`);
  await broadcastItem(await getWorkItem(host.id));
  return c.json({ ok: true });
});

router.post('/work-items/:item_id/checklists/:cl_id/items', async (c) => {
  await requirePerm(c, 'card.edit');
  const user = c.get('user');
  const itemId = c.req.param('item_id');
  const clId = c.req.param('cl_id');
  const body = await c.req.json();
  const item = await getItemChecked(itemId, user);
  { const _d = await editDenied(c, user, item); if (_d) return _d; }
  const host = await canonicalItem(item);
  const checklists = normChecklists(host.checklists);
  const cl = checklists.find((x) => x.id === clId);
  if (cl) cl.items.push({ id: newId(), text: body.text.trim(), done: false });
  await prisma.workItem.update({ where: { id: host.id }, data: { checklists, updatedAt: new Date() } });
  if (cl) await logActivity(host.id, host.boardId, user, `menambahkan item "${body.text.trim()}" pada checklist "${cl.title}"`);
  await broadcastItem(await getWorkItem(host.id));
  return c.json({ ok: true });
});

router.post('/work-items/:item_id/checklists/:cl_id/reorder', async (c) => {
  await requirePerm(c, 'card.edit');
  const user = c.get('user');
  const itemId = c.req.param('item_id');
  const clId = c.req.param('cl_id');
  const body = await c.req.json();
  const item = await getItemChecked(itemId, user);
  { const _d = await editDenied(c, user, item); if (_d) return _d; }
  const host = await canonicalItem(item);
  const checklists = normChecklists(host.checklists);
  const cl = checklists.find((x) => x.id === clId);
  if (cl && body.ordered_ids) {
    const map = new Map(cl.items.map((i) => [i.id, i]));
    cl.items = body.ordered_ids.map((id) => map.get(id)).filter(Boolean);
  }
  await prisma.workItem.update({ where: { id: host.id }, data: { checklists, updatedAt: new Date() } });
  await broadcastItem(await getWorkItem(host.id));
  return c.json({ ok: true });
});

router.patch('/work-items/:item_id/checklists/:cl_id/items/:sub_id', async (c) => {
  await requirePerm(c, 'card.edit');
  const user = c.get('user');
  const itemId = c.req.param('item_id');
  const clId = c.req.param('cl_id');
  const subId = c.req.param('sub_id');
  const body = await c.req.json();
  const item = await getItemChecked(itemId, user);
  { const _d = await editDenied(c, user, item); if (_d) return _d; }
  const host = await canonicalItem(item);
  const checklists = normChecklists(host.checklists);
  const cl = checklists.find((x) => x.id === clId);
  const changes: string[] = [];
  let subText = '';
  if (cl) {
    const sub = cl.items.find((i) => i.id === subId);
    if (sub) {
      subText = sub.text;
      if (body.done !== undefined && body.done !== sub.done) {
        changes.push(body.done ? 'menyelesaikan' : 'membuka kembali');
        sub.done = body.done;
      }
      if (body.text !== undefined) {
        const t = body.text.trim();
        if (t !== sub.text) { changes.push(`mengubah teks menjadi "${t}"`); sub.text = t; }
      }
      if (body.assignee_id !== undefined && body.assignee_id !== sub.assignee_id) {
        changes.push(body.assignee_id ? 'menetapkan penanggung jawab' : 'menghapus penanggung jawab');
        sub.assignee_id = body.assignee_id;
      }
      if (body.due_date !== undefined && body.due_date !== sub.due_date) {
        changes.push(body.due_date ? 'mengatur tenggat' : 'menghapus tenggat');
        sub.due_date = body.due_date;
      }
      // Bukti kelengkapan (opsional): tautkan item checklist ke satu
      // lampiran ATAU satu komentar yang membuktikan item itu sudah ada.
      if (body.evidence_attachment_id !== undefined && body.evidence_attachment_id !== sub.evidence_attachment_id) {
        changes.push(body.evidence_attachment_id ? 'menautkan bukti lampiran' : 'menghapus tautan bukti');
        sub.evidence_attachment_id = body.evidence_attachment_id;
        sub.evidence_comment_id = null;
        sub.evidence_linked_at = body.evidence_attachment_id ? new Date().toISOString() : null;
      } else if (body.evidence_comment_id !== undefined && body.evidence_comment_id !== sub.evidence_comment_id) {
        changes.push(body.evidence_comment_id ? 'menautkan bukti komentar' : 'menghapus tautan bukti');
        sub.evidence_comment_id = body.evidence_comment_id;
        sub.evidence_attachment_id = null;
        sub.evidence_linked_at = body.evidence_comment_id ? new Date().toISOString() : null;
      }
    }
  }
  await prisma.workItem.update({ where: { id: host.id }, data: { checklists, updatedAt: new Date() } });
  if (changes.length) await logActivity(host.id, host.boardId, user, `${changes.join(', ')} item checklist "${subText}"`);
  await broadcastItem(await getWorkItem(host.id));
  return c.json({ ok: true });
});

router.delete('/work-items/:item_id/checklists/:cl_id/items/:sub_id', async (c) => {
  await requirePerm(c, 'card.edit');
  const user = c.get('user');
  const itemId = c.req.param('item_id');
  const clId = c.req.param('cl_id');
  const subId = c.req.param('sub_id');
  const item = await getItemChecked(itemId, user);
  const host = await canonicalItem(item);
  const checklists = normChecklists(host.checklists);
  const cl = checklists.find((x) => x.id === clId);
  const deletedSub = cl?.items.find((i) => i.id === subId);
  if (cl) cl.items = cl.items.filter((i) => i.id !== subId);
  await prisma.workItem.update({ where: { id: host.id }, data: { checklists, updatedAt: new Date() } });
  if (deletedSub) await logActivity(host.id, host.boardId, user, `menghapus item checklist "${deletedSub.text}"`);
  await broadcastItem(await getWorkItem(host.id));
  return c.json({ ok: true });
});

router.get('/notifications/mine', async (c) => {
  const user = c.get('user');
  const rows = await prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 40 });
  const unread = await prisma.notification.count({ where: { userId: user.id, isRead: false } });
  const items = rows.map((n: any) => ({
    id: n.id,
    type: n.type || 'info',
    title: n.title,
    body: n.body,
    is_read: n.isRead,
    board_id: n.boardId || null,
    work_item_id: n.workItemId || null,
    created_at: n.createdAt,
  }));
  return c.json({ items, unread });
});

router.post('/notifications/read-all', async (c) => {
  const user = c.get('user');
  await prisma.notification.updateMany({ where: { userId: user.id }, data: { isRead: true } });
  return c.json({ ok: true });
});

router.post('/notifications/:notif_id/read', async (c) => {
  const user = c.get('user');
  await prisma.notification.updateMany({ where: { id: c.req.param('notif_id'), userId: user.id }, data: { isRead: true } });
  return c.json({ ok: true });
});

router.get('/my-work', async (c) => {
  const user = c.get('user');
  const items = await prisma.workItem.findMany({
    where: { members: { some: { userId: user.id } }, archived: false },
    orderBy: { dueDate: 'asc' },
    include: { board: true, list: true }
  });
  const hostMap = await hostTitlesByMasterCardId(items);
  return c.json(items.map((i: any) => ({
    ...formatWorkItem(i), title: canonTitle(i, hostMap), client_name: canonClientName(i, hostMap) || null,
    board_name: i.board.name, list_name: i.list.name,
  })));
});

/**
 * Kalender: pekerjaan dengan tenggat (dueDate) di bulan tertentu.
 * ?month=YYYY-MM. Supervisor/admin melihat semua; user lain melihat pekerjaan
 * yang melibatkan dirinya (anggota / PIC / pembuat).
 */
router.get('/calendar', async (c) => {
  const user = c.get('user');
  const month = (c.req.query('month') || '').trim(); // YYYY-MM
  const m = /^\d{4}-\d{2}$/.test(month)
    ? month
    : new Date().toISOString().slice(0, 7);

  const where: any = {
    archived: false,
    dueDate: { gte: `${m}-01`, lte: `${m}-31` },
  };
  if (!SUPERVISOR_ROLES.includes(user.role)) {
    where.OR = [
      { members: { some: { userId: user.id } } },
      { currentPicId: user.id },
      { createdById: user.id },
    ];
  }

  const items = await prisma.workItem.findMany({
    where,
    orderBy: { dueDate: 'asc' },
    include: { board: true, list: true, currentPic: true, members: true },
  });
  const hostMap = await hostTitlesByMasterCardId(items);

  return c.json(items.map((i: any) => ({
    id: i.id,
    title: canonTitle(i, hostMap),
    client_name: canonClientName(i, hostMap) || null,
    due_date: i.dueDate,
    status: i.status,
    priority: i.priority || 'none',
    board_id: i.boardId,
    board_name: i.board?.name || null,
    board_background: i.board?.background || null,
    list_name: i.list?.name || null,
    pic_name: i.currentPic?.name || null,
    is_assignment: !!i.targetDivisionId,
    member_ids: (i.members || []).map((x: any) => x.userId),
  })));
});

router.get('/work-items', async (c) => {
  const user = c.get('user');
  requireSupervisor(user);
  const division_id = c.req.query('division_id');
  const status = c.req.query('status');
  const q = c.req.query('q');
  
  const where: any = { archived: false };
  if (division_id) where.divisionIds = { some: { divisionId: division_id } };
  if (status) where.status = status;
  if (q) where.OR = [{ title: { contains: q, mode: 'insensitive' } }, { clientName: { contains: q, mode: 'insensitive' } }];
  
  const items = await prisma.workItem.findMany({
    where, orderBy: { updatedAt: 'desc' },
    include: { board: true, list: true, currentPic: true, members: true },
  });
  const hostMap = await hostTitlesByMasterCardId(items);
  return c.json(items.map((i: any) => ({
    ...formatWorkItem(i), title: canonTitle(i, hostMap), client_name: canonClientName(i, hostMap) || null,
    board_name: i.board.name, board_background: i.board.background, list_name: i.list.name,
  })));
});

router.get('/search', async (c) => {
  const user = c.get('user');
  const q = (c.req.query('q') || '').trim();
  if (!q) return c.json({ boards: [], items: [] });

  const boards = await prisma.board.findMany({
    where: { name: { contains: q, mode: 'insensitive' }, isArchived: false },
    take: 10,
  });

  const rows = await prisma.workItem.findMany({
    where: {
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { clientName: { contains: q, mode: 'insensitive' } },
      ],
      archived: false,
    },
    take: 25,
    orderBy: { updatedAt: 'desc' },
    include: {
      board: true,
      list: true,
      currentPic: true,
      targetDivision: true,
      masterCard: { include: { owner: true, ownerDivision: true } },
    },
  });

  const DIST: Record<string, string> = {
    AVAILABLE: 'Menunggu diambil',
    CLAIMED: 'Sudah diambil',
    DIRECT_ASSIGNED: 'Ditugaskan langsung',
    RELEASED: 'Dilepas',
  };

  const hostMap = await hostTitlesByMasterCardId(rows);
  const items = rows.map((w: any) => {
    const isAssignment = !!w.targetDivisionId;
    const isMaster = !!w.masterCardId && !w.targetDivisionId;
    let role: 'master' | 'assignment' | 'plain' = 'plain';
    if (isAssignment) role = 'assignment';
    else if (isMaster) role = 'master';
    return {
      id: w.id,
      title: canonTitle(w, hostMap),
      client_name: canonClientName(w, hostMap) || null,
      board_id: w.boardId,
      board_name: w.board?.name || null,
      list_name: w.list?.name || null,
      pic_name: w.currentPic?.name || null,
      owner_name: w.masterCard?.owner?.name || null,
      role,
      is_assignment: isAssignment,
      is_master: isMaster,
      target_division_name: w.targetDivision?.name || null,
      distribution_label: isAssignment ? (DIST[w.distributionStatus] || null) : null,
      status: w.status,
      is_done: w.status === 'done',
    };
  });

  return c.json({ boards, items });
});

// ── Board Harian (HARI 1-8) & Peta Skor Global ────────────────────────────
// Agregasi lintas board. Bisa dibuka semua user login (read-only); yang boleh
// menggeser kartu di UI hanya super_admin (dibatasi di frontend), sedangkan
// POST /work-items/:id/hari tetap punya guard sendiri.

function daysSince(d: any): number {
  if (!d) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 86400000));
}

function globalCard(w: any, hostMap: Record<string, { title: string; clientName: string | null }> = {}) {
  const enteredAt = w.hariStage ? w.hariEnteredAt : w.updatedAt;
  const days = daysSince(enteredAt);
  return {
    id: w.id,
    title: canonTitle(w, hostMap),
    client_name: canonClientName(w, hostMap) || null,
    board_id: w.boardId,
    board_name: w.board?.name || null,
    board_background: w.board?.background || null,
    list_name: w.list?.name || null,
    hari_stage: w.hariStage || null,
    member_ids: (w.members || []).map((m: any) => m.userId),
    priority: w.priority || 'none',
    due_date: w.dueDate || null,
    status: w.status,
    days_in_stage: days,
    is_stalled: days >= 3 && w.status !== 'done',
  };
}

router.get('/global/hari', async (c) => {
  await requirePerm(c, 'hari.view');
  const rows = await prisma.workItem.findMany({
    where: { archived: false, hariStage: { not: null } },
    include: { board: true, list: true, members: true },
    orderBy: [{ hariStage: 'asc' }, { hariEnteredAt: 'asc' }],
  });
  const hostMap = await hostTitlesByMasterCardId(rows);
  return c.json(rows.map((w) => globalCard(w, hostMap)));
});

router.get('/global/skor', async (c) => {
  await requirePerm(c, 'skor.view');
  // Master Card representation ada di board CS. Bucket berdasarkan prefix "SKOR N"
  // pada nama list. SKOR 7 / KOMPLAIN / COWORKING diabaikan dari peta.
  const csDivisions = await prisma.division.findMany({ where: { key: 'cs' }, select: { id: true } });
  const csDivIds = csDivisions.map((d) => d.id);
  const rows = await prisma.workItem.findMany({
    where: {
      archived: false,
      targetDivisionId: null, // hanya kartu CS / Master Card rep, bukan assignment
      board: { divisionId: { in: csDivIds } },
    },
    include: { board: true, list: true, members: true },
    orderBy: { updatedAt: 'desc' },
  });
  const buckets: Record<string, any[]> = { '1': [], '2': [], '3': [], '4': [], '5': [], '6': [] };
  for (const w of rows) {
    const name = (w.list?.name || '').toUpperCase();
    const m = name.match(/SKOR\s*([1-7])/);
    let key = m ? m[1] : null;
    if (key === '7') key = '6'; // SKOR 7 (data FU kembali) tampil di kolom FINISH
    if (!key) continue;
    if (name.startsWith('SKOR 6') || name.startsWith('SKOR 7')) key = '6';
    (buckets[key] ||= []).push(globalCard(w));
  }
  return c.json(buckets);
});

router.post('/work-items/:item_id/hari', async (c) => {
  await requirePerm(c, 'hari.advance');
  const user = c.get('user');
  const itemId = c.req.param('item_id');
  const body = await c.req.json();
  const item = await getWorkItem(itemId);
  const board = await prisma.board.findUnique({ where: { id: item.boardId }, include: { members: true } });
  if (!board || (!canViewBoard(user, board) && !(await canAccessHari(user)))) return c.json({ error: 'Akses ditolak' }, 403);
  if (!item.hariStage) return c.json({ error: 'Tidak dalam HARI 1-7' }, 400);
  
  const target = body.target_stage;
  if (target < 1 || target > 8) return c.json({ error: 'Tahap tidak valid' }, 400);
  
  if (target > item.hariStage) {
    const gates = Object.entries(STAGE_GATES)
      .filter(([stage]) => item.hariStage! < parseInt(stage) && parseInt(stage) <= target)
      .flatMap(([_, reqs]) => reqs);
    const missing = unmetRequirements(item, gates);
    if (missing.length) {
      if (SUPERVISOR_ROLES.includes(user.role)) {
        await logActivity(itemId, item.boardId, user, `memajukan paksa tanpa syarat: ${missing.join(', ')}`);
      } else {
        return c.json({ error: `Syarat belum terpenuhi: ${missing.join(', ')}` }, 400);
      }
    }
  }
  
  if (target === 8) {
    const lists = await prisma.list.findMany({ where: { boardId: item.boardId }, orderBy: { position: 'asc' } });
    const finishList = lists.find((l: any) => l.name.toUpperCase().startsWith('SKOR 6'));
    const updates: any = { hariStage: null, hariEnteredAt: null, status: 'done', completedAt: new Date(), updatedAt: new Date() };
    if (finishList && finishList.id !== item.listId) updates.listId = finishList.id;
    await prisma.workItem.update({ where: { id: itemId }, data: updates });
    await logActivity(itemId, item.boardId, user, 'menyelesaikan HARI (FINISH)');
  } else {
    await prisma.workItem.update({ where: { id: itemId }, data: { hariStage: target, hariEnteredAt: new Date(), updatedAt: new Date() } });
    await logActivity(itemId, item.boardId, user, `memajukan HARI ${target}`);
  }
  await broadcastItem(await getWorkItem(itemId));
  return c.json({ ok: true, hari_stage: target === 8 ? null : target });
});

export default router;

router.post('/work-items/:item_id/comments', async (c) => {
  await requirePerm(c, 'card.comment');
  const user = c.get('user');
  const itemId = c.req.param('item_id');
  const body = await c.req.json();
  const item = await getItemChecked(itemId, user);
  { const _d = await commentDenied(c, user, item); if (_d) return _d; }
  
  const comment = await prisma.comment.create({
    data: {
      workItemId: itemId,
      createdById: user.id,
      createdByName: user.name,
      text: body.text.trim(),
      attachmentId: body.attachment_id || null,
    }
  });
  
  await logActivity(itemId, item.boardId, user, "menambahkan komentar");
  const snippet = body.text.replace(/<[^>]+>/g, '').trim().slice(0, 90);
  const mentionIds: string[] = Array.isArray(body.mention_user_ids) ? body.mention_user_ids.filter(Boolean) : [];
  const mentionSet = new Set(mentionIds);

  if (mentionIds.length) {
    await notify(mentionIds, 'mention', 'Anda disebut', `${user.name} menyebut Anda di "${item.title}": ${snippet}`, itemId, item.boardId, new Set([user.id]));
  }
  // Notif komentar ke sisa grup Master Card (Owner + semua PIC + pembuat), kecuali penulis & yang sudah di-mention.
  const gIds = (await groupNotifyIds(item)).filter((id) => !mentionSet.has(id));
  await notify(gIds, 'comment', 'Komentar baru', `${user.name} di "${item.title}": ${snippet}`, itemId, item.boardId, new Set([user.id]));
  await broadcastItem(await getWorkItem(itemId));

  return c.json({ ok: true });
});

router.patch('/comments/:comment_id', async (c) => {
  await requirePerm(c, 'card.comment');
  const user = c.get('user');
  const commentId = c.req.param('comment_id');
  const body = await c.req.json();
  
  const comment = await prisma.comment.findUnique({ where: { id: commentId } });
  if (!comment) return c.json({ error: "Komentar tidak ditemukan" }, 404);
  if (comment.createdById !== user.id && user.role !== "super_admin") return c.json({ error: "Tidak ada akses" }, 403);
  
  await prisma.comment.update({
    where: { id: commentId },
    data: { text: body.text.trim() }
  });
  
  const item = await getWorkItem(comment.workItemId);
  await logActivity(item.id, item.boardId, user, "mengubah komentar");
  await broadcastItem(item);
  return c.json({ ok: true });
});

router.delete('/comments/:comment_id', async (c) => {
  await requirePerm(c, 'card.comment');
  const user = c.get('user');
  const commentId = c.req.param('comment_id');
  
  const comment = await prisma.comment.findUnique({ where: { id: commentId } });
  if (!comment) return c.json({ error: "Komentar tidak ditemukan" }, 404);
  if (comment.createdById !== user.id && user.role !== "super_admin") return c.json({ error: "Tidak ada akses" }, 403);
  
  await prisma.comment.delete({ where: { id: commentId } });

  const item = await getWorkItem(comment.workItemId);
  await logActivity(item.id, item.boardId, user, "menghapus komentar");
  await broadcastItem(item);
  return c.json({ ok: true });
});


router.post('/work-items/:item_id/attachments', async (c) => {
  await requirePerm(c, 'card.edit');
  const user = c.get('user');
  const itemId = c.req.param('item_id');
  const item = await getItemChecked(itemId, user);
  { const _d = await commentDenied(c, user, item); if (_d) return _d; }
  
  const body = await c.req.parseBody();
  const file = body['file'] as File;
  if (!file) return c.json({ error: "No file uploaded" }, 400);
  
  const originalFilename = file.name || "unnamed";
  const contentType = file.type || "application/octet-stream";
  const size = file.size;
  const buffer = Buffer.from(await file.arrayBuffer());
  
  const storagePath = `${itemId}/${uuidv4()}_${originalFilename}`;
  await putObject(storagePath, buffer, contentType);
  
  const att = await prisma.attachment.create({
    data: {
      workItemId: itemId,
      originalFilename,
      contentType,
      size,
      storagePath,
      uploadedById: user.id,
      uploadedByName: user.name,
    }
  });
  
  await logActivity(itemId, item.boardId, user, `mengunggah lampiran "${originalFilename}"`);
  await runAutomation(item.boardId, 'attachment_uploaded', item, user, item.listId);
  await broadcastItem(await getWorkItem(itemId));
  return c.json({ id: att.id, work_item_id: att.workItemId, original_filename: att.originalFilename, content_type: att.contentType, size: att.size, uploaded_by_name: att.uploadedByName, uploaded_by_id: att.uploadedById, created_at: att.createdAt, external_url: att.storagePath });
});

router.post('/work-items/:item_id/attachments/link', async (c) => {
  await requirePerm(c, 'card.edit');
  const user = c.get('user');
  const itemId = c.req.param('item_id');
  const item = await getItemChecked(itemId, user);
  const body = await c.req.json();
  
  const att = await prisma.attachment.create({
    data: {
      workItemId: itemId,
      originalFilename: body.name || body.url,
      contentType: "link",
      storagePath: body.url,
      uploadedById: user.id,
      uploadedByName: user.name,
    }
  });
  
  await logActivity(itemId, item.boardId, user, `menambahkan tautan "${att.originalFilename}"`);
  await broadcastItem(await getWorkItem(itemId));
  return c.json({ id: att.id, work_item_id: att.workItemId, original_filename: att.originalFilename, content_type: att.contentType, size: att.size, uploaded_by_name: att.uploadedByName, uploaded_by_id: att.uploadedById, created_at: att.createdAt, external_url: att.storagePath });
});

router.get('/attachments/:id/download', async (c) => {
  const id = c.req.param('id');
  const att = await prisma.attachment.findUnique({ where: { id } });
  if (!att || att.isDeleted || !att.storagePath) return c.text("Not found", 404);
  
  try {
    const { data, contentType } = await getObject(att.storagePath);
    return new Response(data, {
      headers: {
        "Content-Type": att.contentType || contentType,
        "Content-Disposition": `inline; filename="${att.originalFilename}"`
      }
    });
  } catch (e: any) {
    return c.text("Failed to download", 500);
  }
});

router.delete('/attachments/:id', async (c) => {
  await requirePerm(c, 'card.edit');
  const user = c.get('user');
  const id = c.req.param('id');
  const att = await prisma.attachment.findUnique({ where: { id } });
  if (!att) return c.json({ error: "Not found" }, 404);
  
  if (att.uploadedById !== user.id && user.role !== "super_admin") return c.json({ error: "Forbidden" }, 403);
  
  await prisma.attachment.update({ where: { id }, data: { isDeleted: true } });
  
  const item = await getWorkItem(att.workItemId);
  await logActivity(att.workItemId, item.boardId, user, `menghapus lampiran "${att.originalFilename}"`);
  await broadcastItem(item);
  return c.json({ ok: true });
});

/**
 * Flow B (§7.2) — Client offline: buat pekerjaan baru langsung ke Bank Data suatu divisi.
 * Master Card dibuat TANPA owner; owner ditetapkan saat CS meng-claim (di /claim).
 * body: { title*, client_name?, note?, target_division_id*, target_list_id?, priority?, due_date?, assign_to_user_id? }
 */
router.post('/bank-data/intake', async (c) => {
  await requirePerm(c, 'bankdata.intake');
  const user = c.get('user');
  const body = await c.req.json();
  if (!body.title?.trim()) return c.json({ error: 'Judul pekerjaan wajib diisi' }, 400);
  if (!body.target_division_id) return c.json({ error: 'Divisi tujuan diperlukan' }, 400);

  const direct = !!body.assign_to_user_id;
  const priority = PRIORITIES.includes(body.priority) ? body.priority : 'none';

  let result: any = {};
  await prisma.$transaction(async (tx) => {
    const resolved = await resolveDivisionBoardList(tx, body.target_division_id, body.target_board_id, body.target_list_id);
    if (!resolved.board || !resolved.listId) throw new Error('Divisi tujuan belum punya board/list yang valid');
    const targetBoard = resolved.board;
    let listId = resolved.listId;

    let currentDirect = direct;
    let currentAssignTo = body.assign_to_user_id;

    // Tidak ada auto-assign round-robin: client offline yang masuk ke Bank Data
    // Customer Service tanpa assign_to_user_id eksplisit SELALU belum ber-Owner
    // (AVAILABLE) — Owner Master Card baru ditetapkan saat ada CS yang claim (Flow B, §7.2 PRD).
    const div = await tx.division.findUnique({ where: { id: body.target_division_id } });

    const mc = await tx.masterCard.create({
      data: { title: body.title.trim(), client: body.client_name?.trim() || null, ownerUserId: currentDirect ? currentAssignTo : null, ownerDivisionId: div?.id || null },
    });

    let boardId = targetBoard.id;
    if (currentDirect) {
      const pb = await resolveDivisionBoardListByCreator(tx, currentAssignTo);
      if (pb.board && pb.listId) { boardId = pb.board.id; listId = pb.listId; }
    }

    const count = await tx.workItem.count({ where: { listId } });
    const assignment = await tx.workItem.create({
      data: {
        id: newId(),
        title: body.title.trim(),
        clientName: body.client_name?.trim() || null,
        description: body.note?.trim() || '',
        boardId,
        listId,
        position: (count + 1) * 1000,
        priority,
        dueDate: body.due_date || null,
        status: 'active',
        createdById: user.id,
        createdByName: user.name,
        masterCardId: mc.id,
        sourceUserId: user.id,
        targetDivisionId: body.target_division_id,
        targetBoardId: targetBoard.id,
        targetListId: listId,
        distributionStatus: currentDirect ? 'DIRECT_ASSIGNED' : 'AVAILABLE',
        workStatus: currentDirect ? 'CLAIMED' : 'WAITING_CLAIM',
        currentPicId: currentDirect ? currentAssignTo : null,
        claimedAt: currentDirect ? new Date() : null,
        divisionIds: { create: [{ divisionId: body.target_division_id }] },
        ...(currentDirect ? { members: { create: [{ userId: currentAssignTo }] } } : {}),
      },
    });
    if (currentDirect) {
      await tx.workItemAssignmentHistory.create({
        data: { id: newId(), workItemId: assignment.id, toUserId: currentAssignTo, action: 'DIRECT_ASSIGN', createdById: user.id },
      });
    }
    result = { assignment_id: assignment.id, master_card_id: mc.id };
  });

  const divForLog = await prisma.division.findUnique({ where: { id: body.target_division_id } });
  await logActivity(result.assignment_id, null, user, `input pekerjaan client offline "${body.title.trim()}" ke Bank Data ${divForLog?.name || ''}`);
  await notify([user.id], 'sent', 'Pekerjaan terkirim', `Pekerjaan "${body.title.trim()}" berhasil masuk Bank Data ${divForLog?.name || ''}.`, result.assignment_id, null);
  
  let finalAssignTo = body.assign_to_user_id;
  if (!finalAssignTo) {
      const assignmentRecord = await prisma.workItem.findUnique({ where: { id: result.assignment_id }});
      if (assignmentRecord?.currentPicId) finalAssignTo = assignmentRecord.currentPicId;
  }
  
  if (finalAssignTo) {
    await notify([finalAssignTo], 'assigned', 'Anda ditugaskan', `${user.name} menugaskan Anda pada "${body.title.trim()}".`, result.assignment_id, null, new Set([user.id]));
  }
  await broadcastItem(await getWorkItem(result.assignment_id));
  return c.json({ ok: true, ...result });
});

// Ringkasan jumlah pekerjaan MENUNGGU per divisi (untuk badge sidebar/tab) — §9.3
router.get('/bank-data/summary', async (c) => {
  const divisions = await prisma.division.findMany({ orderBy: { name: 'asc' } });
  const grouped = await prisma.workItem.groupBy({
    by: ['targetDivisionId'],
    where: { archived: false, masterCardId: { not: null }, distributionStatus: 'AVAILABLE' },
    _count: { _all: true },
  });
  const waitingBy: Record<string, number> = {};
  for (const g of grouped) if (g.targetDivisionId) waitingBy[g.targetDivisionId] = g._count._all;
  return c.json(
    divisions.map((d: any) => ({
      division_id: d.id,
      name: d.name,
      key: d.key,
      color: d.color,
      waiting: waitingBy[d.id] || 0,
    })),
  );
});

router.get('/bank-data/:division_id', async (c) => {
  const user = c.get('user');
  const divisionId = c.req.param('division_id');
  
  const division = await prisma.division.findUnique({ where: { id: divisionId } });
  if (!division) return c.json({ error: 'Divisi tidak ditemukan' }, 404);

  const boards = await prisma.board.findMany({
    where: { divisionId: divisionId, isArchived: false },
    include: { lists: { where: { archived: false }, orderBy: { position: 'asc' } } }
  });

  const items = await prisma.workItem.findMany({
    where: {
      targetDivisionId: divisionId,
      archived: false,
      masterCardId: { not: null }, // hanya Assignment (bukan kartu biasa)
    },
    orderBy: [{ distributionStatus: 'asc' }, { createdAt: 'asc' }],
    include: {
      board: true,
      list: true,
      currentPic: true,
      members: true,
      sourceUser: true,
      masterCard: { include: { owner: true } },
    },
  });

  const usersInDiv = await prisma.user.findMany({ where: { divisionId: divisionId, isActive: true } });
  const workload = usersInDiv.map((u: any) => {
    const mine = items.filter((i: any) => i.currentPicId === u.id && i.workStatus !== 'COMPLETED' && i.status !== 'done');
    const by_list: Record<string, number> = {};
    for (const i of mine) {
      const name = i.list?.name || 'Tanpa List';
      by_list[name] = (by_list[name] || 0) + 1;
    }
    return {
      user: { id: u.id, name: u.name, avatar_color: u.avatarColor },
      total: mine.length,
      claimed: mine.length,
      available_in_bank: items.filter((i: any) => !i.currentPicId).length,
      by_list,
    };
  });

  const hostMap = await hostTitlesByMasterCardId(items);
  return c.json({
    division,
    boards,
    workload,
    items: items.map((i: any) => ({
      ...formatWorkItem(i),
      title: canonTitle(i, hostMap),
      client_name: canonClientName(i, hostMap) || null,
      board_name: i.board?.name,
      list_name: i.list?.name,
    })),
  });
});
