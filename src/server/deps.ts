// @ts-nocheck
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { Context } from 'hono';
import { getCookie } from 'hono/cookie';
import { HTTPException } from 'hono/http-exception';

export const db = new PrismaClient();

export const JWT_ALGORITHM = "HS256";
export const ACCESS_MINUTES = 60 * 12;

export const ADMIN_ROLES = new Set(["super_admin"]);
export const SUPERVISOR_ROLES = new Set(["super_admin", "supervisor"]);

export const ROLE_LABELS: Record<string, string> = {
    "super_admin": "Super Admin",
    "admin": "Admin Operasional",
    "cs": "Customer Service",
    "supervisor": "Supervisor",
    "staff": "Staff (Legacy)",
    "viewer": "Viewer",
};

export function jwtSecret(): string {
    return process.env.JWT_SECRET || "default_secret";
}

export function nowIso(): string {
    return new Date().toISOString();
}

export function todayStr(): string {
    return new Date().toISOString().split('T')[0];
}

export function newId(): string {
    return uuidv4();
}

export function hashPassword(password: string): string {
    return bcrypt.hashSync(password, 10);
}

export function verifyPassword(plain: string, hashed: string): boolean {
    try {
        return bcrypt.compareSync(plain, hashed);
    } catch {
        return false;
    }
}

export function createAccessToken(user: any): string {
    const payload = {
        sub: user.id,
        email: user.email,
        role: user.role,
        type: "access",
    };
    return jwt.sign(payload, jwtSecret(), {
        algorithm: JWT_ALGORITHM as any,
        expiresIn: `${ACCESS_MINUTES}m`,
    });
}

export function createRefreshToken(userId: string): string {
    const payload = {
        sub: userId,
        type: "refresh",
    };
    return jwt.sign(payload, jwtSecret(), {
        algorithm: JWT_ALGORITHM as any,
        expiresIn: '7d',
    });
}

/** URL relatif foto profil (dengan cache-buster) atau null. */
export function userAvatarUrl(u: any): string | null {
    if (!u?.avatarPath) return null;
    const v = String(u.avatarPath).slice(-12);
    return `/api/users/${u.id}/avatar?v=${encodeURIComponent(v)}`;
}

export function publicUser(u: any): any {
    return {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        division_id: u.divisionId,
        avatar_color: u.avatarColor || "#0C66E4",
        avatar_url: userAvatarUrl(u),
        is_active: u.isActive !== undefined ? u.isActive : true,
        theme: u.theme || "system",
        locale: u.locale || "id",
    };
}

export async function getCurrentUser(c: Context): Promise<any> {
    let token = getCookie(c, "access_token");
    if (!token) {
        const auth = c.req.header("Authorization") || "";
        if (auth.startsWith("Bearer ")) {
            token = auth.substring(7);
        }
    }
    if (!token) {
        throw new HTTPException(401, { message: "Belum masuk. Silakan login." });
    }
    try {
        const payload: any = jwt.verify(token, jwtSecret(), { algorithms: [JWT_ALGORITHM as any] });
        if (payload.type !== "access") {
            throw new HTTPException(401, { message: "Token tidak valid" });
        }
        const user = await db.user.findUnique({ where: { id: payload.sub as string } });
        if (!user || user.isActive === false) {
            throw new HTTPException(401, { message: "Pengguna tidak ditemukan atau dinonaktifkan" });
        }
        return user;
    } catch (e: any) {
        if (e.name === "TokenExpiredError") {
            throw new HTTPException(401, { message: "Sesi berakhir, silakan login kembali" });
        }
        throw new HTTPException(401, { message: "Token tidak valid" });
    }
}

export function requireAdmin(user: any) {
    if (!ADMIN_ROLES.has(user.role)) {
        throw new HTTPException(403, { message: "Hanya admin yang dapat melakukan ini" });
    }
}

export function requireSupervisor(user: any) {
    if (!SUPERVISOR_ROLES.has(user.role)) {
        throw new HTTPException(403, { message: "Membutuhkan peran supervisor atau admin" });
    }
}

