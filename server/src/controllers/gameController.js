import { sendOk } from '../utils/response.js'
import { ERR } from '../utils/errors.js'
import * as gameService from '../services/gameService.js'

export async function getCatalog(req, res) {
  const meta = gameService.listGamesMeta()
  const list = await Promise.all(
    meta.map(async (g) => {
      const save = req.user
        ? await gameService.getSave({ userId: req.user.id, gameKey: g.key })
        : null
      const best = req.user
        ? await gameService.myBest({ userId: req.user.id, gameKey: g.key })
        : null
      return {
        ...g,
        hasSave: !!save,
        savePlatform: save?.platform || null,
        bestScore: best,
      }
    }),
  )
  return sendOk(res, { list })
}

export async function getSave(req, res) {
  const data = await gameService.getSave({ userId: req.user.id, gameKey: req.params.key })
  return sendOk(res, data) // 无存档时 data 为 null
}

export async function saveGame(req, res) {
  const { state, score, platform } = req.body || {}
  if (!state) throw ERR.PARAM('存档状态不能为空')
  await gameService.upsertSave({
    userId: req.user.id,
    gameKey: req.params.key,
    state,
    score,
    platform: platform === 'mobile' ? 'mobile' : 'pc',
  })
  return sendOk(res, null, '已存档')
}

export async function getHistory(req, res) {
  const page = Math.max(1, Number(req.query.page) || 1)
  const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 20))
  const data = await gameService.myHistory({
    userId: req.user.id,
    gameKey: req.params.key,
    page,
    pageSize,
  })
  return sendOk(res, data)
}

export async function submitRecord(req, res) {
  const { result, platform } = req.body || {}
  if (!result) throw ERR.PARAM('游戏结果不能为空')
  const data = await gameService.addRecord({
    userId: req.user.id,
    gameKey: req.params.key,
    result,
    platform: platform === 'mobile' ? 'mobile' : 'pc',
  })
  return sendOk(res, data, '成绩已记录')
}

export async function getLeaderboard(req, res) {
  const page = Math.max(1, Number(req.query.page) || 1)
  const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 20))
  const data = await gameService.leaderboard({
    gameKey: req.params.key,
    page,
    pageSize,
  })
  return sendOk(res, data)
}

export async function deleteSave(req, res) {
  await gameService.clearSave({ userId: req.user.id, gameKey: req.params.key })
  return sendOk(res, null, '存档已清除')
}
