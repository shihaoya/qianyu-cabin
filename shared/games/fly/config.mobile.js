// 像素鸟 · 移动端配置（仅平台差异项；公共参数与图片见 @cabin/games/fly）
// 图片统一放在 shared/assets/game/fly/，通过 @cabin alias 引入，PC/移动共用一份。
import sprite from '@cabin/assets/game/fly/fly.png'
import { buildFlyConfig } from './config.base.js'

const assets = { sprite }

// 玩法参数（bird / pipes / world 等）已与 PC 端在 config.base.js 中保持一致，移动端不再覆盖；
// 仅保留因移动端屏幕尺寸而必须不同的「人物缩放」，如需微调手感再在此处按需覆盖。
export default buildFlyConfig(assets, {

  bird: {
    flapImpulse: 330, // 每次拍翅赋予的向上速度（px/s，越大跳得越高）
    gravity: 1200, // 重力加速度（px/s²，越大下坠越快越难）
    maxFallVy: 520, // 最大下落速度（px/s）
  },

  character: {
    scale: 0.16, // 移动端屏小，鸟保持较小尺寸（PC 为 0.3）；其余玩法参数已与 PC 一致
  },

  // ── 管道 ──
  pipes: {
    width: 70, // 管道粗细（默认值/兜底；实际粗细在 widthMin~widthMax 间随机）
    widthMin: 30, // 最细管道
    widthMax: 120, // 最粗管道（随机粗细，增加变化与挑战）
    gap: 150, // 上下管道之间的可穿越缝隙（默认值/兜底；实际在 gapMin~gapMax 间随机）
    gapMin: 150, // 最小缝隙（须明显大于鸟高，保证角色能正常穿过）
    gapMax: 300, // 最大缝隙（越大越简单；随机缝隙大小增加变化）
    spacing: 200, // 相邻管道水平间距（默认值/兜底；实际在 spacingMin~spacingMax 间随机）
    spacingMin: 200, // 最小间距（调大 → 两根之间时间更充裕，更容易对准下一根）
    spacingMax: 500, // 最大间距（管道更疏）
  },
  // ── 世界 / 地面 ──
  world: {
    groundHeight: 34, // 底部地面带高度
  },

})
