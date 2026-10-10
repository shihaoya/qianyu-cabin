// 常用理由服务：管理员维护的理由短语库，供增减卡时一键带入
// 与既有风格一致：不做 Prisma relation，文本唯一，按 id 升序返回（= 新增先后）
// type：common 公共（增加/减少都可选）/ add 仅增加时用 / sub 仅减少时用；不传按 common 处理，兼容历史数据与旧客户端
import { prisma } from '../db/index.js'
import { ERR } from '../utils/errors.js'

const REASON_SELECT = {
  id: true,
  text: true,
  type: true,
  createdAt: true,
}

const MAX_LEN = 30

// 理由类型的单一真源：前端下拉与后端校验共用这套取值
export const REASON_TYPES = [
  { value: 'common', label: '公共理由' },
  { value: 'add', label: '增加理由' },
  { value: 'sub', label: '减少理由' },
]

function normalize(text) {
  return (text || '').trim()
}

// 缺省与空值都按 common（历史数据没有该字段，迁移后同样是 common）
function normalizeType(type) {
  const value = (type || '').trim() || 'common'
  if (!REASON_TYPES.some((t) => t.value === value)) throw ERR.PARAM('理由类型不合法')
  return value
}

export function listReasons() {
  return prisma.benefitReason.findMany({ orderBy: { id: 'asc' }, select: REASON_SELECT })
}

export async function createReason({ text, type }) {
  const reasonText = normalize(text)
  if (!reasonText) throw ERR.PARAM('理由内容不能为空')
  if (reasonText.length > MAX_LEN) throw ERR.PARAM(`常用理由不超过 ${MAX_LEN} 字`)
  const reasonType = normalizeType(type)

  const existing = await prisma.benefitReason.findUnique({ where: { text: reasonText } })
  if (existing) throw ERR.COMMON_REASON_TAKEN()

  return prisma.benefitReason.create({
    data: { text: reasonText, type: reasonType },
    select: REASON_SELECT,
  })
}

export async function updateReason(id, { text, type }) {
  const current = await prisma.benefitReason.findUnique({ where: { id } })
  if (!current) throw ERR.COMMON_REASON_NOT_FOUND()

  const reasonText = normalize(text)
  if (!reasonText) throw ERR.PARAM('理由内容不能为空')
  if (reasonText.length > MAX_LEN) throw ERR.PARAM(`常用理由不超过 ${MAX_LEN} 字`)
  const reasonType = type === undefined ? current.type : normalizeType(type)

  if (reasonText !== current.text) {
    const duplicated = await prisma.benefitReason.findUnique({ where: { text: reasonText } })
    if (duplicated) throw ERR.COMMON_REASON_TAKEN()
  }

  return prisma.benefitReason.update({
    where: { id },
    data: { text: reasonText, type: reasonType },
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
