import { formatWorkItem } from './deps';
// @ts-nocheck
import {  Hono } from 'hono';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

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
async function broadcastItem(item: any) { /* Socket broadcast */ }
async function runAutomation(boardId: string, event: string, item: any, user: any, listId?: string) { /* ... */ }

function canViewBoard(user: any, board: any) { return true; /* Implement logic */ }
function requireSupervisor(user: any) { if (!SUPERVISOR_ROLES.includes(user.role)) throw new Error('Forbidden'); }

async function getWorkItem(id: string) {
  const item = await prisma.workItem.findUnique({ where: { id }, include: { members: true, divisionIds: true, labels: true, mirrorBoards: true } });
  if (!item) throw new Error('Not found');
  return item;
}

async function getItemChecked(id: string, user: any) {
  const item = await getWorkItem(id);
  // check board access
  return item;
}

function doneChecklistTexts(item: any) {
  const done: string[] = [];
  const checklists = (item.checklists as any[]) || [];
  for (const cl of checklists) {
    for (const it of cl.items || []) {
      if (it.done) done.push((it.text || '').toLowerCase());
    }
  }
  return done;
}
function unmetRequirements(item: any, required: string[]) {
  const done = doneChecklistTexts(item);
  return (required || []).filter(req => {
    const r = req.trim().toLowerCase();
    return r && !done.some(t => t.includes(r));
  });
}
async function ensureRequirementChecklist(item: any, lst: any) {
  const reqs = (lst.entryRequirements as string[]) || [];
  if (!reqs.length) return;
  const checklists = (item.checklists as any[]) || [];
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
  const user = c.get('user');
  const body = await c.req.json();
  const board = await prisma.board.findUnique({ where: { id: body.board_id } });
  const lst = await prisma.list.findFirst({ where: { id: body.list_id, boardId: body.board_id } });
  if (!lst) return c.json({ error: 'List not found' }, 404);
  const count = await prisma.workItem.count({ where: { listId: body.list_id, archived: false } });
  
  const divIds = body.division_ids?.length ? body.division_ids : (board?.divisionId ? [board.divisionId] : []);
  
  const item = await prisma.workItem.create({
    data: {
      id: newId(), title: body.title.trim(), clientName: body.clientName?.trim() || '', description: body.description || '',
      boardId: body.board_id, listId: body.list_id, position: (count + 1) * 1000.0,
      dueDate: body.due_date || null, priority: PRIORITIES.includes(body.priority) ? body.priority : 'none',
      status: 'active', archived: false, needsApproval: !!body.needs_approval,
      createdById: user.id, createdByName: user.name,
      checklists: [],
      labels: { create: (body.label_ids || []).map((id: string) => ({ labelId: id })) },
      members: { create: (body.member_ids || []).map((id: string) => ({ userId: id })) },
      divisionIds: { create: divIds.map((id: string) => ({ divisionId: id })) }
    },
    include: { members: true, labels: true, divisionIds: true }
  });
  
  await logActivity(item.id, item.boardId, user, `membuat pekerjaan "${item.title}"`);
  await ensureRequirementChecklist(item, lst);
  await runAutomation(item.boardId, 'card_created', item, user, item.listId);
  if (body.member_ids?.length) {
    await notify(body.member_ids, 'assigned', 'Anda ditugaskan', `${user.name} menugaskan Anda pada "${item.title}"`, item.id, item.boardId, new Set([user.id]));
  }
  await broadcastItem(item);
  return c.json(formatWorkItem(item));
});

router.get('/work-items/:item_id', async (c) => {
  const user = c.get('user');
  const itemId = c.req.param('item_id');
  const item = await getItemChecked(itemId, user);
  const comments: any[] = []; // prisma.comment.findMany if schema has it (schema missing Comment, mock for now)
  const attachments = await prisma.attachment.findMany({ where: { workItemId: itemId, isDeleted: false } });
  const activities = await prisma.activity.findMany({ where: { workItemId: itemId }, orderBy: { createdAt: 'desc' }, take: 60 });
  const boardLabels = await prisma.label.findMany({ where: { boardId: item.boardId } });
  const lst = await prisma.list.findUnique({ where: { id: item.listId } });
  const board = await prisma.board.findUnique({ where: { id: item.boardId } });
  return c.json({ item: formatWorkItem(item), comments, attachments, activities, board_labels: boardLabels, list_name: lst?.name, board_name: board?.name, mirror_boards: [] });
});

