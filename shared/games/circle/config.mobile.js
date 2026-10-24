// 千羽画圈圈 · 移动端配置（仅平台差异项；公共参数与图片见 @cabin/games/circle）
// 图片统一放在 shared/assets/game/circle/，通过 @cabin alias 引入，PC/移动共用一份。
import sprite from '@cabin/assets/game/circle/qianyu.png'
import bugYt from '@cabin/assets/game/climb/bug/熬夜.png'
import bugJb from '@cabin/assets/game/climb/bug/加班.png'
import bugHot from '@cabin/assets/game/climb/bug/热水.png'
import { buildCircleConfig } from './config.base.js'

const assets = { sprite, bugYt, bugJb, bugHot }

// 仅写区别于公共配置的项；其余继承 @cabin 默认值
export default buildCircleConfig(assets, {
  ring: {
    radiusFrac: 0.42, // 圆环更大（手机屏小，看得更清楚）
    width: 10, // 跑道更细
  },
  character: {
    scale: 0.16, // 人物稍小，适配更大的圆环
  },
  monsters: {
    imageScale: 0.09, // 怪物稍小
  },
})
