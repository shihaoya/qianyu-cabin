// 像素鸟 · PC 配置（仅平台差异项；公共参数与图片见 @cabin/games/fly）
// 图片统一放在 shared/assets/game/fly/，通过 @cabin alias 引入，PC/移动共用一份。
import sprite from '@cabin/assets/game/fly/fly.png'
import { buildFlyConfig } from './config.base.js'

const assets = { sprite }

// PC 屏较宽，缝隙和管道可稍大，手感更从容
export default buildFlyConfig(assets, {
  pipes: {
    gap: 210,
    gapMin: 160, // 最小缝隙（> 鸟高 ~67px，保证可通过）
    gapMax: 250, // 随机缝隙大小上限
    gapMargin: 70,
    maxGapShift: 300, // 相邻缝隙中心最大垂直位移（< 最小间距时间内可爬升距离，保证可达）
    spacing: 320,
    spacingMin: 280, // 调大最小间距，两根之间更从容
    spacingMax: 400,
    speed: 160,
  },
  character: {
    scale: 0.3, // 写在 character 下才会被 render/engine 读取（base 同值，此处显式声明保持一致）
  },
})
