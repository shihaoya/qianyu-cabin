// 千羽爬树 · 中央配置（所有可调参数集中在此，改这里即可调游戏，无需动逻辑代码）
// PC 与移动端各放一份同样内容；引擎/渲染两端共用，保证行为一致。
//
// 想换人物图：把新图放到 src/assets/game/climb/ 下，并修改下面 character.image 的相对路径，
// 同时按新图的「行数 rows / 列数 cols / 总帧数」改 sheet 配置即可，逻辑代码不用动。

// 用 new URL + import.meta.url 让 Vite 按 base 正确处理资源（dev/prod、pc/mobile 都稳）
const SPRITE_URL = new URL('../../assets/game/climb/user.png', import.meta.url).href
// 虫子图片（用户补充）
const BUG_YT_URL = new URL('../../assets/game/climb/bug/熬夜.png', import.meta.url).href
const BUG_JB_URL = new URL('../../assets/game/climb/bug/加班.png', import.meta.url).href
const BUG_HOT_URL = new URL('../../assets/game/climb/bug/热水.png', import.meta.url).href
// 掉落物图片（用户补充）：冰块=回血，钱袋=护盾
const ICE_URL = new URL('../../assets/game/climb/fall/冰块.png', import.meta.url).href
const BAG_URL = new URL('../../assets/game/climb/fall/钱袋.png', import.meta.url).href

