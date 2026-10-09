import { Router } from 'express'
import { getMyBenefitsPage } from '../controllers/meController.js'
import { auth } from '../middleware/auth.js'

// 「我的」类接口：只需登录，不需要管理权限
const router = Router()

router.use(auth)
router.get('/benefits', getMyBenefitsPage)

export default router
