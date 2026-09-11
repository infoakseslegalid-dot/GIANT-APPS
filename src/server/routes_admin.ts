// @ts-nocheck
import { formatWorkItem, publicUser, userAvatarUrl } from './deps';
import {
  Hono } from 'hono'
import {
  z } from 'zod'
import {
  zValidator } from '@hono/zod-validator'
import {
  db, requireAdmin, requireSupervisor, canViewBoard, canEditBoard, broadcastBoard, getBoard, hashPassword, todayStr,
  getSetting, setSetting,
} from './deps'
import { fullMatrix, syncPermissions, invalidatePermCache, requirePerm } from './permissions'
import { can } from './permissions'
import { putObject, getObject } from './storage'
import { v4 as uuidv4 } from 'uuid'

export const adminRouter = new Hono()

// Boleh ubah latar board: pengelola board (matriks) ATAU anggota board.
async function canEditBoardBg(user: any, board: any) {
  if (!user || !board) return false
  if (await can(user, 'board.manage')) return true
  if (['super_admin', 'admin', 'supervisor'].includes(user.role)) return true
  return (board.members || []).some((m: any) => m.userId === user.id)
}
const BG_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const BG_MAX_BYTES = 5 * 1024 * 1024
const AVATAR_IMAGE_TYPES = BG_IMAGE_TYPES
const AVATAR_MAX_BYTES = 3 * 1024 * 1024

/** URL relatif gambar latar board (dengan cache-buster) atau null. */
export function boardBgUrl(board: any): string | null {
  if (!board?.backgroundImagePath) return null
  const v = String(board.backgroundImagePath).slice(-12)
  return `/api/boards/${board.id}/background-image?v=${encodeURIComponent(v)}`
}

// ---------- PERMISSION MATRIX (role × aksi) ----------
adminRouter.get('/permissions', async (c) => {
  await requirePerm(c, 'permission.manage')
  return c.json(await fullMatrix())
})

adminRouter.post('/permissions/sync', async (c) => {
  await requirePerm(c, 'permission.manage')
  const res = await syncPermissions()
  return c.json({ ok: true, ...res, matrix: await fullMatrix() })
})

adminRouter.patch('/permissions', async (c) => {
  await requirePerm(c, 'permission.manage')
  const body = await c.req.json()
  const changes = Array.isArray(body.changes) ? body.changes
    : (body.role && body.key ? [{ role: body.role, key: body.key, allowed: !!body.allowed }] : [])
  if (!changes.length) return c.json({ error: 'Tidak ada perubahan' }, 400)
  for (const ch of changes) {
    if (ch.role === 'super_admin') continue // super_admin selalu penuh
    await db.rolePermission.upsert({
      where: { role_permKey: { role: ch.role, permKey: ch.key } },
      update: { allowed: !!ch.allowed },
      create: { role: ch.role, permKey: ch.key, allowed: !!ch.allowed },
    })
  }
  invalidatePermCache()
  return c.json({ ok: true, matrix: await fullMatrix() })
})

// Override per divisi. allowed: true | false | null (null = hapus override,
// divisi kembali mengikuti perannya).
adminRouter.patch('/permissions/divisions', async (c) => {
  await requirePerm(c, 'permission.manage')
  const body = await c.req.json()
  const changes = Array.isArray(body.changes) ? body.changes
    : (body.division_id && body.key ? [{ division_id: body.division_id, key: body.key, allowed: body.allowed }] : [])
  if (!changes.length) return c.json({ error: 'Tidak ada perubahan' }, 400)
  for (const ch of changes) {
    const where = { divisionId_permKey: { divisionId: ch.division_id, permKey: ch.key } }
    if (ch.allowed === null || ch.allowed === undefined) {
      await db.divisionPermission.deleteMany({ where: { divisionId: ch.division_id, permKey: ch.key } })
      continue
    }
    await db.divisionPermission.upsert({
      where,
      update: { allowed: !!ch.allowed },
      create: { divisionId: ch.division_id, permKey: ch.key, allowed: !!ch.allowed },
    })
  }
  invalidatePermCache()
  return c.json({ ok: true, matrix: await fullMatrix() })
})