router.patch('/work-items/:item_id', async (c) => {
  const user = c.get('user');
  const itemId = c.req.param('item_id');
  const item = await getItemChecked(itemId, user);
  const body = await c.req.json();
  const updates: any = {};
  
  const fieldMap: any = { title: 'title', client_name: 'clientName', description: 'description', due_date: 'dueDate', needs_approval: 'needsApproval' };
  for (const [sField, cField] of Object.entries(fieldMap)) {
    if (body[sField] !== undefined) updates[cField as string] = body[sField];
  }
  if (body.cover_color !== undefined) updates.coverColor = body.cover_color;
  if (body.cover_attachment_id !== undefined) updates.coverAttachmentId = body.cover_attachment_id;

  if (body.priority && PRIORITIES.includes(body.priority)) updates.priority = body.priority;
  if (Object.keys(updates).length === 0 && !body.label_ids) return c.json(formatWorkItem(item));
  
  const updateData: any = { ...updates, updatedAt: new Date() };
  if (body.label_ids) {
    updateData.labels = { deleteMany: {}, create: body.label_ids.map((id: string) => ({ labelId: id })) };
  }
  
  const updated = await prisma.workItem.update({ where: { id: itemId }, data: updateData });
  await logActivity(itemId, item.boardId, user, `mengubah pekerjaan "${updated.title}"`);
  await broadcastItem(updated);
  return c.json(formatWorkItem(updated));
});

router.delete('/work-items/:item_id', async (c) => {
  const user = c.get('user');
  if (!ADMIN_ROLES.includes(user.role)) return c.json({ error: 'Hanya admin yang dapat menghapus' }, 403);
  const itemId = c.req.param('item_id');
  const item = await getWorkItem(itemId);
  await prisma.workItem.delete({ where: { id: itemId } });
  await prisma.attachment.updateMany({ where: { workItemId: itemId }, data: { isDeleted: true } });
  await logActivity(null, item.boardId, user, `menghapus pekerjaan "${item.title}"`);
  await broadcastItem(item);
  return c.json({ ok: true });
});

router.post('/work-items/:item_id/move', async (c) => {
  const user = c.get('user');
  const itemId = c.req.param('item_id');
  const body = await c.req.json();
  const item = await getItemChecked(itemId, user);
  const targetList = await prisma.list.findUnique({ where: { id: body.list_id } });
  if (!targetList) return c.json({ error: 'List tujuan tidak ditemukan' }, 404);
  const targetBoard = await prisma.board.findUnique({ where: { id: targetList.boardId } });
  if (!targetBoard || !canViewBoard(user, targetBoard)) return c.json({ error: 'Tidak memiliki akses' }, 403);
  
  const reqs = (targetList.entryRequirements as string[]) || [];
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
  
  const updated = await prisma.workItem.update({
    where: { id: itemId },
    data: { listId: body.list_id, boardId: targetBoard.id, position: body.position, hariStage, hariEnteredAt, updatedAt: new Date() }
  });
  
  await ensureRequirementChecklist(updated, targetList);
  await runAutomation(targetBoard.id, 'card_moved', updated, user, body.list_id);
  await broadcastItem(updated);
  return c.json({ ok: true });
});

router.post('/work-items/:item_id/claim', async (c) => {
  const user = c.get('user');
  const itemId = c.req.param('item_id');
  const item = await getItemChecked(itemId, user);
  const existing = item.members.find((m: any) => m.userId === user.id);
  if (existing) return c.json({ error: 'Sudah menjadi PIC' }, 400);
  
  await prisma.workItem.update({
    where: { id: itemId },
    data: { members: { create: { userId: user.id } }, updatedAt: new Date() }
  });
  await logActivity(itemId, item.boardId, user, `mengambil pekerjaan "${item.title}"`);
  await notify([item.createdById], 'claimed', 'Pekerjaan diambil', `${user.name} mengambil pekerjaan "${item.title}"`, itemId, item.boardId, new Set([user.id]));
  await broadcastItem(await getWorkItem(itemId));
  return c.json({ ok: true });
});

router.post('/work-items/:item_id/release', async (c) => {
  const user = c.get('user');
  const itemId = c.req.param('item_id');
  const body = await c.req.json().catch(() => ({}));
  const item = await getItemChecked(itemId, user);
  
  await prisma.workItem.update({
    where: { id: itemId },
    data: { members: { deleteMany: { userId: user.id } }, updatedAt: new Date() }
  });
  const reason = body.reason ? ` — Alasan: ${body.reason}` : '';
  await logActivity(itemId, item.boardId, user, `melepas pekerjaan "${item.title}"${reason}`);
  await notify([item.createdById], 'released', 'Pekerjaan dilepaskan', `${user.name} melepaskan "${item.title}"${reason}`, itemId, item.boardId, new Set([user.id]));
  await broadcastItem(await getWorkItem(itemId));
  return c.json({ ok: true });
});

router.post('/work-items/:item_id/assign', async (c) => {
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
  if (body.add_user_ids?.length) {
    await logActivity(itemId, item.boardId, user, `menugaskan PIC pada "${item.title}"`);
    await notify(body.add_user_ids, 'assigned', 'Anda ditugaskan', `${user.name} menugaskan Anda pada "${item.title}"`, itemId, item.boardId, new Set([user.id]));
  }
  await broadcastItem(await getWorkItem(itemId));
  return c.json({ ok: true });
});

