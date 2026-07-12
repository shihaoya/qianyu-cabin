// 将指定昵称的账号提升为 owner（开发管理员（站长））。
// 用法（在 server 目录下）：node scripts/promote-owner.js <昵称>
// 例如：node scripts/promote-owner.js 千羽
import 'dotenv/config' // 载入 .env，提供 DATABASE_URL（须从 server/ 目录运行）
import { PrismaClient } from '@prisma/client'
import { ROLE, roleLabel } from '../src/permissions.js'

const prisma = new PrismaClient()
const nickname = process.argv[2]

if (!nickname) {
  console.error('用法: node scripts/promote-owner.js <昵称>')
  process.exit(1)
}

const user = await prisma.user.findUnique({ where: { nickname } })
if (!user) {
  console.error(`未找到昵称为 "${nickname}" 的用户`)
  await prisma.$disconnect()
  process.exit(1)
}

await prisma.user.update({ where: { nickname }, data: { role: ROLE.OWNER } })
console.log(`已将 "${nickname}" 的角色设为 ${roleLabel(ROLE.OWNER)}`)
await prisma.$disconnect()