// Sajikan foto profil. Terbuka untuk semua user login — avatar muncul di mana
// saja (anggota kartu, PIC, komentar), jadi tidak ada gunanya dibatasi.
adminRouter.get('/users/:user_id/avatar', async (c) => {
  const u = await db.user.findUnique({ where: { id: c.req.param('user_id') } })
  if (!u || !u.avatarPath) return c.text('Not found', 404)
  try {
    const { data, contentType } = await getObject(u.avatarPath)
    return new Response(data, {
      headers: {
        'Content-Type': u.avatarType || contentType || 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch {
    return c.text('Not found', 404)
  }
})

// ---------- USERS ----------

adminRouter.get('/users', async (c) => {
  const users = await db.user.findMany({ take: 500 })
  return c.json(users.map(publicUser))
})

const CreateUserBody = z.object({
  name: z.string(),
  email: z.string().email(),
  password: z.string(),
  role: z.string().default("staff"),
  division_id: z.string().optional().nullable(),
  avatar_color: z.string().default('#0C66E4'),
})

adminRouter.post('/users', zValidator('json', CreateUserBody), async (c) => {
  const user = c.get('user')
  await requirePerm(c, 'user.manage')
  const body = c.req.valid('json')
  const email = body.email.toLowerCase().trim()
  
  const existing = await db.user.findUnique({ where: { email } })
  if (existing) {
    return c.json({ error: "Email sudah terdaftar" }, 400)
  }
  
  if (!["super_admin", "admin", "cs", "supervisor", "staff", "viewer"].includes(body.role)) {
    return c.json({ error: "Peran tidak valid" }, 400)
  }
  
  const doc = await db.user.create({
    data: {
      name: body.name.trim(),
      email,
      passwordHash: hashPassword(body.password),
      role: body.role,
      divisionId: body.division_id,
      avatarColor: body.avatar_color,
      isActive: true,
    }
  })
  
  return c.json(publicUser(doc))
})

const UpdateUserBody = z.object({
  name: z.string().optional(),
  email: z.string().email().optional(),
  role: z.string().optional(),
  division_id: z.string().optional().nullable(),
  is_active: z.boolean().optional(),
  password: z.string().optional(),
  avatar_color: z.string().optional(),
})

adminRouter.patch('/users/:user_id', zValidator('json', UpdateUserBody), async (c) => {
  const user = c.get('user')
  await requirePerm(c, 'user.manage')
  const userId = c.req.param('user_id')
  const body = c.req.valid('json')
  
  const updates: any = {}
  if (body.name !== undefined) updates.name = body.name
  if (body.email !== undefined) {
    const email = body.email.toLowerCase().trim()
    const taken = await db.user.findFirst({ where: { email, id: { not: userId } } })
    if (taken) return c.json({ error: 'Email sudah dipakai pengguna lain' }, 400)
    updates.email = email
  }
  if (body.role !== undefined) {
    if (!["super_admin", "admin", "cs", "supervisor", "staff", "viewer"].includes(body.role)) {
      return c.json({ error: "Peran tidak valid" }, 400)
    }
    updates.role = body.role
  }
  if (body.division_id !== undefined) updates.divisionId = body.division_id
  if (body.is_active !== undefined) updates.isActive = body.is_active
  if (body.password !== undefined) updates.passwordHash = hashPassword(body.password)
  if (body.avatar_color !== undefined) updates.avatarColor = body.avatar_color

  if (Object.keys(updates).length === 0) {
    return c.json({ error: "Tidak ada perubahan" }, 400)
  }
  
  const updated = await db.user.update({
    where: { id: userId },
    data: updates
  })
  if (!updated) {
    return c.json({ error: "Pengguna tidak ditemukan" }, 404)
  }
  
  return c.json(publicUser(updated))
})

// Foto profil pengguna lain — dikelola lewat izin `user.manage`, terpisah dari
// `profile.edit_photo` (itu untuk foto diri sendiri). Jadi admin tetap bisa
// merapikan foto tim walau divisinya sendiri dikunci.
adminRouter.post('/users/:user_id/avatar', async (c) => {
  await requirePerm(c, 'user.manage')
  const userId = c.req.param('user_id')
  const target = await db.user.findUnique({ where: { id: userId } })
  if (!target) return c.json({ error: 'Pengguna tidak ditemukan' }, 404)

  const form = await c.req.parseBody()
  const file = form['file'] as File
  if (!file) return c.json({ error: 'Tidak ada berkas' }, 400)
  const type = file.type || 'application/octet-stream'
  if (!AVATAR_IMAGE_TYPES.includes(type)) return c.json({ error: 'Format harus JPG, PNG, WEBP, atau GIF' }, 400)
  if (file.size > AVATAR_MAX_BYTES) return c.json({ error: 'Ukuran maksimal 3 MB' }, 400)

  const buf = Buffer.from(await file.arrayBuffer())
  const ext = (file.name || 'avatar').split('.').pop() || 'img'
  const objectPath = `avatar/${userId}/${uuidv4()}.${ext}`
  await putObject(objectPath, buf, type)

  const updated = await db.user.update({ where: { id: userId }, data: { avatarPath: objectPath, avatarType: type } })
  return c.json(publicUser(updated))
})

adminRouter.delete('/users/:user_id/avatar', async (c) => {
  await requirePerm(c, 'user.manage')
  const updated = await db.user.update({
    where: { id: c.req.param('user_id') },
    data: { avatarPath: null, avatarType: null },
  })
  return c.json(publicUser(updated))
})

// ---------- DIVISIONS ----------

adminRouter.get('/divisions', async (c) => {
  const divs = await db.division.findMany({
    orderBy: { name: 'asc' },
    take: 100
  })
  return c.json(divs)
})

const DivisionBody = z.object({
  name: z.string(),
  color: z.string().default("#0C66E4"),
})

adminRouter.post('/divisions', zValidator('json', DivisionBody), async (c) => {
  const user = c.get('user')
  await requirePerm(c, 'division.manage')
  const body = c.req.valid('json')
  
  const doc = await db.division.create({
    data: {
      name: body.name.trim(),
      color: body.color,
      key: body.name.trim().toLowerCase().replace(/\s+/g, '-'),
    }
  })
  return c.json(doc)
})

adminRouter.patch('/divisions/:division_id', zValidator('json', DivisionBody), async (c) => {
  const user = c.get('user')
  await requirePerm(c, 'division.manage')
  const divId = c.req.param('division_id')
  const body = c.req.valid('json')
  
  const doc = await db.division.update({
    where: { id: divId },
    data: { name: body.name.trim(), color: body.color }
  })
  return c.json(doc)
})

adminRouter.delete('/divisions/:division_id', async (c) => {
  const user = c.get('user')
  await requirePerm(c, 'division.manage')
  const divId = c.req.param('division_id')
  
  const boardsCount = await db.board.count({ where: { divisionId: divId, isArchived: false } })
  const usersCount = await db.user.count({ where: { divisionId: divId } })
  
  if (boardsCount > 0 || usersCount > 0) {
    return c.json({ error: "Divisi masih memiliki board atau pengguna" }, 400)
  }
  
  await db.division.delete({ where: { id: divId } })
  return c.json({ ok: true })
})

// ---------- BOARDS ----------

adminRouter.get('/boards', async (c) => {
  const user = c.get('user')
  const boards = await db.board.findMany({
    where: { isArchived: false },
    take: 500,
    include: { members: true, division: true, workItems: { where: { archived: false } } }
  })
  
  const visible = boards.filter(b => canViewBoard(user, b))
  const divisions = await db.division.findMany({ take: 100 })
  const divMap = new Map(divisions.map(d => [d.id, d]))
  
  const result = visible.map(b => {
    const d = b.divisionId ? divMap.get(b.divisionId) : null
    const { members, workItems, ...rest } = b as any
    rest.division_name = d ? d.name : null
    rest.division_color = d ? d.color : null
    rest.card_count = workItems.length
    rest.member_ids = members.map((m: any) => m.userId)
    rest.background_image_url = boardBgUrl(b)
    return rest
  })
  return c.json(result)
})

const CreateBoardBody = z.object({
  name: z.string(),
  division_id: z.string().optional().nullable(),
  background: z.string().default("#0079bf"),
  member_ids: z.array(z.string()).default([]),
  description: z.string().default(""),
  visibility: z.string().default("workspace"),
  template: z.string().optional().nullable(),
})

adminRouter.post('/boards', zValidator('json', CreateBoardBody), async (c) => {
  const user = c.get('user')
  await requirePerm(c, 'board.manage')
  const body = c.req.valid('json')
  
  const doc = await db.board.create({
    data: {
      name: body.name.trim(),
      divisionId: body.division_id,
      background: body.background,
      createdById: user.id,
      members: {
        create: body.member_ids.map(userId => ({ userId }))
      }
    }
  })
  
  if (body.template === "skor") {
    const listNames = [
      "KOMPLAIN", "SKOR 1-2 (Pengumpulan Berkas)", "SKOR 3 (Butuh/Revisi Draf)",
      "SKOR 4 (Proses Notaris)", "SKOR 5 (NPWP, NIB, Yayasan)",
      "SKOR 6 (Finish/Penyerahan)", "SKOR 7 (Follow Up Kembali)",
    ]
    for (let i = 0; i < listNames.length; i++) {
      await db.list.create({
        data: {
          boardId: doc.id,
          name: listNames[i],
          position: (i + 1) * 1000
        }
      })
    }
  }
  
  return c.json(doc)
})

const UpdateBoardBody = z.object({
  name: z.string().optional(),
  background: z.string().optional(),
  division_id: z.string().optional().nullable(),
  member_ids: z.array(z.string()).optional(),
  description: z.string().optional(),
  visibility: z.string().optional(),
})

adminRouter.patch('/boards/:board_id', zValidator('json', UpdateBoardBody), async (c) => {
  const user = c.get('user')
  await requirePerm(c, 'board.manage')
  const boardId = c.req.param('board_id')
  const body = c.req.valid('json')
  
  const board = await getBoard(boardId)
  
  const updates: any = {}
  if (body.name !== undefined) updates.name = body.name.trim()
  if (body.background !== undefined) updates.background = body.background
  if (body.division_id !== undefined) updates.divisionId = body.division_id

  if (Object.keys(updates).length > 0) {
    await db.board.update({ where: { id: boardId }, data: updates })
  }
  
  if (body.member_ids) {
    await db.boardMember.deleteMany({ where: { boardId } })
    if (body.member_ids.length > 0) {
      await db.boardMember.createMany({
        data: body.member_ids.map(userId => ({ boardId, userId }))
      })
    }
  }
  
  await broadcastBoard(boardId)
  
  const updated = await db.board.findUnique({ where: { id: boardId }, include: { members: true } })
  return c.json(updated)
})

adminRouter.delete('/boards/:board_id', async (c) => {
  const user = c.get('user')
  await requirePerm(c, 'board.manage')
  const boardId = c.req.param('board_id')
  
  await db.board.update({ where: { id: boardId }, data: { isArchived: true } })
  return c.json({ ok: true })
})

adminRouter.post('/boards/:board_id/unarchive', async (c) => {
  const user = c.get('user')
  await requirePerm(c, 'board.manage')
  const boardId = c.req.param('board_id')
  
  await db.board.update({ where: { id: boardId }, data: { isArchived: false } })
  return c.json({ ok: true })
})

adminRouter.get('/boards-archived', async (c) => {
  const user = c.get('user')
  requireAdmin(user)
  const boards = await db.board.findMany({ where: { isArchived: true }, take: 200 })
  return c.json(boards)
})

// ---------- BOARD BACKGROUND ----------

// Set warna solid, atau hapus gambar latar.
adminRouter.patch('/boards/:board_id/background', async (c) => {
  const user = c.get('user')
  const boardId = c.req.param('board_id')
  const board = await db.board.findUnique({ where: { id: boardId }, include: { members: true } })
  if (!board) return c.json({ error: 'Board tidak ditemukan' }, 404)
  if (!(await canEditBoardBg(user, board))) return c.json({ error: 'Tidak diizinkan mengubah latar board ini' }, 403)

  const body = await c.req.json()
  const data: any = {}
  if (typeof body.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(body.color)) data.background = body.color
  if (body.clear_image) { data.backgroundImagePath = null; data.backgroundImageType = null }
  if (!Object.keys(data).length) return c.json({ error: 'Tidak ada perubahan' }, 400)

  const updated = await db.board.update({ where: { id: boardId }, data })
  await broadcastBoard(boardId)
  return c.json({ ...updated, background_image_url: boardBgUrl(updated) })
})

// Unggah gambar latar custom (multipart, field `file`).
adminRouter.post('/boards/:board_id/background/image', async (c) => {
  const user = c.get('user')
  const boardId = c.req.param('board_id')
  const board = await db.board.findUnique({ where: { id: boardId }, include: { members: true } })
  if (!board) return c.json({ error: 'Board tidak ditemukan' }, 404)
  if (!(await canEditBoardBg(user, board))) return c.json({ error: 'Tidak diizinkan mengubah latar board ini' }, 403)

  const form = await c.req.parseBody()
  const file = form['file'] as File
  if (!file) return c.json({ error: 'Tidak ada berkas' }, 400)
  const type = file.type || 'application/octet-stream'
  if (!BG_IMAGE_TYPES.includes(type)) return c.json({ error: 'Format harus JPG, PNG, WEBP, atau GIF' }, 400)
  if (file.size > BG_MAX_BYTES) return c.json({ error: 'Ukuran maksimal 5 MB' }, 400)

  const buf = Buffer.from(await file.arrayBuffer())
  const ext = (file.name || 'bg').split('.').pop() || 'img'
  const path = `board-bg/${boardId}/${uuidv4()}.${ext}`
  await putObject(path, buf, type)

  const updated = await db.board.update({
    where: { id: boardId },
    data: { backgroundImagePath: path, backgroundImageType: type },
  })
  await broadcastBoard(boardId)
  return c.json({ ...updated, background_image_url: boardBgUrl(updated) })
})

// Serve gambar latar.
adminRouter.get('/boards/:board_id/background-image', async (c) => {
  const boardId = c.req.param('board_id')
  const board = await db.board.findUnique({ where: { id: boardId } })
  if (!board || !board.backgroundImagePath) return c.text('Not found', 404)
  try {
    const { data, contentType } = await getObject(board.backgroundImagePath)
    return new Response(data, {
      headers: {
        'Content-Type': board.backgroundImageType || contentType || 'image/jpeg',
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch {
    return c.text('Gagal memuat gambar', 500)
  }
})

const CopyBoardBody = z.object({
  name: z.string(),
  withCards: z.boolean().default(false),
})

adminRouter.post('/boards/:board_id/copy', zValidator('json', CopyBoardBody), async (c) => {
  const user = c.get('user')
  await requirePerm(c, 'board.manage')
  const boardId = c.req.param('board_id')
  const body = c.req.valid('json')
  
  const src = await db.board.findUnique({ where: { id: boardId }, include: { members: true } })
  if (!src) return c.json({ error: "Board not found" }, 404)
  
  const newBoard = await db.board.create({
    data: {
      name: body.name.trim(),
      divisionId: src.divisionId,
      background: src.background,
      createdById: user.id,
      members: {
        create: src.members.map(m => ({ userId: m.userId }))
      }
    }
  })
  
  const lists = await db.list.findMany({ where: { boardId, NOT: { name: "archived_dummy_condition_if_exists" } }, orderBy: { position: 'asc' } }) // Assuming lists are not archived
  const listIdMap = new Map<string, string>()
  
  for (const l of lists) {
    const nl = await db.list.create({
      data: {
        boardId: newBoard.id,
        name: l.name,
        color: l.color,
        position: l.position,
        entryRequirements: l.entryRequirements as any
      }
    })
    listIdMap.set(l.id, nl.id)
  }
  
  const labels = await db.label.findMany({ where: { boardId } })
  for (const lab of labels) {
    await db.label.create({
      data: {
        boardId: newBoard.id,
        name: lab.name,
        color: lab.color
      }
    })
  }
  
  if (body.withCards) {
    const cards = await db.workItem.findMany({
      where: { boardId, archived: false },
      include: {
        members: true,
        divisionIds: true,
        mirrorBoards: true,
      }
    })
    
    const posCounter = new Map<string, number>()
    for (const c of cards) {
      const targetListId = listIdMap.get(c.listId)
      if (!targetListId) continue
      
      const currPos = posCounter.get(targetListId) || 0
      const nextPos = currPos + 1000
      posCounter.set(targetListId, nextPos)
      
      const checklists = c.checklists as any[] || []
      const newChecklists = checklists.map(cl => ({
        ...cl,
        items: (cl.items || []).map((it: any) => ({ ...it, done: false }))
      }))
      
      await db.workItem.create({
        data: {
          title: c.title,
          clientName: c.clientName,
          description: c.description,
          boardId: newBoard.id,
          listId: targetListId,
          position: nextPos,
          dueDate: c.dueDate,
          priority: c.priority,
          status: "active",
          archived: false,
          needsApproval: c.needsApproval,
          createdById: user.id,
          createdByName: user.name,
          checklists: newChecklists,
        }
      })
    }
  }
  
  return c.json(newBoard)
})

adminRouter.get('/boards/:board_id/full', async (c) => {
  const user = c.get('user')
  const boardId = c.req.param('board_id')
  const board = await getBoard(boardId)
  if (!canViewBoard(user, board)) {
    return c.json({ error: "Anda tidak memiliki akses ke board ini" }, 403)
  }
  
  const lists = await db.list.findMany({ where: { boardId, archived: false }, orderBy: { position: 'asc' } })
  const labels = await db.label.findMany({ where: { boardId } })
  
  const cards = await db.workItem.findMany({
    where: {
      AND: [
        {
          OR: [
            { boardId },
            { mirrorBoards: { some: { boardId } } }
          ]
        },
        { archived: false },
        // Assignment Bank Data yang BELUM di-claim (belum ada PIC) tidak boleh
        // tampil di board sungguhan — hanya terlihat di halaman Bank Data,
        // sampai ada anggota divisi yang klaim (jadi PIC) atau di-assign langsung.
        {
          OR: [
            { targetDivisionId: null },
            { currentPicId: { not: null } },
            { distributionStatus: { not: 'AVAILABLE' } },
          ]
        }
      ]
    },
    include: {
      labels: true,
      members: true,
      divisionIds: true,
      mirrorBoards: true
    }
  })

  const archivedCount = await db.workItem.count({ where: { boardId, archived: true } })
  let division = null
  if (board.divisionId) {
    division = await db.division.findUnique({ where: { id: board.divisionId } })
  }

  const rawUsers = await db.user.findMany({ where: { isActive: true }, take: 500 })
  const users = rawUsers.map(publicUser)

  // Penanda "kartu mirror": untuk assignment, ambil nama board/list Master Card asalnya.
  const mcIds = [...new Set(cards.filter((c: any) => c.masterCardId && c.targetDivisionId).map((c: any) => c.masterCardId))]
  const masters = mcIds.length
    ? await db.workItem.findMany({ where: { masterCardId: { in: mcIds as string[] }, targetDivisionId: null }, include: { board: true, list: true } })
    : []
  const mByMc = new Map(masters.map((m: any) => [m.masterCardId, m]))

  const cardsOut = cards.map((c: any) => {
    const f = formatWorkItem(c)
    if (c.masterCardId && c.targetDivisionId) {
      const m = mByMc.get(c.masterCardId)
      f.is_assignment = true
      f.master_item_id = m?.id || null
      f.master_board_name = m?.board?.name || null
      f.master_list_name = m?.list?.name || null
      // Judul & nama klien = single source of truth di Master Card rep (lihat
      // AGENTS.md / komentar di GET /work-items/:item_id) — kalau tidak
      // di-fallback ke sini, kartu assignment di board tetap tampil judul lama
      // walau sudah diubah dari kartu master.
      if (m) {
        f.title = m.title || f.title
        f.client_name = m.clientName ?? f.client_name
      }
    }
    return f
  })

  return c.json({
    board: { ...board, background_image_url: boardBgUrl(board) },
    lists,
    labels,
    cards: cardsOut,
    division,
    users,
    archived_count: archivedCount,
    can_edit: canEditBoard(user, board), // false → board hanya bisa dilihat (read-only)
  })
})

adminRouter.get('/boards/:board_id/archived', async (c) => {
  const user = c.get('user')
  const boardId = c.req.param('board_id')
  const board = await getBoard(boardId)
  if (!canViewBoard(user, board)) {
    return c.json({ error: "Anda tidak memiliki akses ke board ini" }, 403)
  }
  const cards = await db.workItem.findMany({ where: { boardId, archived: true }, take: 500 })
  const arcLists = await db.list.findMany({ where: { boardId, archived: true }, orderBy: { archivedAt: 'desc' } })
  const lists = [] as any[]
  for (const l of arcLists) {
    lists.push({
      id: l.id, name: l.name, color: l.color, archived_at: l.archivedAt,
      card_count: await db.workItem.count({ where: { listId: l.id, archived: false } }),
    })
  }
  return c.json({ cards: cards.map(formatWorkItem), lists })
})

// ---------- LISTS ----------

const CreateListBody = z.object({
  name: z.string(),
  color: z.string().optional().nullable(),
})

adminRouter.post('/boards/:board_id/lists', zValidator('json', CreateListBody), async (c) => {
  await requirePerm(c, 'list.manage')
  const user = c.get('user')
  const boardId = c.req.param('board_id')
  const body = c.req.valid('json')
  const board = await getBoard(boardId)
  if (!canViewBoard(user, board)) {
    return c.json({ error: "Tidak ada akses" }, 403)
  }
  const count = await db.list.count({ where: { boardId } })
  
  const doc = await db.list.create({
    data: {
      boardId,
      name: body.name.trim(),
      color: body.color,
      position: (count + 1) * 1000
    }
  })
  await broadcastBoard(boardId)
  return c.json(doc)
})

const UpdateListBody = z.object({
  name: z.string().optional(),
  color: z.string().optional().nullable(),
  entryRequirements: z.array(z.string()).optional(),
  archived: z.boolean().optional(),
})

adminRouter.patch('/lists/:list_id', zValidator('json', UpdateListBody), async (c) => {
  const user = c.get('user')
  const listId = c.req.param('list_id')
  const body = c.req.valid('json')
  const lst = await db.list.findUnique({ where: { id: listId }, include: { board: { include: { members: true, division: true } } } })
  if (!lst) return c.json({ error: "List tidak ditemukan" }, 404)

  // Ubah syarat masuk / warna list → izin khusus.
  if (body.entryRequirements !== undefined || body.color !== undefined) await requirePerm(c, 'list.entry_requirements')
  // Arsip / pulihkan / rename list → izin kelola list.
  if (body.archived !== undefined || body.name !== undefined) {
    if (!canEditBoard(user, lst.board)) await requirePerm(c, 'list.manage')
  }

  const updates: any = {}
  if (body.name !== undefined) updates.name = body.name
  if (body.color !== undefined) updates.color = body.color
  if (body.entryRequirements !== undefined) updates.entryRequirements = body.entryRequirements as any
  if (body.archived !== undefined) {
    updates.archived = body.archived
    updates.archivedAt = body.archived ? new Date() : null
  }

  if (Object.keys(updates).length > 0) {
    await db.list.update({ where: { id: listId }, data: updates })
    await broadcastBoard(lst.boardId)

    // "CS seragam semua" — board apa pun yang divisinya CS berbagi SATU
    // config warna, nama, & syarat pindah list (staf CS punya board masing-masing
    // tapi list-nya identik). Board Admin per-divisi (draf/pajak/dst) tidak
    // ikut fan-out ini, tetap terpisah seperti sebelumnya.
    const isCsBoard = lst.board.division?.key === 'cs'
    const fanOutFields: any = {}
    if (body.name !== undefined) fanOutFields.name = body.name
    if (body.color !== undefined) fanOutFields.color = body.color
    if (body.entryRequirements !== undefined) fanOutFields.entryRequirements = body.entryRequirements as any
    if (isCsBoard && Object.keys(fanOutFields).length > 0) {
      const siblings = await db.list.findMany({
        where: {
          id: { not: listId },
          name: { equals: lst.name, mode: 'insensitive' },
          board: { divisionId: lst.board.divisionId },
        },
        select: { id: true, boardId: true },
      })
      for (const sib of siblings) {
        await db.list.update({ where: { id: sib.id }, data: fanOutFields })
        await broadcastBoard(sib.boardId)
      }
    }
  }
  const updated = await db.list.findUnique({ where: { id: listId } })
  return c.json(updated)
})

adminRouter.delete('/lists/:list_id', async (c) => {
  await requirePerm(c, 'list.manage')
  const listId = c.req.param('list_id')
  const lst = await db.list.findUnique({ where: { id: listId } })
  if (!lst) return c.json({ error: "List tidak ditemukan" }, 404)
  
  await db.workItem.updateMany({
    where: { listId },
    data: { archived: true, updatedAt: new Date() }
  })
  
  await db.list.delete({ where: { id: listId } })
  await broadcastBoard(lst.boardId)
  return c.json({ ok: true })
})

const ReorderListsBody = z.object({
  orderedIds: z.array(z.string()),
})

adminRouter.post('/boards/:board_id/lists/reorder', zValidator('json', ReorderListsBody), async (c) => {
  await requirePerm(c, 'list.manage')
  const boardId = c.req.param('board_id')
  const body = c.req.valid('json')
  
  for (let i = 0; i < body.orderedIds.length; i++) {
    const lid = body.orderedIds[i]
    await db.list.updateMany({
      where: { id: lid, boardId },
      data: { position: (i + 1) * 1000 }
    })
  }
  await broadcastBoard(boardId)
  return c.json({ ok: true })
})

adminRouter.post('/lists/:list_id/copy', async (c) => {
  await requirePerm(c, 'list.manage')
  const user = c.get('user')
  const listId = c.req.param('list_id')
  const src = await db.list.findUnique({ where: { id: listId } })
  if (!src) return c.json({ error: "List tidak ditemukan" }, 404)
  
  const count = await db.list.count({ where: { boardId: src.boardId } })
  const nl = await db.list.create({
    data: {
      boardId: src.boardId,
      name: `${src.name} (salinan)`,
      color: src.color,
      entryRequirements: src.entryRequirements as any,
      position: (count + 1) * 1000
    }
  })
  
  const cards = await db.workItem.findMany({ where: { listId, archived: false } })
  for (const c of cards) {
    await db.workItem.create({
      data: {
        title: c.title,
        clientName: c.clientName,
        description: c.description,
        boardId: c.boardId,
        listId: nl.id,
        position: c.position,
        dueDate: c.dueDate,
        priority: c.priority,
        status: "active",
        archived: false,
        needsApproval: c.needsApproval,
        createdById: user.id,
        createdByName: user.name,
        checklists: c.checklists as any,
      }
    })
  }
  
  await broadcastBoard(src.boardId)
  return c.json(nl)
})

adminRouter.post('/lists/:list_id/archive-all-cards', async (c) => {
  await requirePerm(c, 'list.manage')
  const listId = c.req.param('list_id')
  const lst = await db.list.findUnique({ where: { id: listId } })
  if (!lst) return c.json({ error: "List tidak ditemukan" }, 404)
  
  const res = await db.workItem.updateMany({
    where: { listId, archived: false },
    data: { archived: true, updatedAt: new Date() }
  })
  await broadcastBoard(lst.boardId)
  return c.json({ ok: true, archived: res.count })
})

const MoveListBody = z.object({
  boardId: z.string(),
})

adminRouter.post('/lists/:list_id/move', zValidator('json', MoveListBody), async (c) => {
  const user = c.get('user')
  await requirePerm(c, 'list.manage')
  const listId = c.req.param('list_id')
  const body = c.req.valid('json')
  
  const lst = await db.list.findUnique({ where: { id: listId } })
  if (!lst) return c.json({ error: "List tidak ditemukan" }, 404)
  
  const target = await getBoard(body.boardId)
  const count = await db.list.count({ where: { boardId: body.boardId } })
  const oldBoard = lst.boardId
  
  await db.list.update({
    where: { id: listId },
    data: { boardId: body.boardId, position: (count + 1) * 1000 }
  })
  
  await db.workItem.updateMany({
    where: { listId },
    data: { boardId: body.boardId, updatedAt: new Date() }
  })
  
  await broadcastBoard(oldBoard)
  await broadcastBoard(target.id)
  return c.json({ ok: true })
})

// ---------- LABELS ----------

const LabelBody = z.object({
  name: z.string(),
  color: z.string(),
})

adminRouter.post('/boards/:board_id/labels', zValidator('json', LabelBody), async (c) => {
  await requirePerm(c, 'label.manage')
  const boardId = c.req.param('board_id')
  const body = c.req.valid('json')
  await getBoard(boardId) // ensures exists
  
  const doc = await db.label.create({
    data: {
      boardId,
      name: body.name.trim(),
      color: body.color
    }
  })
  await broadcastBoard(boardId)
  return c.json(doc)
})

adminRouter.patch('/labels/:label_id', zValidator('json', LabelBody), async (c) => {
  await requirePerm(c, 'label.manage')
  const labelId = c.req.param('label_id')
  const body = c.req.valid('json')
  
  const lbl = await db.label.findUnique({ where: { id: labelId } })
  if (!lbl) return c.json({ error: "Label tidak ditemukan" }, 404)
  
  const updated = await db.label.update({
    where: { id: labelId },
    data: { name: body.name.trim(), color: body.color }
  })
  await broadcastBoard(lbl.boardId)
  return c.json(updated)
})

adminRouter.delete('/labels/:label_id', async (c) => {
  await requirePerm(c, 'label.manage')
  const labelId = c.req.param('label_id')
  const lbl = await db.label.findUnique({ where: { id: labelId } })
  if (!lbl) return c.json({ error: "Label tidak ditemukan" }, 404)
  
  await db.label.delete({ where: { id: labelId } })
  // Casade handles WorkItemLabel deletion
  await broadcastBoard(lbl.boardId)
  return c.json({ ok: true })
})

// ---------- AUTOMATION ----------

adminRouter.get('/boards/:board_id/automation', async (c) => {
  const boardId = c.req.param('board_id')
  const rules = await db.automationRule.findMany({ where: { boardId } })
  return c.json(rules)
})

// NB: field di sini sengaja snake_case — itu yang benar-benar dikirim
// AutomationModal.jsx. Sebelumnya schema ini pakai camelCase (triggerListId/
// actionValue) yang TIDAK PERNAH match body asli → actionValue selalu ke-parse
// jadi undefined → setiap aturan otomasi board yang dibuat lewat UI tersimpan
// dengan nilai aksi kosong (null), diam-diam tidak pernah benar-benar bekerja.
const AutomationBody = z.object({
  trigger: z.string(),
  trigger_list_id: z.string().optional().nullable(),
  action: z.string(),
  action_value: z.string().optional().nullable(),
})

adminRouter.post('/boards/:board_id/automation', zValidator('json', AutomationBody), async (c) => {
  const user = c.get('user')
  await requirePerm(c, 'automation.manage')
  const boardId = c.req.param('board_id')
  const body = c.req.valid('json')

  if (!["card_created", "card_moved", "card_mirrored", "mirror_removed"].includes(body.trigger)) {
    return c.json({ error: "Trigger tidak valid" }, 400)
  }
  if (!["add_label", "remove_label", "set_priority", "assign_division"].includes(body.action)) {
    return c.json({ error: "Aksi tidak valid" }, 400)
  }

  const doc = await db.automationRule.create({
    data: {
      boardId,
      trigger: body.trigger,
      triggerListId: body.trigger_list_id,
      action: body.action,
      actionValue: body.action_value,
      createdById: user.id
    }
  })
  return c.json(doc)
})

adminRouter.delete('/automation/:rule_id', async (c) => {
  const user = c.get('user')
  await requirePerm(c, 'automation.manage')
  const ruleId = c.req.param('rule_id')
  await db.automationRule.delete({ where: { id: ruleId } })
  return c.json({ ok: true })
})

// ---------- ACTIVITIES & STATS ----------

adminRouter.get('/activities', async (c) => {
  const user = c.get('user')
  requireSupervisor(user)
  const limit = Math.min(Math.max(parseInt(c.req.query('limit') || '80', 10) || 80, 1), 300)
  const q = (c.req.query('q') || '').trim()
  const boardId = c.req.query('board_id') || undefined
  const userId = c.req.query('user_id') || undefined

  const where: any = {}
  if (q) where.action = { contains: q, mode: 'insensitive' }
  if (boardId) where.boardId = boardId
  if (userId) where.userId = userId

  const acts = await db.activity.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      workItem: { select: { id: true, title: true, masterCardId: true } },
      board: { select: { id: true, name: true, division: { select: { key: true, name: true } } } },
    },
  })
  return c.json(acts.map((a) => ({
    id: a.id,
    action: a.action,
    detail: a.detail,
    user_id: a.userId,
    user_name: a.userName,
    created_at: a.createdAt,
    work_item_id: a.workItemId,
    card_title: a.workItem?.title || null,
    is_master_card: !!a.workItem?.masterCardId,
    board_id: a.boardId,
    board_name: a.board?.name || null,
    division_name: a.board?.division?.name || null,
    division_key: a.board?.division?.key || null,
  })))
})

adminRouter.get('/stats', async (c) => {
  const user = c.get('user')
  const isOverseer = ["super_admin", "supervisor"].includes(user?.role)

  // Non-supervisor: dashboard hanya menampilkan data DIRINYA + DIVISINYA.
  // CS and Staff get their own division. Admin Operasional gets all non-CS divisions.
  const scope: any = isOverseer ? {} : user?.role === "admin" ? {
    OR: [
      { members: { some: { userId: user.id } } },
      { currentPicId: user.id },
      { createdById: user.id },
      { board: { division: { key: { not: "cs" } } } },
      { divisionIds: { some: { division: { key: { not: "cs" } } } } }
    ]
  } : {
    OR: [
      { members: { some: { userId: user.id } } },
      { currentPicId: user.id },
      { createdById: user.id },
      ...(user.divisionId ? [
        { board: { divisionId: user.divisionId } },
        { divisionIds: { some: { divisionId: user.divisionId } } },
      ] : []),
    ],
  }
  const withScope = (w: any) => (isOverseer ? w : { AND: [w, scope] })

  const activeFilter = { archived: false, status: { not: "done" } }

  const totalActive = await db.workItem.count({ where: withScope(activeFilter) })
  
  const unassigned = await db.workItem.count({ where: withScope({ ...activeFilter, members: { none: {} } }) })
  
  const inProgress = await db.workItem.count({ where: withScope({ ...activeFilter, members: { some: {} } }) })
  
  const today = todayStr()
  const overdue = await db.workItem.count({ where: withScope({ ...activeFilter, dueDate: { not: null, lt: today } }) })
  
  const submitted = await db.workItem.count({ where: withScope({ archived: false, status: "submitted" }) })
  
  // Use Prisma client to get doneToday. Since completedAt is DateTime:
  const startOfToday = new Date()
  startOfToday.setHours(0,0,0,0)
  const doneToday = await db.workItem.count({ where: withScope({ completedAt: { gte: startOfToday } }) })
  
  const divisions = isOverseer
    ? await db.division.findMany({ orderBy: { name: 'asc' }, take: 100 })
    : await db.division.findMany({ where: user.divisionId ? { id: user.divisionId } : { id: '__none__' }, take: 5 })
  const byDivision = []
  for (const d of divisions) {
    const c = await db.workItem.count({ where: withScope({ ...activeFilter, divisionIds: { some: { divisionId: d.id } } }) })
    byDivision.push({ id: d.id, name: d.name, color: d.color, count: c })
  }
  
  // To replace MongoDB aggregate:
  // get all members for active tasks and aggregate in code for simplicity
  const activeItemsWithMembers = await db.workItem.findMany({ where: withScope(activeFilter), include: { members: true } })
  
  const userCountMap = new Map<string, number>()
  for (const item of activeItemsWithMembers) {
    for (const mem of item.members) {
      userCountMap.set(mem.userId, (userCountMap.get(mem.userId) || 0) + 1)
    }
  }
  
  const userEntries = Array.from(userCountMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 12)
  const userIds = userEntries.map(e => e[0])
  
  const rawUsers = await db.user.findMany({ where: { id: { in: userIds } } })
  const userMap = new Map(rawUsers.map(u => [u.id, u]))
  
  const byUser = userEntries.map(([uid, count]) => {
    const u = userMap.get(uid)
    return {
      id: uid,
      name: u ? u.name : "?",
      color: u && u.avatarColor ? u.avatarColor : "#0C66E4",
      avatar_url: u ? userAvatarUrl(u) : null,
      count
    }
  })
  
  return c.json({
    total_active: totalActive,
    unassigned,
    in_progress: inProgress,
    overdue,
    submitted,
    done_today: doneToday,
    by_division: byDivision,
    by_user: byUser,
    scoped: !isOverseer,
    scope_label: isOverseer ? 'Ringkasan Global' : 'Ringkasan Anda & Divisi',
  })
})

// ---------- CHECKLIST TEMPLATES ----------
// GET: semua user login (dipakai saat menambah checklist di kartu).
// POST/PATCH/DELETE: admin saja (dikelola dari Panel Admin).

const asItems = (v) => {
  if (Array.isArray(v)) return v.map((s) => String(s).trim()).filter(Boolean)
  if (typeof v === 'string') {
    return v.split('\n').map((s) => s.trim()).filter(Boolean)
  }
  return []
}
const tplOut = (t) => ({
  id: t.id,
  name: t.name,
  items: Array.isArray(t.items) ? t.items : asItems(t.items),
  position: t.position,
  cs_self_check: !!t.csSelfCheck,
  created_at: t.createdAt,
})

adminRouter.get('/checklist-templates', async (c) => {
  const rows = await db.checklistTemplate.findMany({ orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] })
  return c.json(rows.map(tplOut))
})

adminRouter.post('/checklist-templates', async (c) => {
  const user = c.get('user')
  await requirePerm(c, 'checklist_template.manage')
  const body = await c.req.json()
  const name = (body.name || '').trim()
  if (!name) return c.json({ error: 'Nama template wajib diisi' }, 400)
  const items = asItems(body.items)
  const count = await db.checklistTemplate.count()
  const created = await db.checklistTemplate.create({
    data: { name, items, position: (count + 1) * 10, createdById: user.id, csSelfCheck: !!body.cs_self_check },
  })
  return c.json(tplOut(created))
})

adminRouter.patch('/checklist-templates/:id', async (c) => {
  const user = c.get('user')
  await requirePerm(c, 'checklist_template.manage')
  const id = c.req.param('id')
  const body = await c.req.json()
  const data = {}
  if (body.name !== undefined) {
    const name = (body.name || '').trim()
    if (!name) return c.json({ error: 'Nama template wajib diisi' }, 400)
    data.name = name
  }
  if (body.items !== undefined) data.items = asItems(body.items)
  if (body.position !== undefined) data.position = Number(body.position) || 0
  if (body.cs_self_check !== undefined) data.csSelfCheck = !!body.cs_self_check
  const updated = await db.checklistTemplate.update({ where: { id }, data })
  return c.json(tplOut(updated))
})

adminRouter.delete('/checklist-templates/:id', async (c) => {
  const user = c.get('user')
  await requirePerm(c, 'checklist_template.manage')
  const id = c.req.param('id')
  await db.checklistTemplate.delete({ where: { id } })
  return c.json({ ok: true })
})

// ---------- SETTINGS (toggle app-wide, dikelola dari Panel Admin) ----------
const AUTO_LABEL_PAYMENT_KEY = 'auto_label_payment_status'

adminRouter.get('/settings/auto-label-payment', async (c) => {
  const user = c.get('user')
  requireSupervisor(user)
  const value = await getSetting(AUTO_LABEL_PAYMENT_KEY)
  return c.json({ enabled: !!value?.enabled })
})

adminRouter.patch('/settings/auto-label-payment', async (c) => {
  const user = c.get('user')
  requireSupervisor(user)
  const body = await c.req.json()
  await setSetting(AUTO_LABEL_PAYMENT_KEY, { enabled: !!body.enabled })
  return c.json({ enabled: !!body.enabled })
})

// ---------- GLOBAL AUTOMATION RULES (Panel Admin -> Otomasi, lintas board) ----------
// Beda dari AutomationRule (per-board): tidak terikat satu board, dipakai untuk
// kejadian level Master Card/job (harga diisi, status bayar berubah). Lihat
// runGlobalAutomation() di routes_work.ts untuk mesin eksekusinya.
const gaOut = (r: any) => ({
  id: r.id,
  trigger: r.trigger,
  condition_value: r.conditionValue,
  action: r.action,
  action_value: r.actionValue,
  enabled: r.enabled,
  created_at: r.createdAt,
})

const GA_TRIGGERS = ['card_created', 'price_set', 'payment_status_changed']
const GA_ACTIONS = ['add_label', 'set_priority', 'send_to_division']

adminRouter.get('/global-automation-rules', async (c) => {
  const user = c.get('user')
  await requirePerm(c, 'automation.manage')
  const rows = await db.globalAutomationRule.findMany({ orderBy: { createdAt: 'asc' } })
  return c.json(rows.map(gaOut))
})

const GlobalAutomationBody = z.object({
  trigger: z.string(),
  condition_value: z.string().optional().nullable(),
  action: z.string(),
  action_value: z.string().optional().nullable(),
})

adminRouter.post('/global-automation-rules', zValidator('json', GlobalAutomationBody), async (c) => {
  const user = c.get('user')
  await requirePerm(c, 'automation.manage')
  const body = c.req.valid('json')
  if (!GA_TRIGGERS.includes(body.trigger)) return c.json({ error: 'Kejadian tidak valid' }, 400)
  if (!GA_ACTIONS.includes(body.action)) return c.json({ error: 'Aksi tidak valid' }, 400)
  const doc = await db.globalAutomationRule.create({
    data: {
      trigger: body.trigger,
      conditionValue: body.condition_value,
      action: body.action,
      actionValue: body.action_value,
      createdById: user.id,
    },
  })
  return c.json(gaOut(doc))
})

adminRouter.patch('/global-automation-rules/:rule_id', async (c) => {
  const user = c.get('user')
  await requirePerm(c, 'automation.manage')
  const ruleId = c.req.param('rule_id')
  const body = await c.req.json().catch(() => ({}))
  const data: any = {}
  if (body.enabled !== undefined) data.enabled = !!body.enabled
  const updated = await db.globalAutomationRule.update({ where: { id: ruleId }, data })
  return c.json(gaOut(updated))
})

adminRouter.delete('/global-automation-rules/:rule_id', async (c) => {
  const user = c.get('user')
  await requirePerm(c, 'automation.manage')
  const ruleId = c.req.param('rule_id')
  await db.globalAutomationRule.delete({ where: { id: ruleId } }).catch(() => {})
  return c.json({ ok: true })
})
