// 打是亲 · PC 配置（仅平台差异项；公共参数与图片见 @cabin/games/slap/config.base.js）
// 图片统一放在 shared/assets/game/slap/，通过 @cabin alias 引入，PC/移动共用一份。
import idle from '@cabin/assets/game/slap/qianyu_idle.png'
import blink from '@cabin/assets/game/slap/qianyu_blink.png'
import cry from '@cabin/assets/game/slap/qianyu_cry.png'
import angry from '@cabin/assets/game/slap/qianyu_angry.png'
import fly from '@cabin/assets/game/slap/qianyu_fly.png'
import hand from '@cabin/assets/game/slap/hand.png'
import { buildSlapConfig } from './config.base.js'

const assets = {
  faces: { idle, blink, cry, angry, fly },
  hand,
}

// PC 屏宽裕，角色与手掌稍大
export default buildSlapConfig(assets, {})
