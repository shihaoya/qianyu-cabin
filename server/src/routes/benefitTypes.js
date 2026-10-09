import { Router } from 'express'
import {
  getTypes,
  postType,
  patchType,
  deleteType,
} from '../controllers/benefitTypeController.js'
import { auth } from '../middleware/auth.js'
import { requireBenefitsAdmin } from '../middleware/requireAdmin.js'

const router = Router()

router.use(auth, requireBenefitsAdmin)
router.get('/', getTypes)
router.post('/', postType)
router.patch('/:id', patchType)
router.delete('/:id', deleteType)

export default router
