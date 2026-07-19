import { prisma } from '../db/index.js'
import { ERR } from '../utils/errors.js'
import { getEngine, listEngines } from '../games/registry.js'
import { log } from '../utils/logger.js'

function safeParse(s) {
  if (!s) return null
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}

// 把「游戏结果」压缩成可记录的摘要
function summarizeResult(r) {
  if (!r || typeof r !== 'object') return { invalid: 'not-object' }
  return {
    score: r.score,
    bugScore: r.bugScore,
    bugsKilled: r.bugsKilled,
    timeSurvived: r.timeSurvived,
    hpLeft: r.hpLeft,
  }
}

// 目录元数据（不含 engine 内部方法）
export function listGamesMeta() {
  return listEngines().map((e) => ({ key: e.key, name: e.name }))
}

async function getEngineOrThrow(key) {
  const engine = getEngine(key)
  if (!engine) throw ERR.GAME_NOT_FOUND()
  return engine
}

// 存档：原样存储前端上报的状态，不做业务校验（前端传什么存什么，便于跨端续玩）。
// 仅确认 gameKey 对应游戏存在；state 直接 JSON 序列化入库，score/platform 原样保留（仅做 DB 类型兜底，不拒绝）。
export async function upsertSave({ userId, gameKey, state, score, platform }) {
  await getEngineOrThrow(gameKey) // 仅确认游戏存在，不校验状态内容
  const data = {
    gameKey,
    state: state == null ? '{}' : JSON.stringify(state),
    score: typeof score === 'number' ? score : null,
    platform: typeof platform === 'string' && platform ? platform : 'pc',
  }
  await prisma.gameSave.upsert({
    where: { userId_gameKey: { userId, gameKey } },
    create: { userId, ...data },
    update: data,
  })
  return { ok: true }
}

export async function getSave({ userId, gameKey }) {
  const row = await prisma.gameSave.findUnique({
    where: { userId_gameKey: { userId, gameKey } },
  })
  if (!row) return null
  return {
    state: safeParse(row.state),
    score: row.score,
    platform: row.platform,
    updatedAt: row.updatedAt,
  }
}

export async function clearSave({ userId, gameKey }) {
  await prisma.gameSave.deleteMany({ where: { userId, gameKey } })
  return { ok: true }
}

// 结束一局：engine 校验结果 → 算分入库 → 清掉续玩档
export async function addRecord({ userId, gameKey, result, platform }) {
  const engine = await getEngineOrThrow(gameKey)
  if (!engine.validateResult(result)) {
    // 校验失败必记日志：可对比 score 与 3~5*击虫数，判断是否为前后端计分公式不一致
    log.warn('[RESULT_INVALID] 游戏结果校验失败', { userId, gameKey, result: summarizeResult(result) })
    throw ERR.RESULT_INVALID()
  }
  const score = engine.score(result)
  const record = await prisma.gameRecord.create({
    data: { userId, gameKey, score, detail: JSON.stringify(result), platform: platform === 'mobile' ? 'mobile' : 'pc' },
  })
  await prisma.gameSave.deleteMany({ where: { userId, gameKey } })
  return { id: record.id, score }
}

// 个人最佳（目录展示用）
export async function myBest({ userId, gameKey }) {
  const row = await prisma.gameRecord.findFirst({
    where: { userId, gameKey },
    orderBy: { score: 'desc' },
    select: { score: true },
  })
  return row ? row.score : null
}

// 我的历史（倒序）
export async function myHistory({ userId, gameKey, page = 1, pageSize = 20 }) {
  const where = { userId, gameKey }
  const total = await prisma.gameRecord.count({ where })
  const list = await prisma.gameRecord.findMany({
    where,
    orderBy: { finishedAt: 'desc' },
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: { id: true, score: true, detail: true, platform: true, finishedAt: true },
  })
  return {
    list: list.map((r) => ({ ...r, detail: safeParse(r.detail) })),
    total,
    page,
    pageSize,
  }
}

// 排行榜：每用户取最佳 score，按 engine.order 排序，附昵称/平台/明细
export async function leaderboard({ gameKey, page = 1, pageSize = 20 }) {
  const engine = await getEngineOrThrow(gameKey)
  const where = { gameKey }
  const grouped = await prisma.gameRecord.groupBy({
    by: ['userId'],
    where,
    _max: { score: true },
    orderBy:
      engine.order === 'asc'
        ? [{ _max: { score: 'asc' } }]
        : [{ _max: { score: 'desc' } }],
    skip: (page - 1) * pageSize,
    take: pageSize,
  })
  const total = (await prisma.gameRecord.groupBy({ by: ['userId'], where })).length

  const ranked = await Promise.all(
    grouped.map(async (g, i) => {
      const best = await prisma.gameRecord.findFirst({
        where: { userId: g.userId, gameKey, score: g._max.score },
        orderBy: { finishedAt: 'asc' },
        select: { detail: true, platform: true, finishedAt: true },
      })
      return {
        rank: (page - 1) * pageSize + i + 1,
        userId: g.userId,
        score: g._max.score,
        platform: best?.platform || 'pc',
        finishedAt: best?.finishedAt || null,
        detail: safeParse(best?.detail),
      }
    }),
  )

  const userIds = ranked.map((r) => r.userId)
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, nickname: true },
  })
  const nickMap = Object.fromEntries(users.map((u) => [u.id, u.nickname]))
  ranked.forEach((r) => {
    r.nickname = nickMap[r.userId] || '旅人'
  })

  return { list: ranked, total, page, pageSize }
}
