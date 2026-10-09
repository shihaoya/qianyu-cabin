// 常用理由服务：管理员维护的理由短语库，供增减卡时一键带入
// 与既有风格一致：不做 Prisma relation，文本唯一，按 id 升序返回（= 新增先后）
import { prisma } from '../db/index.js'
import { ERR } from '../utils/errors.js'

const REASON_SELECT = {
  id: true,
  text: true,
  createdAt: true,
}

const MAX_LEN = 30

function normalize(text) {
  return (text || '').trim()
}

export function listReasons() {
  return prisma.benefitReason.findMany({ orderBy: { id: 'asc' }, select: REASON_SELECT })
}

export async function createReason({ text }) {
  const reasonText = normalize(text)
  if (!reasonText) throw ERR.PARAM('理由内容不能为空')
  if (reasonText.length > MAX_LEN) throw ERR.PARAM(`常用理由不超过 ${MAX_LEN} 字`)

  const existing = await prisma.benefitReason.findUnique({ where: { text: reasonText } })
  if (existing) throw ERR.COMMON_REASON_TAKEN()

  return prisma.benefitReason.create({ data: { text: reasonText }, select: REASON_SELECT })
}

export async function updateReason(id, { text }) {
  const current = await prisma.benefitReason.findUnique({ where: { id } })
  if (!current) throw ERR.COMMON_REASON_NOT_FOUND()

  const reasonText = normalize(text)
  if (!reasonText) throw ERR.PARAM('理由内容不能为空')
  if (reasonText.length > MAX_LEN) throw ERR.PARAM(`常用理由不超过 ${MAX_LEN} 字`)

  if (reasonText !== current.text) {
    const duplicated = await prisma.benefitReason.findUnique({ where: { text: reasonText } })
    if (duplicated) throw ERR.COMMON_REASON_TAKEN()
  }

  return prisma.benefitReason.update({
    where: { id },
    data: { text: reasonText },
    select: REASON_SELECT,
  })
}

// 删除只影响快捷短语本身：已写进流水的 reason 是独立文本，不受影响
export async function removeReason(id) {
  const current = await prisma.benefitReason.findUnique({ where: { id } })
  if (!current) throw ERR.COMMON_REASON_NOT_FOUND()

  await prisma.benefitReason.delete({ where: { id } })
  return { id, deleted: true }
}
