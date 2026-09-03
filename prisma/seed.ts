// @ts-nocheck
import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'
import { LIST_TEMPLATES, DEFAULT_LIST_COLOR } from '../src/server/bankdata_templates'

const prisma = new PrismaClient()

const hashPassword = (password: string) => bcrypt.hashSync(password, 10)

const LABEL_SET = [
  ["LUNAS", "#22A06B"],
  ["DP", "#F5CD47"],
  ["BELUM PENYERAHAN", "#E56910"],
  ["URGENT", "#CA3521"],
  ["VIA GC ADMIN", "#9F8FEF"],
  ["NOT SOPPENG", "#0C66E4"],
  ["NOT BANDUNG", "#1D7AFC"],
  ["NOT TANGSEL", "#579DFF"],
  ["MKS", "#6CC3E0"],
  ["JKT", "#94C748"],
  ["SUDAH ADA LOGO", "#4BCE97"],
  ["SUDAH ADA AKUN DASHBOARD", "#8590A2"],
  ["SALINAN KEMBALI", "#F87168"],
  ["TER-MIRROR", "#2684FF"],
]

const DIVISIONS = [
  ["cs", "Customer Service", "#0C66E4"],
  ["draf", "Admin Draf Input", "#E56910"],
  ["pajak", "Admin Pajak", "#22A06B"],
  ["perizinan", "Admin Perizinan", "#9F8FEF"],
  ["desain", "Desain & Konten", "#E774BB"],
]

const USERS = [
  ["Dedes Ali", "dedes@ali.id", "staff", "cs", "#0C66E4"],
  ["Devi Ali", "devi@ali.id", "staff", "cs", "#1D7AFC"],
  ["Dewi Ali", "dewi@ali.id", "staff", "cs", "#579DFF"],
  ["Julia Ali", "julia@ali.id", "staff", "cs", "#6CC3E0"],
  ["Elis", "elis@ali.id", "staff", "draf", "#E56910"],
  ["Anti", "anti@ali.id", "staff", "draf", "#F5CD47"],
  ["Amel", "amel@ali.id", "staff", "pajak", "#22A06B"],
  ["Andi", "andi@ali.id", "supervisor", "perizinan", "#9F8FEF"],
  ["Rina", "rina@ali.id", "staff", "desain", "#E774BB"],
]

const BOARDS: any[] = [
  ["CS DEDES ALI", "cs", ["Dedes Ali"], "#0079bf", LIST_TEMPLATES.cs],
  ["CS DEVI ALI", "cs", ["Devi Ali"], "#519839", LIST_TEMPLATES.cs],
  ["CS DEWI ALI", "cs", ["Dewi Ali"], "#B04632", LIST_TEMPLATES.cs],
  ["CS JULIA ALI", "cs", ["Julia Ali"], "#89609E", LIST_TEMPLATES.cs],
  ["ADMIN DRAF INPUT", "draf", ["Elis", "Anti"], "#D29034", LIST_TEMPLATES.draf],
  ["ADMIN PAJAK", "pajak", ["Amel"], "#4BBF6B", LIST_TEMPLATES.pajak],
  ["ADMIN PERIZINAN", "perizinan", ["Andi"], "#CD5A91", LIST_TEMPLATES.perizinan],
  ["DESAIN & KONTEN", "desain", ["Rina"], "#00AECC", LIST_TEMPLATES.desain],
]

