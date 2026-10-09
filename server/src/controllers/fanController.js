import {
  listFans,
  createFan,
  updateFan,
  removeFan,
  listFanCards,
  adjustFanCard,
  listFanLogs,
} from '../services/fanService.js'
import { ERR } from '../utils/errors.js'
import { sendOk } from '../utils/response.js'

export async function getFans(req, res) {
  const page = Math.max(1, Number(req.query.page) || 1)
  const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 20))
  const { list, total } = await listFans({ page, pageSize, keyword: req.query.keyword })
  return sendOk(res, { list, total, page, pageSize })
}

export async function postFan(req, res) {
  const { nickname, userId, douyinAccount, remark } = req.body || {}
  const fan = await createFan({ nickname, userId, douyinAccount, remark })
  return sendOk(res, { fan })
}

export async function patchFan(req, res) {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) throw ERR.FAN_NOT_FOUND()
  const { nickname, userId, douyinAccount, remark } = req.body || {}
  const fan = await updateFan(id, { nickname, userId, douyinAccount, remark })
  return sendOk(res, { fan })
}

export async function deleteFan(req, res) {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) throw ERR.FAN_NOT_FOUND()
  const result = await removeFan(id)
  return sendOk(res, result)
}

export async function getFanCards(req, res) {
  const fanId = Number(req.params.id)
  if (!Number.isInteger(fanId)) throw ERR.FAN_NOT_FOUND()
  const data = await listFanCards(fanId)
  return sendOk(res, data)
}

// 增减卡：delta 为带符号整数（正加负减），必须带理由
export async function adjustCard(req, res) {
  const fanId = Number(req.params.id)
  if (!Number.isInteger(fanId)) throw ERR.FAN_NOT_FOUND()
  const { typeId, delta, reason } = req.body || {}
  const data = await adjustFanCard({ fanId, typeId, delta, reason, operator: req.user })
  return sendOk(res, data)
}

export async function getFanLogs(req, res) {
  const fanId = Number(req.params.id)
  if (!Number.isInteger(fanId)) throw ERR.FAN_NOT_FOUND()
  const page = Math.max(1, Number(req.query.page) || 1)
  const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 20))
  const { list, total } = await listFanLogs({ fanId, page, pageSize })
  return sendOk(res, { list, total, page, pageSize })
}
