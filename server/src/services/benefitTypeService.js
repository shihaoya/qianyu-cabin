// 福利类型服务：只管类型本身的增删改查，不感知 HTTP
// 与既有风格一致：model 之间无 Prisma relation，跨表统计用 groupBy / 二次查询手工拼接
import { prisma } from '../db/index.js'
import { ERR } from '../utils/errors.js'

const TYPE_SELECT = {
  id: true,
  name: true,
  description: true,
  createdAt: true,
}

// 列表附带 holderCount（持有该类型且数量 > 0 的粉丝数），供前端判断能否删除
export async function listTypes() {
  const [types, held] = await Promise.all([
    prisma.benefitType.findMany({ orderBy: { id: 'asc' }, select: TYPE_SELECT }),
    prisma.fanBenefit.groupBy({
      by: ['typeId'],
      where: { amount: { gt: 0 } },
      _count: { _all: true },
    }),
  ])
  const countMap = new Map(held.map((row) => [row.typeId, row._count._all]))
  return types.map((t) => ({ ...t, holderCount: countMap.get(t.id) || 0 }))
}

export async function createType({ name, description }) {
  const typeName = (name || '').trim()
  if (!typeName) throw ERR.PARAM('类型名称不能为空')
  if (typeName.length > 20) throw ERR.PARAM('类型名称不超过 20 字')

  const desc = (description || '').trim() || null
  if (desc && desc.length > 100) throw ERR.PARAM('类型说明不超过 100 字')

  const existing = await prisma.benefitType.findUnique({ where: { name: typeName } })
  if (existing) throw ERR.TYPE_NAME_TAKEN()

  return prisma.benefitType.create({
    data: { name: typeName, description: desc },
    select: TYPE_SELECT,
  })
}

export async function updateType(id, { name, description }) {
  const current = await prisma.benefitType.findUnique({ where: { id } })
  if (!current) throw ERR.TYPE_NOT_FOUND()

  const data = {}
  if (name !== undefined) {
    const typeName = (name || '').trim()
    if (!typeName) throw ERR.PARAM('类型名称不能为空')
    if (typeName.length > 20) throw ERR.PARAM('类型名称不超过 20 字')
    if (typeName !== current.name) {
      const duplicated = await prisma.benefitType.findUnique({ where: { name: typeName } })
      if (duplicated) throw ERR.TYPE_NAME_TAKEN()
    }
    data.name = typeName
  }
  if (description !== undefined) {
    const desc = (description || '').trim() || null
    if (desc && desc.length > 100) throw ERR.PARAM('类型说明不超过 100 字')
    data.description = desc
  }

  return prisma.benefitType.update({ where: { id }, data, select: TYPE_SELECT })
}

// 删除规则：只要还有粉丝持有该类型的卡（amount > 0）就拒绝删除；
// 数量为 0 的残留记录随类型一起清理，避免留下孤儿数据
export async function removeType(id) {
  const current = await prisma.benefitType.findUnique({ where: { id } })
  if (!current) throw ERR.TYPE_NOT_FOUND()

  const held = await prisma.fanBenefit.count({ where: { typeId: id, amount: { gt: 0 } } })
  if (held > 0) throw ERR.TYPE_IN_USE()

  return prisma.$transaction(async (tx) => {
    await tx.fanBenefit.deleteMany({ where: { typeId: id } })
    await tx.benefitType.delete({ where: { id } })
    return { id, deleted: true }
  })
}
