import { Router } from 'express'
import {
  getPrizes,
  postPrize,
  patchPrize,
  deletePrize,
  postDraw,
  getRecords,
} from '../controllers/raffleController.js'
import { auth } from '../middleware/auth.js'
import { requireRaffleAdmin } from '../middleware/requireAdmin.js'

const router = Router()

router.use(auth, requireRaffleAdmin)
router.get('/prizes', getPrizes)
router.post('/prizes', postPrize)
router.patch('/prizes/:id', patchPrize)
router.delete('/prizes/:id', deletePrize)
router.post('/draw', postDraw)
router.get('/records', getRecords)

export default router