const SAMPLE_CARDS: any[] = [
  ["CS DEDES ALI", "PT Illank Rezeki Abadi - Pendirian PT", "PT Illank Rezeki Abadi", 1, ["DP", "NOT TANGSEL"], 3, true, "Dedes Ali"],
  ["CS DEDES ALI", "CV Arkana Cipta Persada - Revisi Akta", "CV Arkana Cipta Persada", 2, ["URGENT"], 1, true, null],
  ["CS DEDES ALI", "UD Sinar Bahagia - Pengumpulan Berkas", "UD Sinar Bahagia", 1, [], 7, false, null],
  ["CS DEVI ALI", "PT Nusantara Jaya - Proses Notaris", "PT Nusantara Jaya", 3, ["LUNAS", "JKT"], 5, true, "Devi Ali"],
  ["CS DEVI ALI", "CV Mentari Pagi - Komplain Dokumen", "CV Mentari Pagi", 0, ["URGENT", "BELUM PENYERAHAN"], 1, false, null],
  ["CS DEWI ALI", "PT Graha Sentosa - Pendirian + NIB", "PT Graha Sentosa", 4, ["LUNAS"], 2, true, "Dewi Ali"],
  ["CS DEWI ALI", "Yayasan Cahaya Ilmu - Pendirian Yayasan", "Yayasan Cahaya Ilmu", 1, ["DP", "NOT BANDUNG"], 6, true, null],
  ["CS JULIA ALI", "PT Bintang Timur - Follow Up Klien", "PT Bintang Timur", 6, [], 4, false, "Julia Ali"],
  ["CS JULIA ALI", "CV Karya Mandala - Pengumpulan Berkas", "CV Karya Mandala", 1, ["DP"], 8, true, null],
  ["ADMIN DRAF INPUT", "PT Illank Rezeki Abadi - Draft Akta", "PT Illank Rezeki Abadi", 0, ["NOT TANGSEL"], 2, true, "Elis"],
  ["ADMIN DRAF INPUT", "CV Arkana Cipta Persada - Pesan Nama", "CV Arkana Cipta Persada", 4, ["URGENT", "VIA GC ADMIN"], 1, false, "Anti"],
  ["ADMIN DRAF INPUT", "PT Nusantara Jaya - Siap Kirim Notaris", "PT Nusantara Jaya", 2, ["LUNAS", "JKT"], 1, true, "Elis"],
  ["ADMIN PAJAK", "PT Graha Sentosa - NPWP Badan", "PT Graha Sentosa", 1, ["MKS"], 5, true, "Amel"],
  ["ADMIN PAJAK", "CV Mentari Pagi - SPT Tahunan", "CV Mentari Pagi", 0, ["BELUM PENYERAHAN"], 10, false, null],
  ["ADMIN PERIZINAN", "PT Bintang Timur - Pengurusan Merek", "PT Bintang Timur", 2, ["URGENT"], 7, true, "Andi"],
  ["ADMIN PERIZINAN", "UD Sinar Bahagia - NIB OSS", "UD Sinar Bahagia", 0, ["NOT SOPPENG"], 3, true, null],
  ["DESAIN & KONTEN", "PT Graha Sentosa - Logo & Compro", "PT Graha Sentosa", 1, ["SUDAH ADA LOGO"], 6, true, "Rina"],
  ["DESAIN & KONTEN", "Konten Layanan Pendirian PT", "Internal", 0, [], 2, false, null],
]

// dicocokkan dengan substring nama list (syarat masuk list CS)
const CS_STAGE_REQUIREMENTS: Record<string, string[]> = {
  "SKOR 4": ["KTP", "NPWP", "Pembayaran DP/Lunas"],
  "SKOR 5 SIAP KIRIM NOTARIS": ["Minuta Akta"],
  "SKOR 5 (NPWP)": ["SK Kemenkumham"],
  "SKOR 5 (NIB)": ["NPWP"],
  "SKOR 6 FINISH": ["NIB"],
  "SKOR 7": ["Penyerahan"],
}

