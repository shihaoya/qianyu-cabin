// 粉丝与卡服务：粉丝档案 CRUD + 每个粉丝在多类型下的卡数量维护 + 增减流水留痕
// 与既有风格一致：model 之间无 Prisma relation，跨表数据用二次查询手工拼接
import { prisma } from '../db/index.js'
import { ERR } from '../utils/errors.js'

const FAN_SELECT = {
  id: true,
  nickname: true,
  userId: true,
  systemAccount: true,
  douyinAccount: true,
  remark: true,
  createdAt: true,
}

// 粉丝列表：附带其持有（数量 > 0）的卡概览
export async function listFans({ page = 1, pageSize = 20, keyword = '' } = {}) {
  const kw = (keyword || '').trim()
  const where = kw
    ? {
        OR: [
          { nickname: { contains: kw } },
          { douyinAccount: { contains: kw } },
          { systemAccount: { contains: kw } },
        ],
      }
    : {}

  const [total, fans, types, benefits] = await Promise.all([
    prisma.fan.count({ where }),
    prisma.fan.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: FAN_SELECT,
    }),
    prisma.benefitType.findMany({ orderBy: { id: 'asc' }, select: { id: true, name: true } }),
    prisma.fanBenefit.findMany({
      where: { amount: { gt: 0 } },
      orderBy: { typeId: 'asc' },
      select: { fanId: true, typeId: true, amount: true },
    }),
  ])

  const typeNameMap = new Map(types.map((t) => [t.id, t.name]))
  const cardsMap = new Map()
  for (const b of benefits) {
    if (!cardsMap.has(b.fanId)) cardsMap.set(b.fanId, [])
    cardsMap.get(b.fanId).push({
      typeId: b.typeId,
      typeName: typeNameMap.get(b.typeId) || '',
      amount: b.amount,
    })
  }

  const list = fans.map((f) => ({ ...f, cards: cardsMap.get(f.id) || [] }))
  return { list, total }
}

// 只有昵称必填，其余字段都可留空；userId 给出时必须对应真实存在的站内账号
export async function createFan({ nickname, userId, douyinAccount, remark }) {
  const name = (nickname || '').trim()
  if (!name) throw ERR.PARAM('粉丝昵称不能为空')
  if (name.length > 30) throw ERR.PARAM('粉丝昵称不超过 30 字')

  const data = {
    nickname: name,
    douyinAccount: (douyinAccount || '').trim() || null,
    remark: (remark || '').trim() || null,
  }

  if (userId !== undefined && userId !== null && userId !== '') {
    const id = Number(userId)
    if (!Number.isInteger(id)) throw ERR.PARAM('系统内账号不合法')
    const user = await prisma.user.findUnique({ where: { id }, select: { id: true, nickname: true } })
    if (!user) throw ERR.PARAM('所选系统内账号不存在')
    data.userId = user.id
    data.systemAccount = user.nickname
  }

  return prisma.fan.create({ data, select: FAN_SELECT })
}

export async function updateFan(id, { nickname, userId, douyinAccount, remark }) {
  const current = await prisma.fan.findUnique({ where: { id } })
  if (!current) throw ERR.FAN_NOT_FOUND()

  const data = {}
  if (nickname !== undefined) {
    const name = (nickname || '').trim()
    if (!name) throw ERR.PARAM('粉丝昵称不能为空')
    if (name.length > 30) throw ERR.PARAM('粉丝昵称不超过 30 字')
    data.nickname = name
  }
  if (douyinAccount !== undefined) data.douyinAccount = (douyinAccount || '').trim() || null
  if (remark !== undefined) data.remark = (remark || '').trim() || null

  if (userId !== undefined) {
    // 传空串 / null 表示解除关联
    if (userId === null || userId === '') {
      data.userId = null
      data.systemAccount = null
    } else {
      const uid = Number(userId)
      if (!Number.isInteger(uid)) throw ERR.PARAM('系统内账号不合法')
      const user = await prisma.user.findUnique({
        where: { id: uid },
        select: { id: true, nickname: true },
      })
      if (!user) throw ERR.PARAM('所选系统内账号不存在')
      data.userId = user.id
      data.systemAccount = user.nickname
    }
  }

  const fan = await prisma.fan.update({ where: { id }, data, select: FAN_SELECT })
  // 昵称变了，历史流水里的快照同步更新，避免列表里出现旧名字造成困惑
  if (data.nickname && data.nickname !== current.nickname) {
    await prisma.benefitLog.updateMany({ where: { fanId: id }, data: { fanNickname: data.nickname } })
  }
  return fan
}

