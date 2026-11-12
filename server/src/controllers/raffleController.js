import { listPrizes, createPrize, updatePrize, removePrize, draw, listRecords } from '../services/raffleService.js'
import { sendOk } from '../utils/response.js'

export async function getPrizes(req, res) {
  const list = await listPrizes()
  return sendOk(res, { list })
}

export async function postPrize(req, res) {
  const { name, imageFileId, weight, stock } = req.body || {}
  const prize = await createPrize({ name, imageFileId, weight, stock })
  return sendOk(res, { prize })
}

export async function patchPrize(req, res) {
  const id = Number(req.params.id)
  const { name, imageFileId, weight, stock, enabled } = req.body || {}
  const prize = await updatePrize(id, { name, imageFileId, weight, stock, enabled })
  return sendOk(res, { prize })
}

export async function deletePrize(req, res) {
  const id = Number(req.params.id)
  const result = await removePrize(id)
  return sendOk(res, result)
}

// 抽奖：count 次连抽，可选 fanId 指定中奖粉丝
export async function postDraw(req, res) {
  const { count, fanId } = req.body || {}
  const records = await draw({ count, fanId, operator: req.user })
  return sendOk(res, { records })
}

export async function getRecords(req, res) {
  const page = Math.max(1, Number(req.query.page) || 1)
  const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 20))
  const { list, total } = await listRecords({ page, pageSize, prizeId: req.query.prizeId, fanId: req.query.fanId })
  return sendOk(res, { list, total, page, pageSize })
}
