import { ERR } from '../utils/errors.js'

// 仅 admin（开发者）可访问
export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return next(ERR.FORBIDDEN())
  next()
}
