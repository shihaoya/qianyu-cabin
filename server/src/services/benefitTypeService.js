// 福利类型服务：只管类型本身的增删改查，不感知 HTTP
// 与既有风格一致：model 之间无 Prisma relation，跨表统计用 groupBy / 二次查询手工拼接
import { prisma } from '../db/index.js'
import { ERR } from '../utils/errors.js'
import {
  syncFromBenefitType,
  syncBenefitTypeRename,
  syncBenefitTypeRemove,
} from './raffleService.js'

const TYPE_SELECT = {
  id: true,
  name: true,
  description: true,
  isDrawCount: true,
  createdAt: true,
}

// 列表附带 holderCount（持有该类型且数量 > 0 的粉丝数），供前端判断能否删除
export async function listTypes() {
  await ensureDrawCountType()
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

// 内置抽奖次数类型：全局唯一，不存在时自动创建；不可删除、不可取消 isDrawCount
export async function ensureDrawCountType() {
  const existing = await prisma.benefitType.findFirst({ where: { isDrawCount: true } })
  if (existing) return existing
  // 创建内置类型 + 同步奖池礼品（默认停用）
  return prisma.$transaction(async (tx) => {
    const created = await tx.benefitType.create({
      data: { name: '抽奖次数', isDrawCount: true, description: '粉丝自助抽奖时自动扣减' },
      select: TYPE_SELECT,
    })
    await tx.rafflePrize.create({
      data: { name: '抽奖次数', benefitTypeId: created.id, enabled: false, weight: 1, stock: -1 },
    })
    return created
  })
}

export async function createType({ name, description, isDrawCount }) {
  // 抽奖次数类型是内置的，不允许手动创建
  if (isDrawCount) throw ERR.PARAM('抽奖次数类型是系统内置的，不能手动创建')

  const typeName = (name || '').trim()
  if (!typeName) throw ERR.PARAM('类型名称不能为空')
  if (typeName.length > 20) throw ERR.PARAM('类型名称不超过 20 字')

  const desc = (description || '').trim() || null
  if (desc && desc.length > 100) throw ERR.PARAM('类型说明不超过 100 字')

  const existing = await prisma.benefitType.findUnique({ where: { name: typeName } })
  if (existing) throw ERR.TYPE_NAME_TAKEN()

  // 创建类型时同步在奖池里生成一条系统自带礼品（默认停用，由管理员手动开启）
  return prisma.$transaction(async (tx) => {
    const created = await tx.benefitType.create({
      data: { name: typeName, description: desc, isDrawCount: false },
      select: TYPE_SELECT,
    })
    await syncFromBenefitType(tx, created)
    return created
  })
}

export async function updateType(id, { name, description, isDrawCount }) {
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
      // 改名会同步到奖池：提前检查同名礼品，避免落到数据库唯一约束报 500
      const sameNamePrize = await prisma.rafflePrize.findUnique({ where: { name: typeName } })
      if (sameNamePrize && sameNamePrize.benefitTypeId !== id) {
        throw ERR.PRIZE_NAME_TAKEN('抽奖管理中已有同名礼品，请先改名或删除后再使用该名称')
      }
    }
    data.name = typeName
  }
  if (description !== undefined) {
    const desc = (description || '').trim() || null
    if (desc && desc.length > 100) throw ERR.PARAM('类型说明不超过 100 字')
    data.description = desc
  }
  // 内置抽奖次数类型：isDrawCount 不可修改（永远是 true），名字和说明可以改
  if (isDrawCount !== undefined && !current.isDrawCount && isDrawCount) {
    throw ERR.PARAM('抽奖次数类型是系统内置的，不能将其他类型改为抽奖次数')
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.benefitType.update({ where: { id }, data, select: TYPE_SELECT })
    if (data.name !== undefined && data.name !== current.name) {
      await syncBenefitTypeRename(tx, id, data.name)
    }
    return updated
  })
}

// 删除规则：只要还有粉丝持有该类型的卡（amount > 0）就拒绝删除；
// 数量为 0 的残留记录随类型一起清理，避免留下孤儿数据
// 内置抽奖次数类型不可删除
export async function removeType(id) {
  const current = await prisma.benefitType.findUnique({ where: { id } })
  if (!current) throw ERR.TYPE_NOT_FOUND()
  if (current.isDrawCount) throw ERR.PARAM('抽奖次数类型是系统内置的，不能删除')

  const held = await prisma.fanBenefit.count({ where: { typeId: id, amount: { gt: 0 } } })
  if (held > 0) throw ERR.TYPE_IN_USE()

  return prisma.$transaction(async (tx) => {
    await tx.fanBenefit.deleteMany({ where: { typeId: id } })
    await tx.benefitType.delete({ where: { id } })
    await syncBenefitTypeRemove(tx, id)
    return { id, deleted: true }
  })
}