router.post('/work-items/:item_id/submit', async (c) => {
  const user = c.get('user');
  const itemId = c.req.param('item_id');
  const item = await getItemChecked(itemId, user);
  if (item.status === 'done') return c.json({ error: 'Sudah selesai' }, 400);
  
  if (item.needsApproval) {
    await prisma.workItem.update({ where: { id: itemId }, data: { status: 'submitted', submittedById: user.id, updatedAt: new Date() } });
    await logActivity(itemId, item.boardId, user, `mengajukan penyelesaian "${item.title}"`);
  } else {
    await prisma.workItem.update({ where: { id: itemId }, data: { status: 'done', completedAt: new Date(), updatedAt: new Date() } });
    await logActivity(itemId, item.boardId, user, `menyelesaikan pekerjaan "${item.title}"`);
  }
  const updated = await getWorkItem(itemId);
  await broadcastItem(updated);
  return c.json(formatWorkItem(updated));
});

router.post('/work-items/:item_id/approve', async (c) => {
  const user = c.get('user');
  requireSupervisor(user);
  const itemId = c.req.param('item_id');
  const item = await getItemChecked(itemId, user);
  if (item.status !== 'submitted') return c.json({ error: 'Tidak menunggu persetujuan' }, 400);
  
  await prisma.workItem.update({ where: { id: itemId }, data: { status: 'done', completedAt: new Date(), approvedById: user.id, updatedAt: new Date() } });
  await logActivity(itemId, item.boardId, user, `menyetujui penyelesaian "${item.title}"`);
  const updated = await getWorkItem(itemId);
  await broadcastItem(updated);
  return c.json(formatWorkItem(updated));
});

router.post('/work-items/:item_id/reopen', async (c) => {
  const user = c.get('user');
  const itemId = c.req.param('item_id');
  const item = await getItemChecked(itemId, user);
  await prisma.workItem.update({ where: { id: itemId }, data: { status: 'active', completedAt: null, approvedById: null, updatedAt: new Date() } });
  await logActivity(itemId, item.boardId, user, `membuka kembali pekerjaan "${item.title}"`);
  const updated = await getWorkItem(itemId);
  await broadcastItem(updated);
  return c.json(formatWorkItem(updated));
});

router.post('/work-items/:item_id/archive', async (c) => {
  const user = c.get('user');
  const itemId = c.req.param('item_id');
  const item = await getItemChecked(itemId, user);
  await prisma.workItem.update({ where: { id: itemId }, data: { archived: true, updatedAt: new Date() } });
  await logActivity(itemId, item.boardId, user, `mengarsipkan "${item.title}"`);
  await broadcastItem(await getWorkItem(itemId));
  return c.json({ ok: true });
});

router.post('/work-items/:item_id/unarchive', async (c) => {
  const user = c.get('user');
  const itemId = c.req.param('item_id');
  const item = await getItemChecked(itemId, user);
  await prisma.workItem.update({ where: { id: itemId }, data: { archived: false, updatedAt: new Date() } });
  await logActivity(itemId, item.boardId, user, `mengembalikan "${item.title}" dari arsip`);
  await broadcastItem(await getWorkItem(itemId));
  return c.json({ ok: true });
});

