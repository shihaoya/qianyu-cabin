import { prisma } from '../db/index.js'
import { ERR } from '../utils/errors.js'

const MAX_LEN = 500

// 列表权限：未登录访客看不到任何留言；普通用户只看自己的；管理员看全部
// deletedAt: null 过滤掉逻辑删除的留言
export async function listMessages(user) {
  if (!user) return []
  const where =
    user.role === 'admin' ? { deletedAt: null } : { userId: user.id, deletedAt: null }
  return prisma.message.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      content: true,
      isAnonymous: true,
      nickname: true,
      userId: true,
      createdAt: true,
    },
  })
}

// user 可能为 null（匿名访客）：匿名时只存内容，不记录任何身份信息
export async function createMessage({ content, anonymous, user }) {
  const text = (content || '').trim()
  if (!text) throw ERR.PARAM('留言内容不能为空')
  if (text.length > MAX_LEN) throw ERR.PARAM(`留言不超过 ${MAX_LEN} 字`)

  const isAnon = !user || !!anonymous
  return prisma.message.create({
    data: {
      content: text,
      isAnonymous: isAnon,
      // 登录用户即使匿名也保留 userId，确保“我的留言”可识别、可删除
      userId: user ? user.id : null,
      nickname: isAnon ? null : user.nickname,
    },
    select: {
      id: true,
      content: true,
      isAnonymous: true,
      nickname: true,
      userId: true,
      createdAt: true,
    },
  })
}

// 仅留言主人或管理员可删除；采用逻辑删除（标记 deletedAt），不物理删除数据
// 找不到或已删除都按已删除处理，保持幂等
export async function removeMessage({ id, user }) {
  const message = await prisma.message.findUnique({ where: { id } })
  if (!message || message.deletedAt) return { id, deleted: false }
  if (user.role !== 'admin' && message.userId !== user.id) {
    throw ERR.FORBIDDEN('只能删除自己的留言')
  }
  await prisma.message.update({ where: { id }, data: { deletedAt: new Date() } })
  return { id, deleted: true }
}