async function main() {
  console.log('Starting DB seed...')
  
  // Seed Super Admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      name: 'Super Admin',
      email: 'admin@example.com',
      passwordHash: hashPassword('admin123'),
      role: 'super_admin',
      avatarColor: '#CA3521'
    }
  })

  const divMap: Record<string, string> = {}
  for (const [key, name, color] of DIVISIONS) {
    const div = await prisma.division.upsert({
      where: { key },
      update: {},
      create: { name, key, color }
    })
    divMap[key] = div.id
  }

  const userMap: Record<string, string> = {}
  for (const [name, email, role, divKey, color] of USERS) {
    const u = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        name, email, role,
        passwordHash: hashPassword('Staff123!'),
        divisionId: divMap[divKey],
        avatarColor: color
      }
    })
    userMap[name] = u.id
  }

  const boardMap: Record<string, string> = {}
  const listMap: Record<string, string[]> = {}
  const labelMap: Record<string, Record<string, string>> = {}

  for (const [bname, divKey, members, bg, listNames] of BOARDS) {
    // idempoten: jangan buat board duplikat kalau namanya sudah ada
    let board = await prisma.board.findFirst({ where: { name: bname } })
    if (board) {
      console.log(`  board "${bname}" sudah ada — dilewati`)
      boardMap[bname] = board.id
      listMap[bname] = (await prisma.list.findMany({ where: { boardId: board.id }, orderBy: { position: 'asc' } })).map((l) => l.id)
      labelMap[bname] = Object.fromEntries((await prisma.label.findMany({ where: { boardId: board.id } })).map((l) => [l.name, l.id]))
      continue
    }
    board = await prisma.board.create({
      data: {
        name: bname,
        divisionId: divMap[divKey],
        background: bg,
        createdById: admin.id,
        members: {
          create: members.map((m: string) => ({ userId: userMap[m] }))
        }
      }
    })
    boardMap[bname] = board.id

    const lids = []
    for (let i = 0; i < listNames.length; i++) {
      const lname = listNames[i]
      let reqs: string[] | undefined = undefined
      for (const [needle, rs] of Object.entries(CS_STAGE_REQUIREMENTS)) {
        if (lname.includes(needle)) {
          reqs = rs
          break
        }
      }
      
      const list = await prisma.list.create({
        data: {
          boardId: board.id,
          name: lname,
          position: (i + 1) * 1000,
          color: DEFAULT_LIST_COLOR,
          entryRequirements: reqs ?? null   // kolom Json — simpan array langsung, JANGAN stringify
        }
      })
      lids.push(list.id)
    }
    listMap[bname] = lids

    const lmap: Record<string, string> = {}
    for (const [lname, lcolor] of LABEL_SET) {
      const lab = await prisma.label.create({
        data: { boardId: board.id, name: lname, color: lcolor }
      })
      lmap[lname] = lab.id
    }
    labelMap[bname] = lmap

    if (lmap["TER-MIRROR"]) {
      await prisma.automationRule.createMany({
        data: [
          { boardId: board.id, trigger: "card_mirrored", action: "add_label", actionValue: lmap["TER-MIRROR"], createdById: admin.id },
          { boardId: board.id, trigger: "mirror_removed", action: "remove_label", actionValue: lmap["TER-MIRROR"], createdById: admin.id }
        ]
      })
    }
  }

  for (const [bname, title, client, listIdx, labelNames, dueDays, withChecklist, memberName] of SAMPLE_CARDS) {
    const bid = boardMap[bname]
    const lids = listMap[bname]
    const idx = listIdx >= lids.length ? 0 : listIdx
    
    const due = new Date()
    due.setDate(due.getDate() + dueDays)

    let checklists = null
    if (withChecklist) {
      checklists = [{
        id: crypto.randomUUID(),
        title: "Syarat Berkas",
        items: [
          { id: crypto.randomUUID(), text: "KTP Direksi", done: true },
          { id: crypto.randomUUID(), text: "NPWP", done: true },
          { id: crypto.randomUUID(), text: "Akta Pendirian", done: false },
          { id: crypto.randomUUID(), text: "SK Kemenkumham", done: false },
        ]
      }]
    }

    const needsApproval = title.includes("Siap Kirim")

    const createdBy = admin.id
    const divId = await prisma.board.findUnique({where: {id: bid}}).then(b => b?.divisionId)

    const wi = await prisma.workItem.create({
      data: {
        title,
        clientName: client,
        boardId: bid,
        listId: lids[idx],
        position: 1000,
        dueDate: due.toISOString().split('T')[0],
        priority: labelNames.includes("URGENT") ? "urgent" : "none",
        status: needsApproval ? "submitted" : "active",
        needsApproval,
        createdById: createdBy,
        createdByName: admin.name,
        submittedById: needsApproval && memberName ? userMap[memberName] : null,
        checklists: checklists ? JSON.stringify(checklists) : null,
        
        labels: {
          create: labelNames.filter((l: string) => labelMap[bname][l]).map((l: string) => ({ labelId: labelMap[bname][l] }))
        },
        members: memberName ? {
          create: [{ userId: userMap[memberName] }]
        } : undefined,
        divisionIds: divId ? {
          create: [{ divisionId: divId }]
        } : undefined
      }
    })

    if (title.startsWith("PT Graha Sentosa - Pendirian")) {
      const targetBid = boardMap["ADMIN PERIZINAN"]
      if (targetBid) {
        await prisma.workItemMirror.create({
          data: { workItemId: wi.id, boardId: targetBid }
        })
        await prisma.workItemLabel.create({
          data: { workItemId: wi.id, labelId: labelMap["CS DEWI ALI"]["TER-MIRROR"] }
        })
      }
    }
  }

  console.log('Seed completed.')
}

main().catch(console.error).finally(() => prisma.$disconnect())
