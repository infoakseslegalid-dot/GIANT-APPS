// @ts-nocheck
/**
 * Backfill / sinkronisasi Bank Data:
 *  - Setiap WorkItem punya MasterCard induk.
 *  - Owner MasterCard diturunkan dari pembuat (jika CS) atau dari board CS-nya.
 * Idempoten: aman dijalankan berulang.
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function resolveOwner(item: any, csId: string | null) {
  const creator = item.createdById ? await prisma.user.findUnique({ where: { id: item.createdById } }) : null;
  if (creator?.divisionId && creator.divisionId === csId) return { ownerUserId: creator.id, ownerDivisionId: csId };
  const board = await prisma.board.findUnique({
    where: { id: item.boardId },
    include: { members: { include: { user: true } } },
  });
  if (board?.divisionId === csId) {
    const m = board.members.find((x: any) => x.user?.divisionId === csId);
    return { ownerUserId: m?.userId || null, ownerDivisionId: csId };
  }
  return { ownerUserId: null, ownerDivisionId: board?.divisionId || creator?.divisionId || null };
}

async function main() {
  const csDiv = await prisma.division.findFirst({ where: { key: 'cs' } });
  const csId = csDiv?.id || null;

  const items = await prisma.workItem.findMany({ include: { masterCard: true } });
  let made = 0;
  let fixed = 0;

  for (const it of items) {
    if (!it.masterCardId) {
      const owner = await resolveOwner(it, csId);
      const mc = await prisma.masterCard.create({
        data: { title: it.title, client: it.clientName || null, ...owner },
      });
      await prisma.workItem.update({
        where: { id: it.id },
        data: { masterCardId: mc.id, workStatus: it.workStatus || (it.currentPicId ? 'CLAIMED' : null) },
      });
      made++;
    } else if (it.masterCard && !it.masterCard.ownerUserId) {
      const owner = await resolveOwner(it, csId);
      if (owner.ownerUserId || owner.ownerDivisionId) {
        await prisma.masterCard.update({ where: { id: it.masterCardId }, data: owner });
        fixed++;
      }
    }
  }
  console.log(`MasterCard baru: ${made} | owner diperbaiki: ${fixed}`);
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
