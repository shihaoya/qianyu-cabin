// 像素鸟 · 公共配置工厂（所有可调参数集中在此，改这里即可调游戏，无需动逻辑代码）
// 资源路径由各端通过 assets 注入（PC/移动资源目录不同，故不在 base 内写死路径）。
// 换人物图：把新图放到 shared/assets/game/fly/ 下，在 config.pc.js / config.mobile.js 修改 import 路径，
// 同时按新图「行数/列数/总帧」改 sheet 即可，逻辑代码不用动。

export function buildFlyConfig(assets, overrides = {}) {
  const cfg = {
    // ── 画布（逻辑像素，CSS 再等比缩放；实际尺寸由 resize 跟随舞台）──
    view: {
      width: 480,
      height: 640,
      background: '#f7f1e3',
    },

    // ── 碰撞通用参数 ──
    collidePad: 1, // 管道/地面碰撞判定收缩量（px）；值越小越容易撞上（越大越宽容）

    // ── 小鸟精灵 ──
    character: {
      image: assets.sprite,
      sheet: { cols: 4, rows: 6, totalFrames: 24 }, // 4 列 6 行共 24 帧（精灵图 1440×2160）
      fps: 24, // 翅膀拍动帧率
      scale: 0.3, // 渲染缩放（360×360 帧 × 0.3 ≈ 108px；换图后若太大/太小调这里）
      frame: { width: 360, height: 360 }, // 单帧像素（图未加载时的占位尺寸；加载后按图与 cols/rows 自动计算）
      // 动画帧映射：fly 为 24 帧循环拍翅；idle/dead 用首帧（图未加载时占位）
      // 觉得拍翅太快/太慢 → 调上面的 fps；想换某几帧当拍翅 → 改这里的数组
      anim: {
        fly: Array.from({ length: 24 }, (_, i) => i), // 0..23 全用，完整展现人物动作
        idle: [0],
      },
    },

    // ── 小鸟物理 ──
    bird: {
      xFrac: 0.3, // 小鸟固定在屏幕宽度的 30% 处（左右不移动）
      flapImpulse: 430, // 每次拍翅赋予的向上速度（px/s，越大跳得越高）
      gravity: 1500, // 重力加速度（px/s²，越大下坠越快越难）
      maxFallVy: 720, // 最大下落速度（px/s）
      hitbox: { w: 0.62, h: 0.62 }, // 碰撞盒占整帧的比例（居中），收紧避免“视觉很远就撞上”
    },

    // ── 管道 ──
    pipes: {
      width: 70, // 管道粗细（默认值/兜底；实际粗细在 widthMin~widthMax 间随机）
      widthMin: 30, // 最细管道
      widthMax: 150, // 最粗管道（随机粗细，增加变化与挑战）
      gap: 300, // 上下管道之间的可穿越缝隙（默认值/兜底；实际在 gapMin~gapMax 间随机）
      gapMin: 300, // 最小缝隙（须明显大于鸟高，保证角色能正常穿过）
      gapMax: 500, // 最大缝隙（越大越简单；随机缝隙大小增加变化）
      gapMargin: 0, // 缝隙「边缘」离顶/离地的最小距离（保证整条缝隙完整在屏内、不贴边；spawnPipe 与 clampPipeToScreen 一致以边缘为基准）
      maxGapShift: 500, // 相邻管道缝隙中心的「最大垂直位移」：限制前后缝隙上下跳变，保证鸟在两根之间的水平时间内飞得过去
      spacing: 300, // 相邻管道水平间距（默认值/兜底；实际在 spacingMin~spacingMax 间随机）
      spacingMin: 300, // 最小间距（调大 → 两根之间时间更充裕，更容易对准下一根）
      spacingMax: 600, // 最大间距（管道更疏）
      speed: 160, // 管道左移速度（px/s，越大越快越难）
    },

    // ── 世界 / 地面 ──
    world: {
      groundHeight: 96, // 底部地面带高度
    },

    // ── 存档 / 自动存档 ──
    save: {
      autoSaveIntervalMs: 2000,
    },

    // ── 玩法说明（问号悬浮层）──
    help: [
      '点击屏幕 / 空格 / ↑ 让小鸟拍翅向上；松手后会因重力下坠。',
      '穿过上下管道之间的缝隙得分，撞到管道或落地就结束，比谁飞得更远~',
    ],
  }

  return deepMerge(cfg, overrides)
}

function isPlainObject(v) {
  return v != null && typeof v === 'object' && !Array.isArray(v)
}
function deepMerge(base, over) {
  if (!isPlainObject(base) || !isPlainObject(over)) return over === undefined ? base : over
  const out = { ...base }
  for (const k of Object.keys(over)) {
    const bv = base[k]
    const ov = over[k]
    out[k] = isPlainObject(bv) && isPlainObject(ov) ? deepMerge(bv, ov) : ov
  }
  return out
}