// ── Realtime event bus (in-process) ──────────────────────────────────────
// Satu instance dibagi via globalThis supaya route-handler SSE (worker Next)
// dan handler mutasi memakai bus yang sama, baik dijalankan lewat `next dev`
// maupun lewat custom server (server.mjs).
type BusListener = (m: any) => void;
class RealtimeBus {
    listeners: Set<BusListener> = new Set();
    subscribe(fn: BusListener): () => void {
        this.listeners.add(fn);
        return () => this.listeners.delete(fn);
    }
    publish(message: any) {
        for (const fn of this.listeners) {
            try { fn(message); } catch (e) { /* satu listener rusak jangan hentikan sisanya */ }
        }
        // Jembatan opsional ke WebSocket bawaan server.mjs (kalau dipakai).
        try {
            const fn = (globalThis as any).__WS_BROADCAST__;
            if (typeof fn === 'function') fn(message);
        } catch (e) { /* ignore */ }
    }
}
const _g = globalThis as any;
export const realtimeBus: RealtimeBus = _g.__REALTIME_BUS__ || (_g.__REALTIME_BUS__ = new RealtimeBus());

// Nama lama dipertahankan agar pemanggil tidak perlu diubah.
export class WSManager {
    async broadcast(message: any) {
        realtimeBus.publish(message);
    }
}

export const wsManager = new WSManager();

export async function logActivity(workItemId: string, boardId: string | null, user: any, action: string, detail: any = null) {
    await db.activity.create({
        data: {
            id: newId(),
            workItemId,
            boardId,
            userId: user.id,
            userName: user.name,
            action,
            detail: detail || {},
        }
    });
    await wsManager.broadcast({ type: "activity", work_item_id: workItemId, board_id: boardId });
}

// ── Setting: penyimpanan key-value generic untuk toggle app-wide ──────────
export async function getSetting(key: string): Promise<any> {
    const row = await db.setting.findUnique({ where: { key } });
    return row?.value ?? null;
}

export async function setSetting(key: string, value: any): Promise<void> {
    await db.setting.upsert({
        where: { key },
        update: { value, at: new Date() },
        create: { key, value },
    });
}

export async function notify(userIds: string[], ntype: string, title: string, body: string, workItemId: string | null = null, boardId: string | null = null, exclude: Set<string> | null = null) {
    const excludeSet = exclude || new Set();
    const uniqueIds = new Set(userIds || []);
    
    for (const uid of uniqueIds) {
        if (!uid || excludeSet.has(uid)) continue;
        await db.notification.create({
            data: {
                id: newId(),
                userId: uid,
                type: ntype,
                title,
                body,
                workItemId,
                boardId,
                isRead: false,
            }
        });
        await wsManager.broadcast({ type: "notification", user_id: uid, title });
    }
}

export async function broadcastBoard(boardId: string, workItemId: string | null = null) {
    await wsManager.broadcast({ type: "board_update", board_id: boardId, work_item_id: workItemId });
}

export async function broadcastItem(item: any) {
    const boards = new Set<string>();
    if (item.boardId) boards.add(item.boardId);
    
    // For mirrored work items
    const mirrors = await db.workItemMirror.findMany({ where: { workItemId: item.id } });
    for (const mirror of mirrors) {
        boards.add(mirror.boardId);
    }
    
    for (const b of boards) {
        if (b) {
            await broadcastBoard(b, item.id);
        }
    }
}

export async function getBoard(boardId: string) {
    const b = await db.board.findUnique({ where: { id: boardId }, include: { members: true, division: true } });
    if (!b) {
        throw new HTTPException(404, { message: "Board tidak ditemukan" });
    }
    return b;
}

let _divCache: Record<string, string> = {};
export async function prefetchDivisions() {
    const divs = await db.division.findMany();
    for (const d of divs) _divCache[d.id] = d.key;
}
export function getDivisionKey(divisionId: string | null, board?: any): string | null {
    if (board?.division?.key) return board.division.key;
    if (!divisionId) return null;
    return _divCache[divisionId] || null;
}

// Grup "Admin Operasional": user di salah satu divisi ini boleh MELIHAT
// (read-only) board divisi lain dalam grup yang sama. Edit tetap hanya di
// board divisinya sendiri (lihat canEditBoard).
export const ADMIN_OPS_KEYS = new Set(["draf", "pajak", "perizinan"]);

