// 将指定昵称的用户提升为开发者（admin）。
// 用法：node scripts/promote-admin.mjs <昵称>
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const nickname = process.argv[2]
if (!nickname) {
  console.error('用法：node scripts/promote-admin.mjs <昵称>')
  process.exit(1)
}

const prisma = new PrismaClient()
const user = await prisma.user.findUnique({ where: { nickname } })
if (!user) {
  console.error(`未找到用户：${nickname}`)
  process.exit(1)
}

await prisma.user.update({ where: { id: user.id }, data: { role: 'admin' } })
console.log(`已将 ${nickname} 设为开发者（admin）。`)
await prisma.$disconnect()