export default {
  // ── 画布（逻辑像素，CSS 再等比缩放；实际尺寸由 resize 跟随舞台）──
  view: {
    width: 480,
    height: 600,
    background: '#f7f1e3',
  },

  // ── 碰撞通用参数 ──
  collidePad: 4, // 虫子碰撞判定收缩量（px）；值越小越容易撞上

  // ── 人物精灵 ──
  character: {
    image: SPRITE_URL,
    sheet: { cols: 5, rows: 3, totalFrames: 15 }, // 3 行 5 列共 15 帧（精灵图 950×1020）
    fps: 8, // 动画帧率
    scale: 0.4, // 渲染缩放（换图后若太大/太小调这里）
    frame: { width: 190, height: 340 }, // 单帧像素（图未加载时的占位尺寸；加载后按图与 cols/rows 自动计算）
    maxHp: 3, // 默认 3 颗心
    verticalSpeed: 220, // 上爬速度 px/s（W/↑）
    descendMul: 0.6, // 短按下行时的下爬速度系数（= verticalSpeed × 0.6，慢速下爬）
    attackSlideMul: 1.8, // 长按下行进入下滑攻击后的速度系数（= verticalSpeed × 1.8，快速俯冲）
    attackHold: 0.2, // 长按下键多少秒后进入「下滑攻击」状态（短按只下爬不攻击）
    // 横向跳跃过场：切树不再是瞬移，而是快速跳跃掠过两树间隙（动作快，但位置连续经过间隙，能接住间隙里的道具）
    jump: {
      durationMs: 200, // 一次跳跃总时长（毫秒，约 0.2s，动作很快）
      height: 70, // 跳跃拱起高度（px，向上），让角色明显“跳”起来掠过间隙
    },
    // 碰撞盒（占整帧的比例，居中于身体）：收紧避免“视觉很远就撞上”
    hitbox: { w: 0.55, h: 0.6 },
    // 动画帧映射：行优先，frame 索引 = 行*cols + 列。第一行 idle，第二行 climb，第三行 slide
    // idle 为单帧（人物不爬时保持静止）；climbUp 正序、climbDown 逆序播放 climb；slide 播放 slide
    anim: {
      idle: [0],
      climb: [5, 6, 7, 8, 9],
      slide: [10, 11, 12, 13, 14],
    },
  },

  // ── 世界 / 树（固定区域，镜头不滚动）──
  // 水平方向被离散为 laneCount 个位置 = 每棵树左/右两侧；共 treeCount*2 个。
  world: {
    treeCount: 3, // 3 棵树
    laneCount: 6, // 横向离散位置数（= treeCount * 2：每棵树左/右两侧）
    sideOffset: 42, // 角色/虫子相对树中心的左右偏移（贴树左/右站）
    startLane: 2, // 开局横向位置（0..laneCount-1）；默认中间树(第2棵)左侧；可改
    trunkWidth: 50, // 树干宽度
    groundHeight: 26, // 底部地面带高度
    topClearance: 20, // 角色头顶距画布顶的最小留白（保证完整可见）
    trunkColor: '#8a5a2b',
  },

  // ── 虫子（从 6 个位置中某一处冒出，沿该位置往上爬；同位置才交互）──
  bugs: {
    spawnIntervalMs: 1000, // 基础生成间隔
    spawnIntervalJitter: 600, // 间隔随机抖动上限
    doubleSpawnChance: 0.2, // 每次刷新额外多刷一只的概率
    speed: 70, // 向上爬速度 px/s（基础）
    speedJitter: 45, // 单只虫子的速度随机抖动上限
    imageScale: 1.5, // 虫子贴图相对碰撞半径的放大倍数（觉得太小就调大，如 1.8）
    // 三种虫子：加班虫 / 熬夜虫（可下滑击落，按种类计分）、热水虫（拍不掉，只能躲）
    // score = 击落得分；touch = 碰到（未攻击）时冒出的吐槽；image = 虫子贴图；desc = 玩法说明里的特点（可自改）
    types: [
      { key: 'jiaban', name: '加班虫', color: '#7bbf6a', radius: 22, killable: true, score: 5, touch: '我想下班~', image: BUG_JB_URL, weight: 0.4,
        desc: '可下滑攻击击落，击落 +5 分' },
      { key: 'yeqian', name: '熬夜虫', color: '#8e7cc3', radius: 22, killable: true, score: 3, touch: '十一点准时开播！', image: BUG_YT_URL, weight: 0.4,
        desc: '可下滑攻击击落，击落 +3 分' },
      { key: 'reshui', name: '热水虫', color: '#9a8c98', radius: 26, killable: false, touch: '水里有味儿~', image: BUG_HOT_URL, weight: 0.2,
        desc: '热水会烫到，只能换位置躲开' },
    ],
  },

  // ── 掉落物品（从两棵树的间隙中间落下，切到相邻 lane 才能接住）──
  items: {
    spawnIntervalMs: 60000, // 基础掉落间隔（毫秒，约 60 秒）
    spawnIntervalJitter: 60000, // 间隔随机抖动 0~60s → 实际每 60~120 秒随机掉一个
    fallSpeed: 90, // 下落速度 px/s
    size: 42, // 掉落物显示/碰撞尺寸 px
    catchReach: 28, // 接取判定额外扩大量（负值传给 AABB，使相邻 lane 也能接到间隙里的道具）
    // 类型与出现比例；effect=shield(限时免伤)/heal(回血)，image=贴图，desc=玩法说明里的功能（可自改）
    types: [
      { key: 'ice', name: '冰块', color: '#7ec8e3', effect: 'heal', heal: 1, image: ICE_URL, weight: 0.1,
        desc: '回血 +1 颗心（约 10% 概率掉落）。' },
      { key: 'bag', name: '钱袋', color: '#d4a017', effect: 'shield', effectValue: 1, durationMs: 10000, image: BAG_URL, weight: 0.9,
        desc: '获得 10 秒护盾，期间免伤 1 次（约 90% 概率掉落）。' },
    ],
  },

  // ── 特效（飘字）──
  fx: {
    floaterMs: 900, // 飘字存活时长（毫秒）
    floaterSpeed: 46, // 飘字上飘速度 px/s
  },

  // ── 存档 / 自动存档 ──
  save: {
    autoSaveIntervalMs: 2000, // 游玩中每隔多久自动存档一次
  },

  // ── 玩法说明（问号悬浮层）──
  help: [
    'WSAD（上下左右）进行移动，长按S（下）可以进行下滑攻击，注意不是所有虫子都可以攻击哦~',
    '天上不定时会掉落物品，提供一些道具~'
  ],
}
