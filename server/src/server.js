import express from 'express'
import { config } from './config/index.js'
import authRoutes from './routes/auth.js'
import guestbookRoutes from './routes/guestbook.js'
import adminRoutes from './routes/admin.js'
import gameRoutes from './routes/games.js'
import { errorHandler } from './middleware/error.js'
import { requestLog } from './middleware/requestLog.js'
import { log } from './utils/logger.js'

// 进程级异常捕获：请求链路之外的崩溃（uncaughtException）或后台 Promise 拒绝（unhandledRejection）
// 也必须留痕，否则进程悄无声息地挂掉 / 重启，完全无法排查。记录后退出，交由 pm2/systemd 重新拉起。
function fatalLog(tag, err) {
  log.error(tag, { err: err instanceof Error ? err : new Error(String(err)) })
  log.flush(() => process.exit(1))
}
process.on('uncaughtException', (err) => fatalLog('[UNCAUGHT_EXCEPTION]', err))
process.on('unhandledRejection', (reason) => fatalLog('[UNHANDLED_REJECTION]', reason))

const app = express()

// requestLog 必须在 express.json() 之前，确保请求体解析报错时也能带上 reqId 关联
app.use(requestLog)
app.use(express.json())
app.get('/api/health', (req, res) => res.json({ code: 0, data: { ok: true }, message: 'ok' }))
app.use('/api/auth', authRoutes)
app.use('/api/guestbook', guestbookRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/games', gameRoutes)
app.use(errorHandler)

app.listen(config.port, () => {
  log.info(`Qianyu server listening on :${config.port}`, { port: config.port })
})
