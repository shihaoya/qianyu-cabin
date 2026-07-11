import { Router } from 'express'
import { getUsers, updateUserRole } from '../controllers/adminController.js'
import { auth } from '../middleware/auth.js'
import { requireAdmin } from '../middleware/requireAdmin.js'

const router = Router()

router.use(auth, requireAdmin)
router.get('/users', getUsers)
router.patch('/users/:id', updateUserRole)

export default router
