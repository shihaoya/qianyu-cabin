import bcrypt from 'bcryptjs'
import { prisma } from '../db/index.js'
import { ERR } from '../utils/errors.js'

export async function register(nickname, password) {
  const existing = await prisma.user.findUnique({ where: { nickname } })
  if (existing) throw ERR.NICKNAME_TAKEN()

  const passwordHash = await bcrypt.hash(password, 10)
  return prisma.user.create({ data: { nickname, passwordHash } })
}

export async function verifyCredentials(nickname, password) {
  const user = await prisma.user.findUnique({ where: { nickname } })
  if (!user) throw ERR.BAD_CREDENTIALS()

  const matched = await bcrypt.compare(password, user.passwordHash)
  if (!matched) throw ERR.BAD_CREDENTIALS()

  return user
}

export async function getUserById(id) {
  return prisma.user.findUnique({ where: { id } })
}

// 修改当前登录用户密码：校验旧密码 → 校验新密码强度 → 更新 passwordHash
export async function changePassword(id, oldPassword, newPassword) {
  const user = await prisma.user.findUnique({ where: { id } })
  if (!user) throw ERR.UNAUTHENTICATED()
  const matched = await bcrypt.compare(oldPassword, user.passwordHash)
  if (!matched) throw ERR.OLD_PWD_WRONG()
  if (!newPassword || String(newPassword).length < 6) {
    throw ERR.PARAM('新密码至少 6 位')
  }
  const passwordHash = await bcrypt.hash(newPassword, 10)
  await prisma.user.update({ where: { id }, data: { passwordHash } })
}

export async function setRole(id, role) {
  return prisma.user.update({ where: { id }, data: { role } })
}

export async function listUsers({ page = 1, pageSize = 20 } = {}) {
  const where = {}
  const total = await prisma.user.count({ where })
  const list = await prisma.user.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: { id: true, nickname: true, role: true, createdAt: true },
  })
  return { list, total }
}
