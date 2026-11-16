// 抽奖服务：礼品维护 + 加权随机抽取 + 抽奖记录
// 与福利模块一致：model 之间无 Prisma relation，跨表数据用二次查询手工拼接
import { prisma } from '../db/index.js'
import { ERR } from '../utils/errors.js'
import { adjustFanCardTx } from './fanService.js'

const PRIZE_SELECT = {
  id: true,
  name: true,
  benefitTypeId: true,
  imageFileId: true,
  weight: true,
  stock: true,
  enabled: true,
  createdAt: true,
  updatedAt: true,
}

const RECORD_SELECT = {
  id: true,
  prizeId: true,
  prizeName: true,
  fanId: true,
  fanNickname: true,
  operatorId: true,
  operatorName: true,
  drawnBy: true,
  createdAt: true,
}

// 可参与抽奖的礼品：启用中 + 权重 > 0 + 库存充足（-1 或 > 0）
function availableWhere() {
  return { enabled: true, weight: { gt: 0 }, OR: [{ stock: -1 }, { stock: { gt: 0 } }] }
}

function normalizeName(name) {
  const n = (name || '').trim()
  if (!n) throw ERR.PARAM('礼品名称不能为空')
  if (n.length > 30) throw ERR.PARAM('礼品名称不超过 30 字')
  return n
}

function normalizeWeight(weight) {
  const w = Number(weight)
  if (!Number.isInteger(w) || w < 0 || w > 1000000) throw ERR.PARAM('中奖权重必须为 0~1000000 的整数')
  return w
}

function normalizeStock(stock) {
  const s = Number(stock)
  if (!Number.isInteger(s) || s < -1 || s > 1000000) throw ERR.PARAM('剩余数量必须为 -1（无限制）或 0 以上的整数')
  return s
}

// 礼品列表：附带实时中奖率（基于当前可用奖池），图片信息用二次查询拼接
// 内置"抽奖次数"对应的礼品不返回给前端（不参与奖池展示与抽奖）
export async function listPrizes() {
  // 找出 isDrawCount 类型的 id，用于过滤
  const drawCountType = await prisma.benefitType.findFirst({ where: { isDrawCount: true }, select: { id: true } })
  const drawCountTypeId = drawCountType?.id

  const [prizes, files] = await Promise.all([
    prisma.rafflePrize.findMany({
      orderBy: { id: 'asc' },
      select: PRIZE_SELECT,
      where: drawCountTypeId ? { benefitTypeId: { not: drawCountTypeId } } : {},
    }),
    prisma.uploadedFile.findMany({
      where: { category: 'raffle-prize' },
      select: { id: true, originalName: true, mimeType: true },
    }),
  ])
  const fileMap = new Map(files.map((f) => [f.id, f]))

  const available = prizes.filter((p) => p.enabled && p.weight > 0 && (p.stock === -1 || p.stock > 0))
  const totalWeight = available.reduce((sum, p) => sum + p.weight, 0)

  return prizes.map((p) => {
    const inPool = available.some((a) => a.id === p.id)
    return {
      ...p,
      image: p.imageFileId ? (fileMap.get(p.imageFileId) || null) : null,
      // 实时中奖率：仅统计当前可用奖池；不在池内为 0
      probability: inPool && totalWeight > 0 ? p.weight / totalWeight : 0,
    }
  })
}

export async function createPrize({ name, imageFileId, weight, stock }) {
  const n = normalizeName(name)
  const w = normalizeWeight(weight ?? 1)
  const s = normalizeStock(stock ?? -1)

  let imageId = null
  if (imageFileId !== undefined && imageFileId !== null && imageFileId !== '') {
    imageId = Number(imageFileId)
    if (!Number.isInteger(imageId)) throw ERR.PARAM('图片文件不合法')
    const file = await prisma.uploadedFile.findUnique({ where: { id: imageId } })
    if (!file) throw ERR.FILE_NOT_FOUND()
  }

  const dup = await prisma.rafflePrize.findUnique({ where: { name: n } })
  if (dup) throw ERR.PRIZE_NAME_TAKEN()

  return prisma.rafflePrize.create({
    data: { name: n, imageFileId: imageId, weight: w, stock: s },
    select: PRIZE_SELECT,
  })
}

