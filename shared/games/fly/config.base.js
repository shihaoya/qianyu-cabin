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
      fps: 30, // 翅膀拍动帧率
      scale: 0.3, // 渲染缩放（360×360 帧 × 0.3 ≈ 108px；换图后若太大/太小调这里）
      frame: { width: 360, height: 360 }, // 单帧像素（图未加载时的占位尺寸；加载后按图与 cols/rows 自动计算）
      // 动画帧映射：fly 用「顺序 + 逆序」往返(乒乓)序列，再「每帧重复 2 次」展开成慢动作。
      // 原理：fps 固定 24 每帧停留 42ms（流畅）；每帧重复 K 次 → 同一画面多停留 K 倍，
      //   扇翅动作放慢为 1/K（真·慢动作）且不卡。想更慢把 2 改成 3；末帧(23)倒序回首帧(0)。
      // idle 用首帧（图未加载时占位）。
      anim: {
        fly: [...Array.from({ length: 24 }, (_, i) => i), ...Array.from({ length: 22 }, (_, i) => 22 - i)]
          .flatMap((f) => Array(2).fill(f)),
        idle: [0],
      },
    },

    // ── 小鸟物理 ──
    bird: {
      xFrac: 0.3, // 小鸟固定在屏幕宽度的 30% 处（左右不移动）
      flapImpulse: 430, // 每次拍翅赋予的向上速度（px/s，越大跳得越高）
      gravity: 1500, // 重力加速度（px/s²，越大下坠越快越难）
      maxFallVy: 720, // 最大下落速度（px/s）
      hitbox: { w: 1, h: 1 }, // 矩形碰撞回退比例（仅当精灵图掩码未生成时生效；像素级碰撞启用后按角色实际轮廓判定，忽略此值）
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

    // ── 飞入过场（仅「新开始」的游戏有；续玩/读档直接进入游戏，不加动画）──
    enter: {
      duration: 1.1, // 飞入时长（秒），从屏幕左侧外缓动飞到起点
      fromXFrac: -0.15, // 起点横坐标占屏宽比例（负 = 屏幕左侧外）；终点为 bird.xFrac
    },

    // ── 续玩倒计时（仅「继续上局」有；新局走飞入过场，不倒计时）──
    countdown: {
      duration: 3, // 倒计时秒数（3-2-1），期间游戏内容可见但不操作，结束自动开始
    },

    // ── 调试可视化 ──
    debug: {
      showHitbox: true, // 画出碰撞盒（红框）：与引擎判定完全一致，方便核对「碰到却没反应」；调试完改 false 关闭
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