export function canViewBoard(user: any, board: any): boolean {
    const divKey = getDivisionKey(board.divisionId, board);
    if (ADMIN_ROLES.has(user.role)) return true;
    if (user.role === "supervisor") return true;

    // Pengecualian mutlak: jika user secara eksplisit di-assign sebagai member board, selalu izinkan
    if (board.members && board.members.some((m: any) => m.userId === user.id)) return true;

    // Aturan KETAT untuk CS: HANYA bisa lihat board CS
    if (user.role === "cs") {
        if (divKey === "cs") return true;
        if (board.divisionId && board.divisionId === user.divisionId) return true;
        return false;
    }

    // Admin Operasional: HANYA board Admin Draf / Pajak / Perizinan.
    if (user.role === "admin") {
        if (divKey && ADMIN_OPS_KEYS.has(divKey)) return true;
        if (board.divisionId && board.divisionId === user.divisionId) return true;
        return false;
    }

    // Untuk role lain (staff legacy, viewer, dll), cek matriks
    if (user._perms && user._perms.has("board.view_all")) return true;

    // Anggota grup Admin Operasional (berbasis divisi, tanpa peduli peran) →
    // boleh melihat board grup yang sama.
    const myKey = user.divisionId ? getDivisionKey(user.divisionId) : null;
    if (myKey && ADMIN_OPS_KEYS.has(myKey) && divKey && ADMIN_OPS_KEYS.has(divKey)) return true;

    if (board.divisionId && board.divisionId === user.divisionId) return true;
    return false;
}

/**
 * Boleh MENGUBAH isi board ini (buat/edit/hapus kartu & list)?
 * - admin / supervisor: ya.
 * - anggota board: ya (ini kunci untuk CS → hanya board-nya sendiri).
 * - se-divisi: ya HANYA untuk divisi non-CS (Admin Draf/Pajak/Perizinan/Desain
 *   kolaboratif). CS dikecualikan.
 * `board.division` harus di-include; kalau tidak ada, cek key='cs' dilewati.
 */
export function canEditBoard(user: any, board: any): boolean {
    if (!user || !board) return false;
    if (ADMIN_ROLES.has(user.role)) return true; // super_admin
    if (user.role === "supervisor") return true;

    // Matriks Hak Akses: peran yang diberi "board.edit_all" boleh mengubah SEMUA
    // board lintas divisi (mis. jika admin ingin sebuah peran bisa edit board
    // Admin Draf/Pajak/Perizinan yang bukan divisinya). Default: mati.
    if (user._perms && user._perms.has("board.edit_all")) return true;

    const divKey = getDivisionKey(board.divisionId, board);

    // CS hanya bisa edit kalau dia adalah members dari board tersebut
    // (karena board cs dibuat per-cs dan mereka di-assign sebagai member)
    if (user.role === "cs") {
        if (board.members && board.members.some((m: any) => m.userId === user.id)) return true;
        return false;
    }


    if (board.members && board.members.some((m: any) => m.userId === user.id)) return true;
    if (board.divisionId && user.divisionId && board.divisionId === user.divisionId && divKey !== "cs") return true;
    return false;
}

export async function getWorkItem(itemId: string) {
    const it = await db.workItem.findUnique({ where: { id: itemId } });
    if (!it) {
        throw new HTTPException(404, { message: "Pekerjaan tidak ditemukan" });
    }
    return it;
}

/** Board divisi + list awal yang valid (board harus punya list). */
export async function resolveBoardListForDivision(divisionId: string, preferListName?: string | null) {
    const boards = await db.board.findMany({
        where: { divisionId, isArchived: false, lists: { some: {} } },
        include: { lists: { where: { archived: false }, orderBy: { position: 'asc' } }, _count: { select: { lists: true } } },
    });
    boards.sort((a: any, b: any) => b._count.lists - a._count.lists);
    const board = boards[0] || null;
    if (!board) return { board: null, listId: null as string | null };
    const listId =
        (preferListName && board.lists.find((l: any) => (l.name || '').trim().toLowerCase() === preferListName.trim().toLowerCase())?.id) ||
        board.lists[0]?.id ||
        null;
    return { board, listId };
}

