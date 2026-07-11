import { listUsers, setRole, getUserById } from '../services/userService.js'
import { ERR } from '../utils/errors.js'
import { sendOk } from '../utils/response.js'
import { isValidRole, can, ROLE, CAP, canAssignRole } from '../permissions.js'

export async function getUsers(req, res) {
  const page = Math.max(1, Number(req.query.page) || 1)
  const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 20))
  const { list, total } = await listUsers({ page, pageSize })
  return sendOk(res, { list, total, page, pageSize })
}

export async function updateUserRole(req, res) {
  const id = Number(req.params.id)
  const { role } = req.body || {}
  if (!isValidRole(role)) throw ERR.PARAM('角色不合法')

  // 不能修改自己的角色，避免锁死 / 误操作
  if (req.user.id === id) throw ERR.PARAM('不能修改自己的角色')

  const target = await getUserById(id)
  // 只有开发管理员能修改开发管理员的角色，其余角色（含管理员）不得动开发管理员
  if (target && target.role === ROLE.OWNER && !can(req.user, CAP.SET_OWNER)) {
    throw ERR.FORBIDDEN('只有开发管理员可以修改开发管理员的角色')
  }

  // 自身层级须足以授予该角色（新增角色后按 ROLE_RANK 自动判定，无需改此处）
  if (!canAssignRole(req.user, role)) {
    throw ERR.FORBIDDEN(
      role === ROLE.OWNER ? '只有开发管理员可以设置开发管理员' : '无权设置该角色',
    )
  }

  const user = await setRole(id, role)
  return sendOk(res, {
    user: { id: user.id, nickname: user.nickname, role: user.role },
  })
}
