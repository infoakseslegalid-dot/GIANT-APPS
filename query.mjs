import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const boards = await prisma.board.findMany({
    include: {
      lists: { orderBy: { position: 'asc' } }
    }
  })
  console.log(JSON.stringify(boards, null, 2))
}
main().catch(e => console.error(e)).finally(() => prisma.$disconnect())