/** Spawn Assignment turunan Master Card ke Bank Data sebuah divisi (dipakai otomasi). */
export async function autoSpawnAssignment(sourceItem: any, divisionKey: string, opts: {
    titleSuffix?: string; note?: string; stage?: string; carryAttachments?: boolean; actor: any;
}) {
    const div = await db.division.findFirst({ where: { key: divisionKey } });
    if (!div) return null;
    const { board, listId } = await resolveBoardListForDivision(div.id);
    if (!board || !listId) return null;

    // pastikan Master Card ada
    let mcId = sourceItem.masterCardId;
    if (!mcId) {
        const mc = await db.masterCard.create({ data: { title: sourceItem.title, client: sourceItem.clientName || null } });
        await db.workItem.update({ where: { id: sourceItem.id }, data: { masterCardId: mc.id } });
        mcId = mc.id;
    }
    // hindari duplikat: sudah ada assignment tahap yang sama utk master ini di divisi ini & belum selesai?
    const dup = await db.workItem.findFirst({
        where: { masterCardId: mcId, targetDivisionId: div.id, workStatus: { notIn: ['COMPLETED', 'CANCELLED'] } },
    });
    if (dup) return null;

    const count = await db.workItem.count({ where: { listId } });
    const title = (sourceItem.masterCard?.title || sourceItem.title) + (opts.titleSuffix || '');
    const assignment = await db.workItem.create({
        data: {
            id: uuidv4(), title, clientName: sourceItem.clientName || null,
            description: opts.note || '', boardId: board.id, listId, position: (count + 1) * 1000,
            status: 'active', priority: sourceItem.priority || 'none',
            createdById: opts.actor.id, createdByName: opts.actor.name,
            masterCardId: mcId, sourceUserId: opts.actor.id,
            sourceBoardId: sourceItem.boardId, sourceListId: sourceItem.listId,
            targetDivisionId: div.id, targetBoardId: board.id, targetListId: listId,
            distributionStatus: 'AVAILABLE', workStatus: opts.stage ? `WAITING_CLAIM` : 'WAITING_CLAIM',
            divisionIds: { create: [{ divisionId: div.id }] },
        },
    });
    if (opts.carryAttachments) {
        const atts = await db.attachment.findMany({ where: { workItemId: sourceItem.id, isDeleted: false } });
        for (const a of atts) {
            await db.attachment.create({
                data: {
                    workItemId: assignment.id, storagePath: a.storagePath, originalFilename: a.originalFilename,
                    contentType: a.contentType, size: a.size, uploadedById: a.uploadedById, uploadedByName: a.uploadedByName,
                },
            });
        }
    }
    await logActivity(assignment.id, board.id, opts.actor, `Otomatisasi: dibuat dari "${sourceItem.title}"`);
    const mc = await db.masterCard.findUnique({ where: { id: mcId } });
    const stake = [...new Set([mc?.ownerUserId, sourceItem.sourceUserId, sourceItem.createdById].filter(Boolean))] as string[];
    await notify(stake, 'sent', 'Pekerjaan terkirim otomatis', `"${title}" otomatis dikirim ke Bank Data ${div.name}.`, assignment.id, board.id, new Set([opts.actor.id]));
    return assignment;
}

/** Set/centang satu item checklist "Progres Legalitas" di Master Card. */
export async function checkMasterChecklistItem(masterCardId: string, itemText: string, actor: any) {
    const assignments = await db.workItem.findMany({ where: { masterCardId }, orderBy: { createdAt: 'asc' } });
    // Master Card "representasi" = assignment paling awal yang tidak punya targetDivisionId (kartu CS asli)
    const master = assignments.find((a: any) => !a.targetDivisionId) || assignments[0];
    if (!master) return;
    let checklists: any[] = [];
    try { checklists = typeof master.checklists === 'string' ? JSON.parse(master.checklists) : (master.checklists || []); } catch { checklists = []; }
    if (!Array.isArray(checklists)) checklists = [];
    let cl = checklists.find((c: any) => c.title === 'Progres Legalitas');
    if (!cl) {
        cl = { id: uuidv4(), title: 'Progres Legalitas', items: ['Akta', 'SK Kemenkumham', 'NPWP', 'NIB'].map((t) => ({ id: uuidv4(), text: t, done: false })) };
        checklists.push(cl);
    }
    let it = cl.items.find((i: any) => (i.text || '').toLowerCase() === itemText.toLowerCase());
    if (!it) { it = { id: uuidv4(), text: itemText, done: false }; cl.items.push(it); }
    if (!it.done) {
        it.done = true;
        await db.workItem.update({ where: { id: master.id }, data: { checklists, updatedAt: new Date() } });
        await logActivity(master.id, master.boardId, actor, `Otomatisasi: progres "${itemText}" selesai`);
    }
}

