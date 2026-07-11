import jwt from 'jsonwebtoken'
import { config } from '../config/index.js'
import { ERR } from '../utils/errors.js'

export function auth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) return next(ERR.UNAUTHENTICATED())

  try {
    const payload = jwt.verify(token, config.jwtSecret)
    req.user = { id: payload.sub, nickname: payload.nickname, role: payload.role }
    next()
  } catch {
    next(ERR.UNAUTHENTICATED())
  }
}

// 软鉴权：带合法 token 则注入 req.user，否则放行但不报错（用于可匿名访问的接口）
export function optionalAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) return next()

  try {
    const payload = jwt.verify(token, config.jwtSecret)
    req.user = { id: payload.sub, nickname: payload.nickname, role: payload.role }
  } catch {
    // 无效 token 不阻断，按匿名处理
  }
  next()
}
