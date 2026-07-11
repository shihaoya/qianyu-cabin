import { Router } from 'express'
import { registerUser, loginUser, me, changePassword } from '../controllers/authController.js'
import { auth } from '../middleware/auth.js'

const router = Router()

router.post('/register', registerUser)
router.post('/login', loginUser)
router.get('/me', auth, me)
router.post('/change-password', auth, changePassword)

export default router
