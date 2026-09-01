// 打是亲 · 公共配置工厂（所有可调参数集中在此，改这里即可调游戏，无需动逻辑代码）
// 资源由各端通过 assets 注入：assets.faces = { idle, blink, cry, angry, fly }，assets.hand = 手掌图。
// 换皮套：把新图放到 shared/assets/game/slap/ 下，在 config.pc.js / config.mobile.js 改 import 路径即可，逻辑代码不用动。
//
// 玩法（蔷薇与椿式）：按住并「划动」屏幕挥巴掌 —— 往右划 = 从左往右抽，往左划 = 从右往左抽。
// 划得越快越响；连续抽中形成连击（COMBO），连击越高加成越多。纯娱乐，无开始/结束/榜单。
//
// 坐标约定：屏幕坐标，y 向下（0 = 顶，H = 底）。
//   角色脚底在 groundY = H * character.groundFrac；角色显示高度 = H * character.heightFrac。
//   dir = +1：手从左侧飞入、从左往右抽（千羽的头往右偏）；dir = -1：反之。

export function buildSlapConfig(assets, overrides = {}) {
  const cfg = {
    // ── 画布（逻辑像素；实际尺寸由各端 resize 跟随舞台）──
    view: {
      width: 480,
      height: 720,
      background: '#f7f1e3',
    },

    // ── 千羽（被抽的那位）──
    character: {
      images: assets.faces, // 5 张表情图（同名 key）
      xFrac: 0.5, // 角色中心横坐标占屏宽比例（居中，方便左右开弓）
      groundFrac: 0.84, // 脚底所在高度占屏高比例
      heightFrac: 0.69, // 角色显示高度占屏高比例（原始 0.46 放大 1.5 倍）
      pivotFrac: 0.62, // 旋转轴心在角色高度上的比例（0=脚，1=头顶）；挨打时绕此处旋转
    },

    // ── 巴掌（手）：实时跟随指针，划过脸的中线即打中一记 ──
    hand: {
      image: assets.hand, // 掌心朝左的右手掌；往右挥时水平翻转复用
      heightFrac: 0.3, // 手掌显示高度占屏高比例
      hitYFrac: 0.66, // 脸的高度（自脚底往上，占角色高度比例）
      hitRangeY: 0.17, // 高度容差（占屏高）：手离脸太高/太低就够不着，打空
      rearmPx: 40, // 打中后须把手移开脸中线这么远才能再打下一记（防原地抖动刷连击；调小更易连抽）
      follow: 0.45, // 速度平滑系数（0..1，越大越跟手、力度越贴近瞬时速度）
      maxTilt: 0.5, // 挥动时手掌的最大倾斜（弧度），速度越快越斜
    },

    // ── 划动输入：速度决定力度 ──
    swipe: {
      minSpeed: 30, // 低于此速度（px/s）视为「几乎没动」，不算一巴掌
      maxSpeed: 50000, // 达到此速度即满力
      minPower: 12, // 刚过门槛时保底的力度
      dirDeadZone: 50, // 横向速度低于此值时不翻转手掌朝向，避免停下时左右抽搐
      keyPower: 72, // 用键盘方向键抽时的固定力度
    },

    // ── 连击 → 表情状态（持续状态）：「她现在有多惨」──
    // 连击是状态的唯一驱动：连得越高她越惨。区间表升序排列，连击 >= min 即切到该表情：
    //   0~9 微笑(blink) → 10~99 强颜欢笑(idle) → 100~199 生气(angry)
    //   → 200~399 哭哭(cry) → 400+ 被打飞(fly)
    mood: {
      comboFaces: [
        { min: 0, face: 'blink' },
        { min: 10, face: 'idle' },
        { min: 100, face: 'angry' },
        { min: 200, face: 'cry' },
        { min: 400, face: 'fly' },
      ],
      displayMax: 99999, // 连击显示上限（内部也封顶，不再往上累积）
    },

    // ── 连击 ──
    combo: {
      windowMs: 1000, // 距上一记超过此时长则开始回落
      decayMs: 600, // 开始回落后，每隔多久降一级（停手了她慢慢缓过来）
      cooldownMs: 8000, // 停手这么久 → 彻底冷却：累计清零、连击归零，她完全缓过来
      maxLevel: 8, // 加成上限级数
      bonusPerLevel: 0.12, // 每级连击的加成比例
      displayAt: 2, // 连击达到几级才在画面上显示
    },

    // ── 节奏加成（鼓励左右开弓）──
    // 注：判定要求「划过脸的中线」，而划过中线后手必然到了另一侧，下一记只能反向划回，
    // 故连抽天然就是左右交替；慢慢抽（每下都断连击）则永远拿不到这个加成。
    rhythm: {
      alternateMul: 1.5, // 连上（方向与上一记相反）时的得分倍率
      flyBonus: 50, // 打飞的额外加分
    },

    // ── 受击表现（纯视觉，不阻塞下一记：手有多快就能抽多快）──
    hit: {
      durationMs: 380, // 受击动画时长（甩头/晃动）
      flyDurationMs: 900, // 「被打飞」动画时长（力度足够大时）
      shakeMs: 220, // 屏幕震动时长
      shakeAmp: 9, // 屏幕震动幅度（px）
      shakeFreq: 34, // 甩头频率（rad/s）
      tiltRad: 0.34, // 甩头最大角度（弧度）
      shiftPx: 15, // 甩头最大横向位移（px）
      flyDxFrac: 0.34, // 被打飞：横向位移占屏宽比例
      flyArcFrac: 0.22, // 被打飞：抛物线最高点占屏高比例
    },

    // ── 打击强度（瞬时演出，由单记力度决定；与情绪阶段互不干扰）──
    // 打飞是最高优先级演出，任何时候都能触发并盖住当前情绪阶段，演完回到该阶段。
    faces: {
      flyAt: 80, // 力度 >= 此值 → 播放「被打飞」演出（用 fly 图）
    },

    // ── 特效 ──
    fx: {
      floaterMs: 900, // 飘字寿命
      floaterSpeed: 46, // 飘字上飘速度（px/s）
      floaterSize: 34, // 飘字字号（「+力度 ×连击」）
      starMs: 700, // 星星寿命
      starCount: 6, // 力度满时的星星数
      starRadius: 36, // 星星绕头旋转的半径（px）
      starSpin: 3.2, // 星星公转角速度
      comboMs: 900, // 连击数字的停留时长
      flashMs: 130, // 命中瞬间手掌放大 + 冲击线的时长
      forceColor: '#e0852a', // 每次抽打飘出的「本次力度」（0~999 纯装饰）颜色
    },

    // ── 调试可视化 ──
    debug: {
      showHitbox: false, // 画出角色/手的包围盒（红框）
    },

    // ── 玩法说明 ──
    help: [
      '手掌跟着鼠标/手指走，划过千羽的脸就是一巴掌：往右划从左抽，往左划从右抽。',
      '每次抽打旁边都会飘出这一下的「力度」（0~999），纯装饰，跟得分无关。',
      '连击越高她越惨：0~9 微笑 → 10~99 强颜欢笑 → 100~199 生气 → 200~399 哭哭 → 400+ 被打飞。',
      '停手一会儿连击回落，她会慢慢缓过来；彻底停手后完全恢复。键盘 ← → 也能抽。',
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
