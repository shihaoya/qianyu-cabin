// 千羽画圈圈 · PC 配置（仅平台差异项；公共参数与图片见 @cabin/games/circle）
// 图片统一放在 shared/assets/game/circle/，通过 @cabin alias 引入，PC/移动共用一份。
import sprite from '@cabin/assets/game/circle/qianyu.png'
import bugYt from '@cabin/assets/game/climb/bug/熬夜.png'
import bugJb from '@cabin/assets/game/climb/bug/加班.png'
import bugHot from '@cabin/assets/game/climb/bug/热水.png'
import { buildCircleConfig } from './config.base.js'

const assets = { sprite, bugYt, bugJb, bugHot }

// 仅写区别于公共配置的项；其余继承 @cabin 默认值
export default buildCircleConfig(assets, {
  character: { scale: 0.26 },
  monsters: { imageScale: 0.14 },
})