export async function updatePrize(id, { name, imageFileId, weight, stock, enabled }) {
  const pid = Number(id)
  if (!Number.isInteger(pid)) throw ERR.PRIZE_NOT_FOUND()
  const current = await prisma.rafflePrize.findUnique({ where: { id: pid } })
  if (!current) throw ERR.PRIZE_NOT_FOUND()

  const data = {}
  if (name !== undefined) data.name = normalizeName(name)
  if (weight !== undefined) data.weight = normalizeWeight(weight)
  if (stock !== undefined) data.stock = normalizeStock(stock)
  if (enabled !== undefined) data.enabled = Boolean(enabled)

  if (imageFileId !== undefined) {
    if (imageFileId === null || imageFileId === '') {
      data.imageFileId = null
    } else {
      const fid = Number(imageFileId)
      if (!Number.isInteger(fid)) throw ERR.PARAM('图片文件不合法')
      const file = await prisma.uploadedFile.findUnique({ where: { id: fid } })
      if (!file) throw ERR.FILE_NOT_FOUND()
      data.imageFileId = fid
    }
  }

  // 系统自带礼品：名称归福利类型管（同步自 benefitType），其余字段可在这里改
  if (isSystemPrize(current)) {
    delete data.name
    if (!Object.keys(data).length) throw ERR.PARAM('没有可更新的字段')
  } else if (data.name && data.name !== current.name) {
    const dup = await prisma.rafflePrize.findUnique({ where: { name: data.name } })
    if (dup) throw ERR.PRIZE_NAME_TAKEN()
  }

  return prisma.rafflePrize.update({ where: { id: pid }, data, select: PRIZE_SELECT })
}

// 删除礼品：记录保留（含快照），但不再出现在奖池里
export async function removePrize(id) {
  const pid = Number(id)
  if (!Number.isInteger(pid)) throw ERR.PRIZE_NOT_FOUND()
  const current = await prisma.rafflePrize.findUnique({ where: { id: pid } })
  if (!current) throw ERR.PRIZE_NOT_FOUND()
  assertNotSystem(current)
  await prisma.rafflePrize.delete({ where: { id: pid } })
  return { id: pid, deleted: true }
}

// 单次抽取：在当前可用奖池中按权重随机选一个
// 排除内置"抽奖次数"对应的礼品（不参与任何抽奖）
async function pickOne(tx, drawCountTypeId) {
  const where = availableWhere()
  if (drawCountTypeId) where.benefitTypeId = { not: drawCountTypeId }

  const pool = await tx.rafflePrize.findMany({ where, select: PRIZE_SELECT })
  const totalWeight = pool.reduce((sum, p) => sum + p.weight, 0)
  if (!pool.length || totalWeight <= 0) throw ERR.NO_AVAILABLE_PRIZE()

  let roll = Math.random() * totalWeight
  for (const p of pool) {
    roll -= p.weight
    if (roll < 0) return p
  }
  return pool[pool.length - 1]
}

// 抽奖：count 次连抽；可选指定粉丝（fanId）；每次抽取在事务内完成
// 「选礼品 → 扣库存（-1 不扣）→ 写记录」三步原子提交， stock=0 的礼品在事务内自然出局
// drawnBy："host" 主播帮抽 | "self" 粉丝自助抽（self 时自动扣减抽奖次数卡）
export async function draw({ count, fanId, operator, drawnBy = 'host' }) {
  const n = Number(count)
  if (!Number.isInteger(n) || n < 1 || n > 999) throw ERR.DRAW_COUNT_INVALID()

  let fan = null
  if (fanId !== undefined && fanId !== null && fanId !== '') {
    const fid = Number(fanId)
    if (!Number.isInteger(fid)) throw ERR.PARAM('粉丝不合法')
    fan = await prisma.fan.findUnique({ where: { id: fid }, select: { id: true, nickname: true } })
    if (!fan) throw ERR.FAN_NOT_FOUND()
  }

  // 粉丝自助抽：校验并扣减抽奖次数
  let drawCountType = null
  if (drawnBy === 'self') {
    if (!fan) throw ERR.PARAM('自助抽奖需要先绑定粉丝档案')
    drawCountType = await prisma.benefitType.findFirst({ where: { isDrawCount: true } })
    if (!drawCountType) throw ERR.PARAM('系统未配置抽奖次数类型，请联系管理员')
    const held = await prisma.fanBenefit.findUnique({
      where: { fanId_typeId: { fanId: fan.id, typeId: drawCountType.id } },
    })
    if (!held || held.amount < n) {
      throw ERR.BENEFIT_NOT_ENOUGH(
        `抽奖次数不足，当前剩余 ${held?.amount || 0} 次，需要 ${n} 次`,
      )
    }
  }

  // 主播抽也需要排除抽奖次数类型的礼品，统一查一次
  const drawCountTypeId = drawCountType ? drawCountType.id : (await prisma.benefitType.findFirst({ where: { isDrawCount: true }, select: { id: true } }))?.id

  return prisma.$transaction(async (tx) => {
    // 先扣抽奖次数
    if (drawnBy === 'self' && drawCountType) {
      await adjustFanCardTx({
        fanId: fan.id,
        typeId: drawCountType.id,
        delta: -n,
        reason: `自助抽奖消耗 ${n} 次`,
        operator,
        tx,
      })
    }

    const results = []
    for (let i = 0; i < n; i += 1) {
      const prize = await pickOne(tx, drawCountTypeId)
      if (prize.stock !== -1) {
        await tx.rafflePrize.update({ where: { id: prize.id }, data: { stock: { decrement: 1 } } })
      }
      // 系统自带礼品（关联福利类型）且指定了粉丝时，自动给该粉丝计入对应类型的卡
      // 但粉丝自抽时，如果抽中的是"抽奖次数"类型本身，不再加回（避免白抽循环）
      if (fan && prize.benefitTypeId != null) {
        const isDrawCountPrize = drawnBy === 'self' && drawCountType && prize.benefitTypeId === drawCountType.id
        if (!isDrawCountPrize) {
          await adjustFanCardTx({
            fanId: fan.id,
            typeId: prize.benefitTypeId,
            delta: 1,
            reason: `抽奖获得：${prize.name}`,
            operator,
            tx,
          })
        }
      }
      const record = await tx.raffleRecord.create({
        data: {
          prizeId: prize.id,
          prizeName: prize.name,
          fanId: fan ? fan.id : null,
          fanNickname: fan ? fan.nickname : null,
          operatorId: operator ? operator.id : null,
          operatorName: operator ? operator.nickname : null,
          drawnBy,
        },
        select: RECORD_SELECT,
      })
      results.push(record)
    }
    return results
  })
}

