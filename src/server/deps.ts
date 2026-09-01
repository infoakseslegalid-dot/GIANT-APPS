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

export const ADMIN_ROLES = new Set(["super_admin", "admin"]);
export const SUPERVISOR_ROLES = new Set(["super_admin", "admin", "supervisor"]);

export const ROLE_LABELS: Record<string, string> = {
    "super_admin": "Super Admin",
    "admin": "Admin",
    "supervisor": "Supervisor",
    "staff": "Staff",
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

export function publicUser(u: any): any {
    return {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        division_id: u.divisionId,
        avatar_color: u.avatarColor || "#0C66E4",
        is_active: u.isActive !== undefined ? u.isActive : true,
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

// Minimal WebSocket Manager representation
export class WSManager {
    conns: Set<any>;
    constructor() {
        this.conns = new Set();
    }
    // Omitted full WS implementation for now as it typically uses separate Next.js API or external service
    async broadcast(message: any) {
        // Mock implementation
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
    const b = await db.board.findUnique({ where: { id: boardId }, include: { members: true } });
    if (!b) {
        throw new HTTPException(404, { message: "Board tidak ditemukan" });
    }
    return b;
}

export function canViewBoard(user: any, board: any): boolean {
    if (ADMIN_ROLES.has(user.role)) return true;
    if (board.members && board.members.some((m: any) => m.userId === user.id)) return true;
    if (board.divisionId && board.divisionId === user.divisionId) return true;
    return false;
}

export async function getWorkItem(itemId: string) {
    const it = await db.workItem.findUnique({ where: { id: itemId } });
    if (!it) {
        throw new HTTPException(404, { message: "Pekerjaan tidak ditemukan" });
    }
    return it;
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
        
        await db.workItem.update({
            where: { id: item.id },
            data: updateData
        });
        
        for (const text of logs) {
            await logActivity(item.id, boardId, actor, `Otomatisasi ${text}`);
        }
        await broadcastItem(item);
    }
}

export function formatWorkItem(c) {
  if (!c) return c;
  
  // Parse checklists if it's a string
  let checklists = [];
  try {
    if (typeof c.checklists === 'string') checklists = JSON.parse(c.checklists);
    else if (c.checklists) checklists = c.checklists;
  } catch (e) {}
  
  return {
    ...c,
    list_id: c.listId,
    client_name: c.clientName,
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
    comment_count: c.commentCount,
    attachment_count: c.attachmentCount,
    checklists: checklists,
    label_ids: c.labels ? c.labels.map(l => l.labelId) : [],
    member_ids: c.members ? c.members.map(m => m.userId) : [],
    division_ids: c.divisionIds ? c.divisionIds.map(d => d.divisionId) : [],
  };
}
