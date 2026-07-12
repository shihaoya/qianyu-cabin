// 千羽爬树 · PC 配置（仅平台差异项；公共参数与图片见 @cabin/games/climb）
// 图片统一放在 shared/assets/game/climb/，通过 @cabin alias 引入，PC/移动共用一份。
import sprite from '@cabin/assets/game/climb/user.png'
import bugYt from '@cabin/assets/game/climb/bug/熬夜.png'
import bugJb from '@cabin/assets/game/climb/bug/加班.png'
import bugHot from '@cabin/assets/game/climb/bug/热水.png'
import ice from '@cabin/assets/game/climb/fall/冰块.png'
import bag from '@cabin/assets/game/climb/fall/钱袋.png'
import { buildClimbConfig } from './config.base.js'

const assets = { sprite, bugYt, bugJb, bugHot, ice, bag }

// 仅写区别于公共配置的项；其余继承 @cabin 默认值
export default buildClimbConfig(assets, {
  bugs: { spawnIntervalMs: 1000 },
})
