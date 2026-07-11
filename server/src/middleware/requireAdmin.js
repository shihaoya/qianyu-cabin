import { can, CAP } from '../permissions.js'
import { ERR } from '../utils/errors.js'

// 通用能力守卫：权限判定统一走 permissions.can()
export function requireCap(cap) {
  return (req, res, next) => {
    if (!can(req.user, cap)) return next(ERR.FORBIDDEN())
    next()
  }
}

// 语义化别名（底层仍走 can，便于统一排查）
export const requireAdmin = requireCap(CAP.MANAGE_USERS)
export const requireOwner = requireCap(CAP.SET_OWNER)
