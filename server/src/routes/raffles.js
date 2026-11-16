import { Router } from 'express'
import {
  getPrizes,
  postPrize,
  patchPrize,
  deletePrize,
  postDraw,
  getRecords,
  postSelfDraw,
  getSelfDrawRecords,
} from '../controllers/raffleController.js'
import { auth } from '../middleware/auth.js'
import { requireRaffleAdmin } from '../middleware/requireAdmin.js'

const router = Router()

// 主播端：需要 manageRaffle 能力
router.get('/prizes', auth, requireRaffleAdmin, getPrizes)
router.post('/prizes', auth, requireRaffleAdmin, postPrize)
router.patch('/prizes/:id', auth, requireRaffleAdmin, patchPrize)
router.delete('/prizes/:id', auth, requireRaffleAdmin, deletePrize)
router.post('/draw', auth, requireRaffleAdmin, postDraw)
router.get('/records', auth, requireRaffleAdmin, getRecords)

// 粉丝端：登录即可（通过绑定的站内账号反查粉丝档案）
router.post('/self-draw', auth, postSelfDraw)
router.get('/self-draw-records', auth, getSelfDrawRecords)

export default router
