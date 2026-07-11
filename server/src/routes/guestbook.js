import { Router } from 'express'
import { getMessages, postMessage, deleteMessage } from '../controllers/guestbookController.js'
import { optionalAuth, auth } from '../middleware/auth.js'

const router = Router()

router.get('/', optionalAuth, getMessages)
router.post('/', optionalAuth, postMessage)
router.delete('/:id', auth, deleteMessage)

export default router