// 抽奖记录：倒序分页，可按礼品、粉丝、昵称关键字、drawnBy 过滤
export async function listRecords({ page = 1, pageSize = 20, prizeId, fanId, keyword, drawnBy } = {}) {
  const where = {}
  if (prizeId !== undefined && prizeId !== null && prizeId !== '') {
    const pid = Number(prizeId)
    if (Number.isInteger(pid)) where.prizeId = pid
  }
  if (fanId !== undefined && fanId !== null && fanId !== '') {
    const fid = Number(fanId)
    if (Number.isInteger(fid)) where.fanId = fid
  }
  // 按粉丝昵称模糊搜索（快照字段，粉丝被删后仍可搜到历史记录）
  const kw = (keyword || '').trim()
  if (kw) where.fanNickname = { contains: kw }
  if (drawnBy === 'host' || drawnBy === 'self') where.drawnBy = drawnBy

  const [total, list] = await Promise.all([
    prisma.raffleRecord.count({ where }),
    prisma.raffleRecord.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: RECORD_SELECT,
    }),
  ])
  return { list, total }
}

// ---------- 与福利类型的同步（单一职责：保持两边一致，不感知 HTTP） ----------

// 系统自带礼品 = 从福利类型同步过来的 RafflePrize，统一在这里判断
function isSystemPrize(prize) {
  return prize.benefitTypeId !== null && prize.benefitTypeId !== undefined
}

function assertNotSystem(prize) {
  if (isSystemPrize(prize)) throw ERR.PRIZE_SYSTEM_LOCKED()
}

// 福利类型新增时，在奖池里创建一条对应的系统自带礼品（默认停用，由管理员手动开启）
export async function syncFromBenefitType(tx, type) {
  await tx.rafflePrize.create({
    data: {
      name: type.name,
      benefitTypeId: type.id,
      enabled: false, // 默认不进奖池，避免新类型自动被抽中
      weight: 1,
      stock: -1,
    },
  })
}

// 福利类型改名时，同步更新对应系统自带礼品的名称
export async function syncBenefitTypeRename(tx, typeId, newName) {
  await tx.rafflePrize.updateMany({
    where: { benefitTypeId: typeId },
    data: { name: newName },
  })
}

// 福利类型删除时，同步移除对应的系统自带礼品（历史抽奖记录靠快照保留，不受影响）
export async function syncBenefitTypeRemove(tx, typeId) {
  await tx.rafflePrize.deleteMany({ where: { benefitTypeId: typeId } })
}

// 粉丝自助抽奖：通过绑定的站内账号反查粉丝档案，校验并扣减抽奖次数，返回抽奖记录
// 次数上限由 draw 里的 9999 限制 + 实际剩余次数校验双重控制
export async function selfDraw({ userId, count = 1, operator }) {
  const fan = await prisma.fan.findFirst({ where: { userId }, select: { id: true, nickname: true } })
  if (!fan) throw ERR.PARAM('未绑定粉丝档案，无法抽奖')
  const n = Number(count)
  if (!Number.isInteger(n) || n < 1) throw ERR.DRAW_COUNT_INVALID()
  return draw({ count: n, fanId: fan.id, operator, drawnBy: 'self' })
}

// 粉丝自助抽奖的历史记录（只含 drawnBy: self），通过绑定的站内账号反查
export async function listSelfDrawRecords({ userId, page = 1, pageSize = 20 } = {}) {
  const fan = await prisma.fan.findFirst({ where: { userId }, select: { id: true } })
  if (!fan) return { list: [], total: 0 }
  return listRecords({ page, pageSize, fanId: fan.id, drawnBy: 'self' })
}
