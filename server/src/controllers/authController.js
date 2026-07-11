import jwt from 'jsonwebtoken'
import { config } from '../config/index.js'
import { register, verifyCredentials, getUserById, changePassword as changeUserPassword } from '../services/userService.js'
import { ERR } from '../utils/errors.js'
import { sendOk } from '../utils/response.js'

function publicUser(user) {
  return { id: user.id, nickname: user.nickname, role: user.role, createdAt: user.createdAt }
}

function signToken(user) {
  return jwt.sign(
    { sub: user.id, nickname: user.nickname, role: user.role },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn },
  )
}

export async function registerUser(req, res) {
  const { nickname, password } = req.body || {}
  if (!nickname || !password) throw ERR.PARAM('昵称和密码必填')
  if (String(password).length < 6) throw ERR.PARAM('密码至少 6 位')

  const user = await register(nickname, password)
  return sendOk(res, { token: signToken(user), user: publicUser(user) })
}

export async function loginUser(req, res) {
  const { nickname, password } = req.body || {}
  if (!nickname || !password) throw ERR.PARAM('昵称和密码必填')

  const user = await verifyCredentials(nickname, password)
  return sendOk(res, { token: signToken(user), user: publicUser(user) })
}

export async function me(req, res) {
  const user = await getUserById(req.user.id)
  if (!user) throw ERR.UNAUTHENTICATED()
  return sendOk(res, { user: publicUser(user) })
}

export async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body || {}
  if (!currentPassword || !newPassword) throw ERR.PARAM('原密码和新密码必填')
  await changeUserPassword(req.user.id, currentPassword, newPassword)
  return sendOk(res, null, '密码修改成功')
}
