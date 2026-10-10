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

// 删除账号：只删 User 行本身。所有业务表都不设外键，旧数据全部保留（留言/游戏记录/福利流水），
// 新注册的同昵称账号拿到的是全新 id，与旧数据天然无关联 —— 这正是「同名可再注册、不关联旧数据」的语义。
// 账号关联逐个解绑（粉丝档案保留，福利不受影响）。
export async function removeUser(id) {
  await prisma.$transaction([
    prisma.fan.updateMany({ where: { userId: id }, data: { userId: null, systemAccount: null } }),
    prisma.benefitLog.updateMany({ where: { operatorId: id }, data: { operatorId: null } }),
    prisma.user.delete({ where: { id } }),
  ])
}
