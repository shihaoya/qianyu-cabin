import { getMyBenefits } from '../services/fanService.js'
import { sendOk } from '../utils/response.js'

// 登录用户查看自己的福利（按 req.user.id 反查粉丝档案，越权不可达：不带 id 入参）
export async function getMyBenefitsPage(req, res) {
  const data = await getMyBenefits({ userId: req.user.id })
  return sendOk(res, data)
}
