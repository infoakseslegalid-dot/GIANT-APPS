import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const lists = await prisma.list.findMany()
  let updatedCount = 0;

  for (const list of lists) {
    let currentReqs = list.entryRequirements || []
    let newReqs = [...currentReqs]
    let changed = false

    const addReq = (req) => {
      if (!newReqs.includes(req)) {
        newReqs.push(req)
        changed = true
      }
    }
    const setReqs = (reqs) => {
      newReqs = reqs;
      changed = true;
    }

    const name = list.name.toUpperCase().trim()

    if (name === 'SKOR 2') {
      setReqs(['Form Data Dasar'])
    } else if (name === 'SKOR 3 BUTUH DRAFT') {
      setReqs(['KTP Pengurus', 'NPWP Pengurus'])
    } else if (name === 'SKOR 3 (DRAFT FINAL TTD)') {
      setReqs(['Draft Disetujui Klien'])
    } else if (name === 'SKOR 4') {
      setReqs(['Bukti Pembayaran (DP/Lunas)'])
    } else if (name === 'SKOR 5 SIAP KIRIM NOTARIS') {
      addReq('Dokumen Ditandatangani')
      addReq('Minuta Akta') // keep existing
    } else if (name === 'SKOR 5' && newReqs.length === 0) {
      addReq('Dokumen Ditandatangani')
    } else if (name === 'SKOR 6 FINISH') {
      addReq('Penyerahan via Dashboard')
    }

    if (changed) {
      await prisma.list.update({
        where: { id: list.id },
        data: { entryRequirements: newReqs }
      })
      updatedCount++
      console.log(`Updated list "${list.name}" in board ${list.boardId}: ${JSON.stringify(newReqs)}`)
    }
  }

  console.log(`\nSuccessfully updated ${updatedCount} lists based on SOP!`)
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect())
