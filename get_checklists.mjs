import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const t = await prisma.checklistTemplate.findMany()
  console.log(JSON.stringify(t, null, 2))
}
main().catch(e => console.error(e)).finally(() => prisma.$disconnect())
