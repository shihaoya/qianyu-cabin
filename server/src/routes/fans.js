import { Router } from 'express'
import {
  getFans,
  postFan,
  patchFan,
  deleteFan,
  getFanCards,
  adjustCard,
  getFanLogs,
} from '../controllers/fanController.js'
import { auth } from '../middleware/auth.js'
import { requireBenefitsAdmin } from '../middleware/requireAdmin.js'

const router = Router()

router.use(auth, requireBenefitsAdmin)
router.get('/', getFans)
router.post('/', postFan)
// 子资源写在 /:id 之前，避免被通配参数吃掉
router.get('/:id/cards', getFanCards)
router.post('/:id/cards/adjust', adjustCard)
router.get('/:id/logs', getFanLogs)
router.patch('/:id', patchFan)
router.delete('/:id', deleteFan)

export default router
