import { listMessages, createMessage, removeMessage } from '../services/guestbookService.js'
import { sendOk } from '../utils/response.js'
import { ERR } from '../utils/errors.js'

export async function getMessages(req, res) {
  const list = await listMessages(req.user || null)
  return sendOk(res, { list })
}

export async function postMessage(req, res) {
  const { content, anonymous } = req.body || {}
  const message = await createMessage({ content, anonymous, user: req.user || null })
  return sendOk(res, { message })
}

export async function deleteMessage(req, res) {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) throw ERR.PARAM('留言不存在')
  const result = await removeMessage({ id, user: req.user })
  return sendOk(res, result)
}
