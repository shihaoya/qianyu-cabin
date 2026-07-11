import { Router } from 'express'
import * as gameController from '../controllers/gameController.js'
import { auth, optionalAuth } from '../middleware/auth.js'

const router = Router()

// 目录（登录可见存档标记/最佳；未登录也能看列表）
router.get('/', optionalAuth, gameController.getCatalog)
// 存档：取 / 存 / 清（需登录）
router.get('/:key/save', auth, gameController.getSave)
router.put('/:key/save', auth, gameController.saveGame)
router.delete('/:key/save', auth, gameController.deleteSave)
// 历史（我的，需登录）
router.get('/:key/records', auth, gameController.getHistory)
// 结束一局：上报结果 → 算分入库（需登录）
router.post('/:key/records', auth, gameController.submitRecord)
// 排行榜（游戏内展示，需登录，D2）
router.get('/:key/leaderboard', auth, gameController.getLeaderboard)

export default router
