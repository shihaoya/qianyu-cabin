// 像素鸟 · 移动端配置（仅平台差异项；公共参数与图片见 @cabin/games/fly）
// 图片统一放在 shared/assets/game/fly/，通过 @cabin alias 引入，PC/移动共用一份。
import sprite from '@cabin/assets/game/fly/fly.png'
import { buildFlyConfig } from './config.base.js'

const assets = { sprite }

// 手机屏较窄：鸟小一点、缝隙略收，整体更秀气但仍可玩
export default buildFlyConfig(assets, {
  bird: {
    scale: 0.24,
  },
  pipes: {
    gap: 175,
    spacing: 250,
    speed: 155,
  },
})