export async function runAutomation(boardId: string, trigger: string, item: any, actor: any, contextListId: string | null = null) {
    const rules = await db.automationRule.findMany({
        where: { boardId, trigger }
    });
    if (!rules.length) return;

    let changed = false;
    const logs: string[] = [];

    for (const rule of rules) {
        if (trigger === "card_moved" && rule.triggerListId && rule.triggerListId !== contextListId) continue;

        const action = rule.action;
        const value = rule.actionValue;

        // ── Aksi pipeline Bank Data ──────────────────────────────────────
        if (action === "send_to_division" && value) {
            let cfg: any = {};
            try { cfg = JSON.parse(value); } catch { cfg = { division_keys: [value] }; }
            const keys: string[] = cfg.division_keys || (cfg.division_key ? [cfg.division_key] : []);
            for (const k of keys) {
                await autoSpawnAssignment(item, k, {
                    titleSuffix: cfg.title_suffix || '', note: cfg.note || '', stage: cfg.stage,
                    carryAttachments: !!cfg.carry_attachments, actor,
                });
            }
            logs.push(`mengirim tugas ke ${keys.join(', ')}`);
            continue;
        }
        if (action === "check_checklist_item" && value && item.masterCardId) {
            for (const t of String(value).split(',').map((s) => s.trim()).filter(Boolean)) {
                await checkMasterChecklistItem(item.masterCardId, t, actor);
            }
            logs.push(`update progres "${value}"`);
            continue;
        }
        if (action === "move_master_card" && value && item.masterCardId) {
            const siblings = await db.workItem.findMany({ where: { masterCardId: item.masterCardId }, orderBy: { createdAt: 'asc' } });
            const master = siblings.find((s: any) => !s.targetDivisionId) || siblings[0];
            if (master && master.id !== item.id) {
                const list = await db.list.findFirst({ where: { boardId: master.boardId, name: { equals: value, mode: 'insensitive' } } });
                if (list && list.id !== master.listId) {
                    const cnt = await db.workItem.count({ where: { listId: list.id } });
                    await db.workItem.update({ where: { id: master.id }, data: { listId: list.id, position: (cnt + 1) * 1000, updatedAt: new Date() } });
                    await logActivity(master.id, master.boardId, actor, `Otomatisasi: dipindahkan ke "${value}"`);
                }
            }
            logs.push(`memindahkan Master Card ke "${value}"`);
            continue;
        }
        if (action === "move_card" && value) {
            const target = await db.list.findFirst({ where: { OR: [{ id: value }, { boardId: item.boardId, name: value }] } });
            if (target && target.id !== item.listId) {
                const cnt = await db.workItem.count({ where: { listId: target.id } });
                await db.workItem.update({ where: { id: item.id }, data: { listId: target.id, boardId: target.boardId, position: (cnt + 1) * 1000, updatedAt: new Date() } });
                item.listId = target.id;
                logs.push(`memindahkan kartu ke "${target.name}"`);
            }
            continue;
        }
        if (action === "notify" && value) {
            let cfg: any = {};
            try { cfg = JSON.parse(value); } catch { cfg = { message: value, to: 'owner' }; }
            const targets: string[] = [];
            const mc = item.masterCardId ? await db.masterCard.findUnique({ where: { id: item.masterCardId } }) : null;
            if (cfg.to === 'owner' && mc?.ownerUserId) targets.push(mc.ownerUserId);
            else if (cfg.to === 'source' && item.sourceUserId) targets.push(item.sourceUserId);
            else if (cfg.to === 'pic' && item.currentPicId) targets.push(item.currentPicId);
            else if (cfg.to) targets.push(cfg.to);
            if (targets.length) await notify(targets, 'automation', cfg.title || 'Notifikasi otomatis', (cfg.message || '').replace('{title}', item.title), item.id, boardId, new Set([actor.id]));
            logs.push('mengirim notifikasi');
            continue;
        }

        if (action === "add_label" && value) {
            const exists = await db.workItemLabel.findUnique({ where: { workItemId_labelId: { workItemId: item.id, labelId: value } } });
            if (!exists) {
                await db.workItemLabel.create({ data: { workItemId: item.id, labelId: value } });
                changed = true;
                logs.push("menambahkan label");
            }
        } else if (action === "remove_label" && value) {
            const exists = await db.workItemLabel.findUnique({ where: { workItemId_labelId: { workItemId: item.id, labelId: value } } });
            if (exists) {
                await db.workItemLabel.delete({ where: { workItemId_labelId: { workItemId: item.id, labelId: value } } });
                changed = true;
                logs.push("menghapus label");
            }
        } else if (action === "set_priority" && value && item.priority !== value) {
            item.priority = value;
            changed = true;
            logs.push(`mengubah prioritas menjadi ${value}`);
        } else if (action === "assign_division" && value) {
            const exists = await db.workItemDivision.findUnique({ where: { workItemId_divisionId: { workItemId: item.id, divisionId: value } } });
            if (!exists) {
                await db.workItemDivision.create({ data: { workItemId: item.id, divisionId: value } });
                changed = true;
                logs.push("menambahkan divisi");
            }
        }
    }
    
    if (changed) {
        const updateData: any = {};
        if (item.priority) updateData.priority = item.priority;
        updateData.updatedAt = new Date();
        await db.workItem.update({ where: { id: item.id }, data: updateData });
    }
    if (changed || logs.length) {
        for (const text of logs) {
            await logActivity(item.id, boardId, actor, `Otomatisasi ${text}`);
        }
        await broadcastItem(item);
    }
}

