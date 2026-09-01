import { formatWorkItem, publicUser } from './deps';
// @ts-nocheck
import {
  Hono } from 'hono'
import {
  z } from 'zod'
import {
  zValidator } from '@hono/zod-validator'
import {
  db, requireAdmin, requireSupervisor, canViewBoard, broadcastBoard, getBoard, hashPassword, todayStr
} from './deps'

export const adminRouter = new Hono()



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
  requireAdmin(user)
  const body = c.req.valid('json')
  const email = body.email.toLowerCase().trim()
  
  const existing = await db.user.findUnique({ where: { email } })
  if (existing) {
    return c.json({ error: "Email sudah terdaftar" }, 400)
  }
  
  if (!["super_admin", "admin", "supervisor", "staff", "viewer"].includes(body.role)) {
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
  role: z.string().optional(),
  division_id: z.string().optional().nullable(),
  is_active: z.boolean().optional(),
  password: z.string().optional(),
  avatar_color: z.string().optional(),
})

adminRouter.patch('/users/:user_id', zValidator('json', UpdateUserBody), async (c) => {
  const user = c.get('user')
  requireAdmin(user)
  const userId = c.req.param('user_id')
  const body = c.req.valid('json')
  
  const updates: any = {}
  if (body.name !== undefined) updates.name = body.name
  if (body.role !== undefined) {
    if (!["super_admin", "admin", "supervisor", "staff", "viewer"].includes(body.role)) {
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
  requireAdmin(user)
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
  requireAdmin(user)
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
  requireAdmin(user)
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
    include: { members: true, workItems: { where: { archived: false } } }
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
  requireAdmin(user)
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
  requireAdmin(user)
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
  requireAdmin(user)
  const boardId = c.req.param('board_id')
  
  await db.board.update({ where: { id: boardId }, data: { isArchived: true } })
  return c.json({ ok: true })
})

adminRouter.post('/boards/:board_id/unarchive', async (c) => {
  const user = c.get('user')
  requireAdmin(user)
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

const CopyBoardBody = z.object({
  name: z.string(),
  withCards: z.boolean().default(false),
})

adminRouter.post('/boards/:board_id/copy', zValidator('json', CopyBoardBody), async (c) => {
  const user = c.get('user')
  requireAdmin(user)
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
  
  const lists = await db.list.findMany({ where: { boardId }, orderBy: { position: 'asc' } })
  const labels = await db.label.findMany({ where: { boardId } })
  
  const cards = await db.workItem.findMany({
    where: {
      OR: [
        { boardId },
        { mirrorBoards: { some: { boardId } } }
      ],
      archived: false
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
  
  return c.json({
    board,
    lists,
    labels,
    cards: cards.map(formatWorkItem),
    division,
    users,
    archived_count: archivedCount,
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
  return c.json(cards.map(formatWorkItem))
})

// ---------- LISTS ----------

const CreateListBody = z.object({
  name: z.string(),
  color: z.string().optional().nullable(),
})

adminRouter.post('/boards/:board_id/lists', zValidator('json', CreateListBody), async (c) => {
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
})

adminRouter.patch('/lists/:list_id', zValidator('json', UpdateListBody), async (c) => {
  const listId = c.req.param('list_id')
  const body = c.req.valid('json')
  const lst = await db.list.findUnique({ where: { id: listId } })
  if (!lst) return c.json({ error: "List tidak ditemukan" }, 404)
  
  const updates: any = {}
  if (body.name !== undefined) updates.name = body.name
  if (body.color !== undefined) updates.color = body.color
  if (body.entryRequirements !== undefined) updates.entryRequirements = body.entryRequirements as any
  
  if (Object.keys(updates).length > 0) {
    await db.list.update({ where: { id: listId }, data: updates })
    await broadcastBoard(lst.boardId)
  }
  const updated = await db.list.findUnique({ where: { id: listId } })
  return c.json(updated)
})

adminRouter.delete('/lists/:list_id', async (c) => {
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
  requireSupervisor(user)
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

const AutomationBody = z.object({
  trigger: z.string(),
  triggerListId: z.string().optional().nullable(),
  action: z.string(),
  actionValue: z.string().optional().nullable(),
})

adminRouter.post('/boards/:board_id/automation', zValidator('json', AutomationBody), async (c) => {
  const user = c.get('user')
  requireSupervisor(user)
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
      triggerListId: body.triggerListId,
      action: body.action,
      actionValue: body.actionValue,
      createdById: user.id
    }
  })
  return c.json(doc)
})

adminRouter.delete('/automation/:rule_id', async (c) => {
  const user = c.get('user')
  requireSupervisor(user)
  const ruleId = c.req.param('rule_id')
  await db.automationRule.delete({ where: { id: ruleId } })
  return c.json({ ok: true })
})

// ---------- ACTIVITIES & STATS ----------

adminRouter.get('/activities', async (c) => {
  const user = c.get('user')
  requireSupervisor(user)
  const limit = parseInt(c.req.query('limit') || '50', 10)
  const acts = await db.activity.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit
  })
  return c.json(acts)
})

adminRouter.get('/stats', async (c) => {
  const activeFilter = { archived: false, status: { not: "done" } }
  
  const totalActive = await db.workItem.count({ where: activeFilter })
  
  const unassigned = await db.workItem.count({
    where: {
      ...activeFilter,
      members: { none: {} }
    }
  })
  
  const inProgress = await db.workItem.count({
    where: {
      ...activeFilter,
      members: { some: {} }
    }
  })
  
  const today = todayStr()
  const overdue = await db.workItem.count({
    where: {
      ...activeFilter,
      dueDate: { not: null, lt: today }
    }
  })
  
  const submitted = await db.workItem.count({
    where: { archived: false, status: "submitted" }
  })
  
  // Use Prisma client to get doneToday. Since completedAt is DateTime:
  const startOfToday = new Date()
  startOfToday.setHours(0,0,0,0)
  const doneToday = await db.workItem.count({
    where: {
      completedAt: { gte: startOfToday }
    }
  })
  
  const divisions = await db.division.findMany({ orderBy: { name: 'asc' }, take: 100 })
  const byDivision = []
  for (const d of divisions) {
    const c = await db.workItem.count({
      where: {
        ...activeFilter,
        divisionIds: { some: { divisionId: d.id } }
      }
    })
    byDivision.push({ id: d.id, name: d.name, color: d.color, count: c })
  }
  
  // To replace MongoDB aggregate:
  // get all members for active tasks and aggregate in code for simplicity
  const activeItemsWithMembers = await db.workItem.findMany({
    where: activeFilter,
    include: { members: true }
  })
  
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
    by_user: byUser
  })
})
