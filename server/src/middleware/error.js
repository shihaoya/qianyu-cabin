import { AppError } from '../utils/errors.js'
import { log } from '../utils/logger.js'

// 脱敏：递归把 password/token/secret/authorization/cookie 等字段替换为 [redacted]，
// 并限制嵌套深度，避免把大请求体或敏感凭证写进日志。
const SENSITIVE = /password|token|secret|authorization|cookie/i
function redact(obj, depth = 0) {
  if (depth > 4) return '[omitted:too-deep]'
  if (obj === null || obj === undefined) return obj
  if (typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.slice(0, 50).map((v) => redact(v, depth + 1))
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE.test(k)) out[k] = '[redacted]'
    else if (typeof v === 'object' && v !== null) out[k] = redact(v, depth + 1)
    else out[k] = v
  }
  return out
}

// 请求体可能很大，脱敏后超长则截断，避免单条日志过长
function truncateBody(body) {
  const s = JSON.stringify(redact(body))
  if (s === undefined) return undefined
  return s.length > 2000 ? s.slice(0, 2000) + '…[truncated]' : JSON.parse(s)
}

export function errorHandler(err, req, res, _next) {
  const reqId = req?.reqId ?? null
  if (err instanceof AppError) {
    // 已知业务错误（含 1008 存档非法 / 1009 结果非法等校验失败）也记录，
    // 便于排查「部分用户报错」：日志里能直接看到谁、哪个接口、什么 code、传了什么。
    log.warn(`[API] ${req.method} ${req.originalUrl} -> ${err.code} ${err.message}`, {
      code: err.code,
      reqId,
      userId: req.user?.id ?? null,
      body: truncateBody(req.body),
      query: redact(req.query),
    })
    return res.status(err.httpStatus).json({ code: err.code, data: null, message: err.message })
  }

  // 未预期错误：记录请求上下文（入参/查询/路由参数，均脱敏）+ 完整错误对象（pino 结构化序列化）。
  // 仅服务端日志，不回传前端，避免泄露实现细节。
  log.error('[UNHANDLED_ERROR]', {
    reqId,
    method: req.method,
    url: req.originalUrl,
    userId: req.user?.id ?? null,
    body: truncateBody(req.body),
    query: redact(req.query),
    params: redact(req.params),
    err, // Error 对象 → pino 序列化为 { type, message, stack, cause }
  })
  return res.status(500).json({ code: 5000, data: null, message: '服务器开小差了' })
}
