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
export async function listPrizes() {
  const [prizes, files] = await Promise.all([
    prisma.rafflePrize.findMany({ orderBy: { id: 'asc' }, select: PRIZE_SELECT }),
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

  if (data.name && data.name !== current.name) {
    const dup = await prisma.rafflePrize.findUnique({ where: { name: data.name } })
    if (dup) throw ERR.PRIZE_NAME_TAKEN()
  }

  // 系统自带礼品只能改启用状态；名称/图片/权重/库存都归福利类型管
  const onlyToggle = Object.keys(data).length === 1 && data.enabled !== undefined
  if (!onlyToggle) assertNotSystem(current)

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
async function pickOne(tx) {
  const pool = await tx.rafflePrize.findMany({ where: availableWhere(), select: PRIZE_SELECT })
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
export async function draw({ count, fanId, operator }) {
  const n = Number(count)
  if (!Number.isInteger(n) || n < 1 || n > 100) throw ERR.DRAW_COUNT_INVALID()

  let fan = null
  if (fanId !== undefined && fanId !== null && fanId !== '') {
    const fid = Number(fanId)
    if (!Number.isInteger(fid)) throw ERR.PARAM('粉丝不合法')
    fan = await prisma.fan.findUnique({ where: { id: fid }, select: { id: true, nickname: true } })
    if (!fan) throw ERR.FAN_NOT_FOUND()
  }

  return prisma.$transaction(async (tx) => {
    const results = []
    for (let i = 0; i < n; i += 1) {
      const prize = await pickOne(tx)
      if (prize.stock !== -1) {
        await tx.rafflePrize.update({ where: { id: prize.id }, data: { stock: { decrement: 1 } } })
      }
      // 系统自带礼品（关联福利类型）且指定了粉丝时，自动给该粉丝计入对应类型的卡
      if (fan && prize.benefitTypeId != null) {
        await adjustFanCardTx({
          fanId: fan.id,
          typeId: prize.benefitTypeId,
          delta: 1,
          reason: `抽奖获得：${prize.name}`,
          operator,
          tx,
        })
      }
      const record = await tx.raffleRecord.create({
        data: {
          prizeId: prize.id,
          prizeName: prize.name,
          fanId: fan ? fan.id : null,
          fanNickname: fan ? fan.nickname : null,
          operatorId: operator ? operator.id : null,
          operatorName: operator ? operator.nickname : null,
        },
        select: RECORD_SELECT,
      })
      results.push(record)
    }
    return results
  })
}

// 抽奖记录：倒序分页，可按礼品或粉丝过滤
export async function listRecords({ page = 1, pageSize = 20, prizeId, fanId } = {}) {
  const where = {}
  if (prizeId !== undefined && prizeId !== null && prizeId !== '') {
    const pid = Number(prizeId)
    if (Number.isInteger(pid)) where.prizeId = pid
  }
  if (fanId !== undefined && fanId !== null && fanId !== '') {
    const fid = Number(fanId)
    if (Number.isInteger(fid)) where.fanId = fid
  }

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
