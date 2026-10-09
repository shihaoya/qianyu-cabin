import { listTypes, createType, updateType, removeType } from '../services/benefitTypeService.js'
import { ERR } from '../utils/errors.js'
import { sendOk } from '../utils/response.js'

export async function getTypes(req, res) {
  const list = await listTypes()
  return sendOk(res, { list })
}

export async function postType(req, res) {
  const { name, description } = req.body || {}
  const type = await createType({ name, description })
  return sendOk(res, { type })
}

export async function patchType(req, res) {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) throw ERR.TYPE_NOT_FOUND()
  const { name, description } = req.body || {}
  const type = await updateType(id, { name, description })
  return sendOk(res, { type })
}

export async function deleteType(req, res) {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) throw ERR.TYPE_NOT_FOUND()
  const result = await removeType(id)
  return sendOk(res, result)
}