// 删除粉丝：其持有的卡一并删除，流水保留（含昵称/类型名快照）以便日后对账
export async function removeFan(id) {
  const current = await prisma.fan.findUnique({ where: { id } })
  if (!current) throw ERR.FAN_NOT_FOUND()
  return prisma.$transaction(async (tx) => {
    await tx.fanBenefit.deleteMany({ where: { fanId: id } })
    await tx.fan.delete({ where: { id } })
    return { id, deleted: true }
  })
}

export async function getFanDetail(id) {
  const fan = await prisma.fan.findUnique({ where: { id }, select: FAN_SELECT })
  if (!fan) throw ERR.FAN_NOT_FOUND()
  return fan
}

// 某粉丝名下所有类型的卡：未持有的类型也返回（amount = 0），方便前端直接增减
export async function listFanCards(fanId) {
  const fan = await getFanDetail(fanId)
  const [types, benefits] = await Promise.all([
    prisma.benefitType.findMany({
      orderBy: { id: 'asc' },
      select: { id: true, name: true, description: true },
    }),
    prisma.fanBenefit.findMany({ where: { fanId }, select: { typeId: true, amount: true } }),
  ])
  const amountMap = new Map(benefits.map((b) => [b.typeId, b.amount]))
  const cards = types.map((t) => ({
    typeId: t.id,
    typeName: t.name,
    description: t.description,
    amount: amountMap.get(t.id) || 0,
  }))
  return { fan, cards }
}

// 增减卡：delta 正数为增加、负数为减少；余额不足直接拒绝；每次调整落一条流水
export async function adjustFanCard({ fanId, typeId, delta, reason, operator }) {
  const amount = Number(delta)
  if (!Number.isInteger(amount) || amount === 0) throw ERR.ADJUST_INVALID()
  const note = (reason || '').trim()
  if (!note) throw ERR.REASON_REQUIRED()
  if (note.length > 100) throw ERR.PARAM('理由不超过 100 字')

  const tid = Number(typeId)
  if (!Number.isInteger(tid)) throw ERR.PARAM('福利类型不合法')

  const [fan, type] = await Promise.all([
    prisma.fan.findUnique({ where: { id: fanId }, select: FAN_SELECT }),
    prisma.benefitType.findUnique({ where: { id: tid } }),
  ])
  if (!fan) throw ERR.FAN_NOT_FOUND()
  if (!type) throw ERR.TYPE_NOT_FOUND()

  return prisma.$transaction(async (tx) => {
    const held = await tx.fanBenefit.findUnique({ where: { fanId_typeId: { fanId, typeId: tid } } })
    const balance = (held?.amount || 0) + amount
    if (balance < 0) {
      throw ERR.BENEFIT_NOT_ENOUGH(
        `「${type.name}」仅剩 ${held?.amount || 0} 张，不足以扣除 ${Math.abs(amount)} 张`,
      )
    }

    const row = held
      ? await tx.fanBenefit.update({ where: { id: held.id }, data: { amount: balance } })
      : await tx.fanBenefit.create({ data: { fanId, typeId: tid, amount: balance } })

    const log = await tx.benefitLog.create({
      data: {
        fanId,
        typeId: tid,
        fanNickname: fan.nickname,
        typeName: type.name,
        delta: amount,
        balance,
        reason: note,
        operatorId: operator ? operator.id : null,
        operatorName: operator ? operator.nickname : null,
      },
    })

    return {
      card: { typeId: row.typeId, typeName: type.name, amount: row.amount },
      log,
    }
  })
}

// 「我的福利」：按站内账号 userId 反查其绑定的粉丝档案，返回卡状态与最近流水。
// 未绑定不算异常（普通账号本就可能没有粉丝档案），返回 bound:false 由前端给出友好提示。
export async function getMyBenefits({ userId, logLimit = 20 } = {}) {
  const fan = await prisma.fan.findFirst({ where: { userId }, select: FAN_SELECT })
  if (!fan) return { bound: false, nickname: null, cards: [], logs: [] }

  const [{ cards }, logResult] = await Promise.all([
    listFanCards(fan.id),
    prisma.benefitLog.findMany({
      where: { fanId: fan.id },
      orderBy: { createdAt: 'desc' },
      take: logLimit,
      select: {
        id: true,
        typeName: true,
        delta: true,
        balance: true,
        reason: true,
        operatorName: true,
        createdAt: true,
      },
    }),
  ])

  return {
    bound: true,
    nickname: fan.nickname,
    // 已持有的排在前面，数量为 0 的类型仍返回（灰显），让用户知道还有哪些福利
    cards: [...cards].sort((a, b) => b.amount - a.amount),
    logs: logResult,
  }
}

// 某粉丝的增减记录：倒序返回最近的流水，含变动前后的原因与时间
export async function listFanLogs({ fanId, page = 1, pageSize = 20 } = {}) {
  const where = { fanId }
  const [total, list] = await Promise.all([
    prisma.benefitLog.count({ where }),
    prisma.benefitLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])
  return { list, total }
}
