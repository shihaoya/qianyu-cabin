import { Router } from 'express'
import { getUsers, updateUserRole, deleteUser } from '../controllers/adminController.js'
import { auth } from '../middleware/auth.js'
import { requireAdmin } from '../middleware/requireAdmin.js'

const router = Router()

router.use(auth, requireAdmin)
router.get('/users', getUsers)
router.patch('/users/:id', updateUserRole)
router.delete('/users/:id', deleteUser)

export default router
