import { Router } from 'express'
import {
  getReasons,
  postReason,
  patchReason,
  deleteReason,
} from '../controllers/benefitReasonController.js'
import { auth } from '../middleware/auth.js'
import { requireBenefitsAdmin } from '../middleware/requireAdmin.js'

const router = Router()

router.use(auth, requireBenefitsAdmin)
router.get('/', getReasons)
router.post('/', postReason)
router.patch('/:id', patchReason)
router.delete('/:id', deleteReason)

export default router
