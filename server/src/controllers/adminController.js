import { listUsers, setRole } from '../services/userService.js'
import { ERR } from '../utils/errors.js'
import { sendOk } from '../utils/response.js'

const ROLES = ['user', 'admin']

export async function getUsers(req, res) {
  const page = Math.max(1, Number(req.query.page) || 1)
  const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 20))
  const { list, total } = await listUsers({ page, pageSize })
  return sendOk(res, { list, total, page, pageSize })
}

export async function updateUserRole(req, res) {
  const id = Number(req.params.id)
  const { role } = req.body || {}
  if (!ROLES.includes(role)) throw ERR.PARAM('角色不合法')

  // 防止开发者把自己降级，导致再也无法管理
  if (req.user.id === id && role !== 'admin') {
    throw ERR.PARAM('不能修改自己的开发者身份')
  }

  const user = await setRole(id, role)
  return sendOk(res, {
    user: { id: user.id, nickname: user.nickname, role: user.role },
  })
}