router.post('/work-items/:item_id/mirror', async (c) => {
  const user = c.get('user');
  const itemId = c.req.param('item_id');
  const body = await c.req.json();
  const item = await getItemChecked(itemId, user);
  const target = await prisma.board.findUnique({ where: { id: body.board_id } });
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

router.post('/work-items/:item_id/checklists', async (c) => {
  const user = c.get('user');
  const itemId = c.req.param('item_id');
  const body = await c.req.json();
  const item = await getItemChecked(itemId, user);
  const checklists = (item.checklists as any[]) || [];
  checklists.push({ id: newId(), title: body.title.trim(), items: [] });
  
  await prisma.workItem.update({ where: { id: itemId }, data: { checklists, updatedAt: new Date() } });
  await logActivity(itemId, item.boardId, user, `menambahkan checklist "${body.title}"`);
  await broadcastItem(await getWorkItem(itemId));
  return c.json({ ok: true });
});

router.delete('/work-items/:item_id/checklists/:cl_id', async (c) => {
  const user = c.get('user');
  const itemId = c.req.param('item_id');
  const clId = c.req.param('cl_id');
  const item = await getItemChecked(itemId, user);
  const checklists = ((item.checklists as any[]) || []).filter((c: any) => c.id !== clId);
  
  await prisma.workItem.update({ where: { id: itemId }, data: { checklists, updatedAt: new Date() } });
  await broadcastItem(await getWorkItem(itemId));
  return c.json({ ok: true });
});

router.post('/work-items/:item_id/checklists/:cl_id/items', async (c) => {
  const user = c.get('user');
  const itemId = c.req.param('item_id');
  const clId = c.req.param('cl_id');
  const body = await c.req.json();
  const item = await getItemChecked(itemId, user);
  const checklists = (item.checklists as any[]) || [];
  const cl = checklists.find((c: any) => c.id === clId);
  if (cl) cl.items.push({ id: newId(), text: body.text.trim(), done: false });
  
  await prisma.workItem.update({ where: { id: itemId }, data: { checklists, updatedAt: new Date() } });
  await broadcastItem(await getWorkItem(itemId));
  return c.json({ ok: true });
});


router.post('/work-items/:item_id/checklists/:cl_id/reorder', async (c) => {
  const user = c.get('user');
  const itemId = c.req.param('item_id');
  const clId = c.req.param('cl_id');
  const body = await c.req.json();
  const item = await getItemChecked(itemId, user);
  const checklists = (item.checklists as any[]) || [];
  const cl = checklists.find((c: any) => c.id === clId);
  if (cl && body.ordered_ids) {
    const map = new Map(cl.items.map((i: any) => [i.id, i]));
    cl.items = body.ordered_ids.map((id: string) => map.get(id)).filter(Boolean);
  }
  await prisma.workItem.update({ where: { id: itemId }, data: { checklists, updatedAt: new Date() } });
  await broadcastItem(await getWorkItem(itemId));
  return c.json({ ok: true });
});

router.patch('/work-items/:item_id/checklists/:cl_id/items/:sub_id', async (c) => {
  const user = c.get('user');
  const itemId = c.req.param('item_id');
  const clId = c.req.param('cl_id');
  const subId = c.req.param('sub_id');
  const body = await c.req.json();
  const item = await getItemChecked(itemId, user);
  const checklists = (item.checklists as any[]) || [];
  const cl = checklists.find((c: any) => c.id === clId);
  if (cl) {
    const sub = cl.items.find((i: any) => i.id === subId);
    if (sub) {
      if (body.done !== undefined) sub.done = body.done;
      if (body.text !== undefined) sub.text = body.text.trim();
      if (body.assignee_id !== undefined) sub.assignee_id = body.assignee_id;
      if (body.due_date !== undefined) sub.due_date = body.due_date;
    }
  }
  await prisma.workItem.update({ where: { id: itemId }, data: { checklists, updatedAt: new Date() } });
  await broadcastItem(await getWorkItem(itemId));
  return c.json({ ok: true });
});

router.delete('/work-items/:item_id/checklists/:cl_id/items/:sub_id', async (c) => {
  const user = c.get('user');
  const itemId = c.req.param('item_id');
  const clId = c.req.param('cl_id');
  const subId = c.req.param('sub_id');
  const item = await getItemChecked(itemId, user);
  const checklists = (item.checklists as any[]) || [];
  const cl = checklists.find((c: any) => c.id === clId);
  if (cl) cl.items = cl.items.filter((i: any) => i.id !== subId);
  
  await prisma.workItem.update({ where: { id: itemId }, data: { checklists, updatedAt: new Date() } });
  await broadcastItem(await getWorkItem(itemId));
  return c.json({ ok: true });
});

router.get('/notifications/mine', async (c) => {
  const user = c.get('user');
  console.log('USER IN WORK ROUTER:', user);
  const items = await prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 30 });
  const unread = await prisma.notification.count({ where: { userId: user.id, isRead: false } });
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
  return c.json(items.map((i: any) => ({ ...formatWorkItem(i), board_name: i.board.name, list_name: i.list.name })));
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
  
  const items = await prisma.workItem.findMany({ where, orderBy: { updatedAt: 'desc' }, include: { board: true, list: true } });
  return c.json(items.map((i: any) => ({ ...formatWorkItem(i), board_name: i.board.name, list_name: i.list.name })));
});

router.get('/search', async (c) => {
  const user = c.get('user');
  const q = c.req.query('q') || '';
  const boards = await prisma.board.findMany({ where: { name: { contains: q, mode: 'insensitive' }, isArchived: false }, take: 10 });
  const items = await prisma.workItem.findMany({
    where: { OR: [{ title: { contains: q, mode: 'insensitive' } }, { clientName: { contains: q, mode: 'insensitive' } }], archived: false },
    take: 20
  });
  return c.json({ boards, items });
});

router.post('/work-items/:item_id/hari', async (c) => {
  const user = c.get('user');
  const itemId = c.req.param('item_id');
  const body = await c.req.json();
  const item = await getWorkItem(itemId);
  const board = await prisma.board.findUnique({ where: { id: item.boardId } });
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
