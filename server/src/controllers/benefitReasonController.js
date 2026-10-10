import {
  listReasons,
  createReason,
  updateReason,
  removeReason,
} from '../services/benefitReasonService.js'
import { ERR } from '../utils/errors.js'
import { sendOk } from '../utils/response.js'

export async function getReasons(req, res) {
  const list = await listReasons()
  return sendOk(res, { list })
}

export async function postReason(req, res) {
  const { text, type } = req.body || {}
  const reason = await createReason({ text, type })
  return sendOk(res, { reason })
}

export async function patchReason(req, res) {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) throw ERR.COMMON_REASON_NOT_FOUND()
  const { text, type } = req.body || {}
  const reason = await updateReason(id, { text, type })
  return sendOk(res, { reason })
}

export async function deleteReason(req, res) {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) throw ERR.COMMON_REASON_NOT_FOUND()
  const result = await removeReason(id)
  return sendOk(res, result)
}
