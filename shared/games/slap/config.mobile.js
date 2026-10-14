// 打是亲 · 移动端配置（仅平台差异项；公共参数与图片见 @cabin/games/slap/config.base.js）
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

// 移动端屏窄：角色与手掌相对占更大比例；手指划动幅度天然比鼠标小，故降低触发位移与速度门槛
export default buildSlapConfig(assets, {
  character: {
    heightFrac: 0.63, // 原始 0.42 放大 1.5 倍
    groundFrac: 0.86,
  },
  fx: {
    floaterSize: 30, // 手机屏窄，飘字比 PC 略小一号
  },
  hand: {
    heightFrac: 0.24,
    rearmPx: 34, // 手指幅度比鼠标小，重武装距离相应缩短
    hitRangeY: 0.2, // 高度判定放宽，手指不容易精准对准脸
  },
  swipe: {
    minSpeed: 30,
    maxSpeed: 5000,
  },
  hit: {
    shakeAmp: 7,
    shiftPx: 12,
  },
})
