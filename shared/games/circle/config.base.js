// 千羽画圈圈 · 公共配置工厂（所有可调参数集中在此，改这里即可调游戏，无需动逻辑代码）
//
// 资源路径由各端通过 assets 注入（PC/移动资源目录不同，故不在 base 内写死路径）。
// 平台差异项通过 overrides 深度合并。
//
// 换人物图：把新图放到 shared/assets/game/circle/ 下，在 config.pc.js / config.mobile.js 修改 import 路径，
// 人物图为「整图单帧」（307×307），渲染时按 character.scale 缩放并裁掉四周透明边即可，逻辑代码不用动。

export function buildCircleConfig(assets, overrides = {}) {
  const cfg = {
    // ── 画布（逻辑像素，CSS 再等比缩放；实际尺寸由 resize 跟随舞台）──
    view: {
      width: 480,
      height: 480,
      background: '#f7f1e3', // 小屋宣纸底色
    },

    // ── 圆环几何 ──
    ring: {
      radiusFrac: 0.32, // 圆环半径 = min(宽,高) × 该比例
      width: 14, // 跑道宽度（px）
      color: 'rgba(138,90,43,0.18)', // 未涂色跑道（暖棕浅纹）
      paintColor: '#5b8c7b', // 涂色（小屋主题绿）
      paintGlow: 'rgba(91,140,123,0.55)', // 涂色光晕
    },

    // ── 人物（千羽）──
    character: {
      image: assets.sprite,
      scale: 0.16, // 渲染缩放（307 整图 × 0.16 ≈ 49px）
      jumpTime: 0.42, // 跳跃滞空时长（秒）
      jumpHeightFrac: 0.28, // 跳跃高度 = 半径 × 该比例（向圆心跳）
    },

    // ── 怪物（与人物反向、定速循环）──
    monsters: {
      imageScale: 0.11, // 怪物贴图缩放（500×500 贴图 × 0.11 ≈ 55px）
      hitDist: 24, // 碰撞判定像素距离（屏幕坐标）
      // 三种怪物贴图（复用爬树的虫子素材）；wobble = 自转摆动速度
      types: [
        { key: 'jiaban', name: '加班虫', image: assets.bugJb, color: '#7bbf6a', wobble: 2.2 },
        { key: 'yeqian', name: '熬夜虫', image: assets.bugYt, color: '#8e7cc3', wobble: 2.6 },
        { key: 'reshui', name: '热水虫', image: assets.bugHot, color: '#e07a5f', wobble: 1.8 },
      ],
    },

    // ── 下落过场（新开局）──
    drop: {
      duration: 0.9, // 从屏幕中心落到跑道正下方的时长（秒）
      fromYFrac: 0.3, // 起点纵坐标占画布高度比例（视觉上从屏幕中央附近落下）
    },

    // ── 可调难度（开始前填写；存档续玩沿用当局配置）──
    difficulty: {
      monsterCount: 4, // 怪物数量（1~8）
      monsterSpeed: 1, // 怪物速度倍率（0.5~2）
      runSpeed: 1, // 人物速度倍率（0.5~2）
    },
    speed: {
      base: 1.15, // 人物基础角速度 rad/s（× runSpeed，顺时针为负）
      monsterBase: 0.55, // 怪物基础角速度 rad/s（× monsterSpeed，逆时针为正）
    },

    // ── 存档 / 自动存档 ──
    save: {
      autoSaveIntervalMs: 2000, // 游玩中每隔多久自动存档一次
    },

    // ── 玩法说明（问号悬浮层）──
    help: [
      '千羽会沿圆环自动奔跑，跑过的地方会被涂上颜色。',
      '圆环上有几只怪物在定速游走，碰到就会失败！',
      '按 空格 或 点击屏幕 让千羽跳起躲开怪物（跳过的地方不会被涂色）。',
      '把整条圆环全部涂满就胜利！',
    ],
  }

  return deepMerge(cfg, overrides)
}

function isPlainObject(v) {
  return v != null && typeof v === 'object' && !Array.isArray(v)
}
// 深度合并 overrides 到 base（数组整体替换，不递归）
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