// Satu label status yang jelas untuk user (selaras dengan routes_work.displayStatus).
function _displayStatus(c) {
  const isAssignment = !!c.targetDivisionId;
  if (c.archived) return { code: 'ARCHIVED', label: 'Diarsipkan', tone: 'gray' };
  if (c.status === 'done' || c.workStatus === 'COMPLETED') return { code: 'DONE', label: 'Selesai', tone: 'green' };
  if (c.status === 'submitted') return { code: 'REVIEW', label: 'Menunggu persetujuan', tone: 'amber' };
  if (isAssignment && c.distributionStatus === 'AVAILABLE') return { code: 'WAITING_CLAIM', label: 'Menunggu diambil', tone: 'slate' };
  if (isAssignment && c.distributionStatus === 'RELEASED') return { code: 'RELEASED', label: 'Dilepas', tone: 'slate' };
  if (c.workStatus === 'REVISION') return { code: 'REVISION', label: 'Perlu revisi', tone: 'amber' };
  return { code: 'IN_PROGRESS', label: 'Sedang dikerjakan', tone: 'blue' };
}

export function formatWorkItem(c) {
  if (!c) return c;

  // Parse checklists if it's a string
  let checklists = [];
  try {
    if (typeof c.checklists === 'string') checklists = JSON.parse(c.checklists);
    else if (c.checklists) checklists = c.checklists;
  } catch (e) {}

  const _ds = _displayStatus(c);

  return {
    ...c,
    display_status: _ds.code,
    display_status_label: _ds.label,
    display_status_tone: _ds.tone,
    is_done: _ds.code === 'DONE',
    list_id: c.listId,
    client_name: c.clientName,
    start_date: c.startDate,
    due_date: c.dueDate,
    created_by_id: c.createdById,
    created_by_name: c.createdByName,
    submitted_by_id: c.submittedById,
    approved_by_id: c.approvedById,
    hari_stage: c.hariStage,
    hari_entered_at: c.hariEnteredAt,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
    completed_at: c.completedAt,
    board_id: c.boardId,
    cover_attachment_id: c.coverAttachmentId,
    cover_color: c.coverColor,
    watcher_ids: c.watcherUserIds || [],
    comment_count: c.commentCount,
    attachment_count: c.attachmentCount,
    checklists: checklists,
    label_ids: c.labels ? c.labels.map(l => l.labelId) : [],
    member_ids: c.members ? c.members.map(m => m.userId) : [],
    division_ids: c.divisionIds ? c.divisionIds.map(d => d.divisionId) : [],

    // Bank Data & Distribusi (PRD v1.0)
    master_card_id: c.masterCardId,
    source_user_id: c.sourceUserId,
    source_user_name: c.sourceUser?.name || null,
    target_division_id: c.targetDivisionId,
    target_board_id: c.targetBoardId,
    target_list_id: c.targetListId,
    current_pic_id: c.currentPicId,
    current_pic_name: c.currentPic?.name || null,
    distribution_status: c.distributionStatus,
    work_status: c.workStatus,
    claimed_at: c.claimedAt,
    released_at: c.releasedAt,
    owner_user_id: c.masterCard?.ownerUserId || null,
    owner_user_name: c.masterCard?.owner?.name || null,
    owner_division_id: c.masterCard?.ownerDivisionId || null,
  };
}
