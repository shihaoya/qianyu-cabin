// 生产级结构化日志：基于 pino（Node 生态事实标准，最快、结构化 JSON 输出）。
// - 始终落盘到 logs/（pino-roll 按天轮转、保留 14 份、生成 current.log 软链便于 tail -f）
// - 非 production 环境额外在控制台用 pino-pretty 彩色输出，便于本地阅读
// 级别由环境变量 LOG_LEVEL 控制（trace<debug<info<warn<error<fatal），默认 info。
import pino from 'pino'

const level = (process.env.LOG_LEVEL || 'info').toLowerCase()
const isProd = process.env.NODE_ENV === 'production'

// 日志目标（多 destination）
const targets = [
  // 1) 文件落盘：按天轮转，保留最近 14 个文件，并建立 current.log 软链指向正在写入的文件
  {
    target: 'pino-roll',
    level,
    options: {
      file: 'logs/qianyu',
      frequency: 'daily',
      limit: { count: 14 },
      mkdir: true,
    },
  },
]

// 2) 非生产环境：控制台彩色输出（生产只写文件，避免重复 / 利于日志采集）
if (!isProd) {
  targets.push({
    target: 'pino-pretty',
    level,
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  })
}

const pinoLogger = pino({ level, transport: { targets } })

// 薄封装：保持原调用签名 log.warn(msg, meta) / log.error(msg, meta)，
// 而 pino 原生是 (meta, msg)，这里把第二个对象参数放到前面作为结构化字段。
function wrap(method) {
  return (msg, meta) => {
    if (meta !== undefined && meta !== null) {
      pinoLogger[method](meta, msg)
    } else {
      pinoLogger[method](msg)
    }
  }
}

export const log = {
  trace: wrap('trace'),
  debug: wrap('debug'),
  info: wrap('info'),
  warn: wrap('warn'),
  error: wrap('error'),
  // 同步刷盘后回调：进程级致命错误记录后需 flush 再退出，避免日志丢失。
  // 兼容 pino 的 Promise / 回调两种 flush 形态，并加兜底超时确保一定退出。
  flush: (cb) => {
    let called = false
    const done = () => {
      if (!called) {
        called = true
        if (cb) cb()
      }
    }
    try {
      const r = pinoLogger.flush(done)
      if (r && typeof r.then === 'function') r.then(done, done)
    } catch {
      /* 忽略 flush 异常 */
    }
    setTimeout(done, 500)
  },
}
