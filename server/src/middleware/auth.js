import jwt from 'jsonwebtoken'
import { config } from '../config/index.js'
import { ERR } from '../utils/errors.js'

export function auth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) return next(ERR.UNAUTHENTICATED())

  try {
    const payload = jwt.verify(token, config.jwtSecret)
    req.user = { id: payload.sub, nickname: payload.nickname }
    next()
  } catch {
    next(ERR.UNAUTHENTICATED())
  }
}
