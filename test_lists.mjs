import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const lists = await prisma.list.findMany({ select: { name: true, entryRequirements: true } })
  const unique = {}
  for (const l of lists) unique[l.name] = l.entryRequirements
  console.log(JSON.stringify(unique, null, 2))
}
main().catch(e => console.error(e)).finally(() => prisma.$disconnect())
