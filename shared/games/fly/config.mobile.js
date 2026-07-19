// 像素鸟 · 移动端配置（仅平台差异项；公共参数与图片见 @cabin/games/fly）
// 图片统一放在 shared/assets/game/fly/，通过 @cabin alias 引入，PC/移动共用一份。
import sprite from '@cabin/assets/game/fly/fly.png'
import { buildFlyConfig } from './config.base.js'

const assets = { sprite }

// 手机屏较窄（横屏可用高度有限）：人物、管道都收小一圈，间距也收窄，整体更紧凑、更好操控
export default buildFlyConfig(assets, {
  character: {
    scale: 0.16, // 人物缩放（base 0.3≈108px → 0.14≈50px）：写在 character 下才会被 render/engine 读取
  },
  bird: {
    xFrac: 0.28, // 鸟略靠左，给右侧管道更多预判空间
    flapImpulse: 430, // 拍翅力度（base 430）：跳跃幅度正常
  },
  pipes: {
    gap: 160, // 缝隙收窄（base 200 / PC 210）
    gapMin: 160, // 最小缝隙（> 鸟高 ~36px，保证可通过）
    gapMax: 240, // 随机缝隙大小上限
    gapMargin: 70,
    maxGapShift: 200, // 相邻缝隙中心最大垂直位移（小屏纵向有限，取值比 PC 小）
    widthMin: 46, // 管道更细（base 58）
    widthMax: 84, // 最粗管道也明显小于 PC（base 108）
    spacing: 260, // 默认水平间距
    spacingMin: 230, // 最密（base 230）→ 调大最小间距，两根之间更从容
    spacingMax: 340, // 最疏（base 360），整体比 PC 紧凑
    speed: 150, // 略慢，给小屏更多反应时间
  },
  world: {
    groundHeight: 60, // 地面带收小（base 96），小屏纵向更宽松（render 会按此高度画地面）
  },
})
