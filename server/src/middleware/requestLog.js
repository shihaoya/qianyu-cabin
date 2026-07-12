import { randomUUID } from 'node:crypto'
import { log } from '../utils/logger.js'

// 请求级访问日志：默认 info 级别，每个接口请求都会记录（method / url / 状态码 / 耗时 / userId / reqId），
// 即「全日志」。reqId 与 error 中间件共用，grep 一个 ID 即可拼出一次请求的完整链路（入参→结果→报错）。
export function requestLog(req, res, next) {
  // 优先用上游（nginx/网关）带来的 X-Request-Id，否则自生成；并回写响应头便于前端/代理关联。
  req.reqId = req.headers['x-request-id'] || randomUUID()
  res.setHeader('X-Request-Id', req.reqId)
  const start = Date.now()
  const userId = req.user?.id ?? null
  res.on('finish', () => {
    const ms = Date.now() - start
    log.info(`[REQ] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${ms}ms)`, {
      reqId: req.reqId,
      userId,
    })
  })
  next()
}
