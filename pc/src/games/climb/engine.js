// 千羽爬树 · 纯逻辑引擎（无 DOM / Canvas，PC 与移动端共用同一份，仅输入层不同）
// 坐标约定（与渲染保持一致）：世界 y 以「地面」为 0 向上为正；水平为离散 lane（0..laneCount-1）。
// 角色在固定区域内上下连续爬、左右离散换 lane（不无限上爬，镜头固定不滚动）。
// step() 每帧调用一次，input = { up, down, attack }（左右移动由 moveLane 在按下边沿触发）。
//   下滑攻击：长按下键（或拍击键 attack）0.2 秒后进入攻击态，角色快速俯冲下滑并击落同 lane 的可击落虫子；
//   短按下行只是较慢下爬。不攻击碰到虫子则扣血；硬壳虫不可击落，只能换位置躲开。

export const GAME_OVER = 'gameOver'

// 第 i 棵树中心的 x（与渲染 treeX 保持一致）
export function treeCenterX(i, cfg) {
  const n = cfg.world.treeCount
  return (cfg.view.width * (i + 1)) / (n + 1)
}

// 横向离散位置总数
export function laneCount(cfg) {
  return cfg.world.laneCount ?? cfg.world.treeCount * 2
}

// 第 lane 个横向位置的屏幕 x（某棵树的左/右侧）
export function laneX(lane, cfg) {
  const treeIndex = Math.floor(lane / 2)
  const side = lane % 2 === 0 ? -1 : 1
  return treeCenterX(treeIndex, cfg) + side * cfg.world.sideOffset
}

// 角色所在 lane 对应的树索引
export function laneTreeIndex(lane) {
  return Math.floor(lane / 2)
}

// 角色当前屏幕 x：跳跃过场中沿两树之间做插值（连续经过间隙），否则取所在 lane 的 x
// 这是“跳过去”而不是“闪过去”的关键——跳跃中位置连续变化，碰撞盒会扫过间隙，从而能接到落下的道具
export function charScreenX(state, cfg) {
  const j = state.jump
  if (j && j.active) {
    const e = smoothstep(j.t)
    return laneX(j.fromLane, cfg) + (laneX(j.toLane, cfg) - laneX(j.fromLane, cfg)) * e
  }
  return laneX(state.lane, cfg)
}

// 跳跃拱起高度（世界坐标，向上为正）：让角色“跳”起来掠过两树间隙
export function charJumpArc(state, cfg) {
  const j = state.jump
  if (j && j.active) {
    return Math.sin(Math.PI * Math.max(0, Math.min(1, j.t))) * cfg.character.jump.height
  }
  return 0
}

function smoothstep(t) {
  t = Math.max(0, Math.min(1, t))
  return t * t * (3 - 2 * t)
}

// AABB 碰撞检测（pad 为正=收缩，为负=扩大判定）
function rectsOverlap(a, b, pad = 0) {
  return !(
    a.x + a.w - pad < b.x ||
    a.x + pad > b.x + b.w ||
    a.y + a.h - pad < b.y ||
    a.y + pad > b.y + b.h
  )
}

// 新建一局状态；saved 存在时在其基础上恢复（续玩）
export function createInitialState(cfg, saved) {
  const lanes = laneCount(cfg)
  const base = {
    lane: cfg.world.startLane != null ? cfg.world.startLane : Math.floor(lanes / 2),
    h: cfg.view.height * 0.5,
    hp: cfg.character.maxHp,
    score: 0,
    bugsKilled: 0,
    timeSurvived: 0,
    startedAt: null, // 本局真实开局时间戳（毫秒）；用于历史记录展示“开始时间”，不影响玩法
    shieldRemainingMs: 0,
    shieldCount: 0,
    running: false,
    gameOver: false,
    attacking: false,
    sHeld: false,
    sHoldTimer: 0,
    anim: 'idle',
    animTime: 0,
    hitFlash: 0,
    jump: { active: false, fromLane: cfg.world.startLane != null ? cfg.world.startLane : Math.floor(lanes / 2), toLane: cfg.world.startLane != null ? cfg.world.startLane : Math.floor(lanes / 2), t: 0, dur: 200 },
    floaters: [], // 临时飘字（击落/扣血/接道具等提示），不进存档
    bugSpawnTimer: cfg.bugs.spawnIntervalMs,
    itemSpawnTimer: cfg.items.spawnIntervalMs,
    bugs: [],
    items: [],
    nextId: 1,
  }
  if (saved && typeof saved === 'object') {
    Object.assign(base, saved)
    base.running = false
    base.gameOver = false
    base.attacking = false
    base.sHeld = false
    base.sHoldTimer = 0
    base.bugs = []
    base.items = []
    base.jump = { active: false, fromLane: base.lane, toLane: base.lane, t: 0, dur: 200 }
  }
  return base
}

// 取出可序列化、平台无关的状态（用于存档 / 跨端续玩）
export function serialize(state) {
  return {
    lane: state.lane,
    h: state.h,
    hp: state.hp,
    score: state.score,
    bugsKilled: state.bugsKilled,
    timeSurvived: state.timeSurvived,
    shieldRemainingMs: state.shieldRemainingMs,
    startedAt: state.startedAt || null, // 随存档保留，跨端续玩仍记得原始开局时间
  }
}

// 提交给后端的结果元组（后端会再校验并算分）
export function buildResult(state) {
  return {
    score: state.score,
    bugsKilled: state.bugsKilled,
    timeSurvived: Math.round(state.timeSurvived),
    hpLeft: state.hp,
    startedAt: state.startedAt || null, // 开局时间戳（毫秒），供历史记录展示；结束时间以服务端 finishedAt 为准
  }
}

// 在按下边沿触发一次：左右“跳”一格（dir = -1 左 / +1 右）。
// 不再瞬间闪到目标 lane，而是发起一次快速跳跃过场（弧线掠过两树间隙）。
export function moveLane(state, dir, cfg) {
  const lanes = laneCount(cfg)
  if (state.jump.active) return // 跳跃过场中不接受新的横向移动（连续按键忽略，跳完再响应）
  const target = Math.max(0, Math.min(lanes - 1, (state.lane | 0) + dir))
  if (target === state.lane) return // 已在边缘，无需跳
  state.jump = {
    active: true,
    fromLane: state.lane,
    toLane: target,
    t: 0,
    dur: cfg.character.jump.durationMs,
  }
}

// 虫子从 6 个横向位置中某一处冒出，沿该位置往上爬（y 增大=上爬）
function spawnBug(state, cfg) {
  const t = weightedPick(cfg.bugs.types)
  const lanes = laneCount(cfg)
  state.bugs.push({
    id: state.nextId++,
    lane: Math.floor(Math.random() * lanes),
    type: t.key,
    killable: t.killable,
    color: t.color,
    radius: t.radius,
    y: -20 - Math.random() * 60,
    speedJitter: Math.random() * cfg.bugs.speedJitter,
  })
}

// 相邻两树之间的间隙中心 x（道具从这里落下，靠切到相邻 lane 接住）
function gapCenterX(i, cfg) {
  const right = laneX(2 * i + 1, cfg) // 第 i 棵树右侧
  const left = laneX(2 * i + 2, cfg) // 第 i+1 棵树左侧
  return (right + left) / 2
}
function gapWidth(i, cfg) {
  return laneX(2 * i + 2, cfg) - laneX(2 * i + 1, cfg)
}

// 道具从「两棵树的间隙」中间落下（A|B|C 的 A-B 或 B-C 之间），切到相邻 lane 才能接住
function spawnItem(state, cfg) {
  const t = weightedPick(cfg.items.types)
  const n = cfg.world.treeCount
  const gapIndex = Math.floor(Math.random() * Math.max(1, n - 1))
  const cx = gapCenterX(gapIndex, cfg)
  const half = Math.max(0, gapWidth(gapIndex, cfg) * 0.3)
  const x = cx + (Math.random() * 2 - 1) * half
  state.items.push({
    id: state.nextId++,
    type: t.key,
    color: t.color,
    name: t.name,
    gap: gapIndex,
    x,
    y: cfg.view.height + cfg.items.size / 2 + Math.random() * 40,
  })
}

function weightedPick(arr) {
  const total = arr.reduce((s, x) => s + x.weight, 0)
  let r = Math.random() * total
  for (const x of arr) {
    if ((r -= x.weight) <= 0) return x
  }
  return arr[arr.length - 1]
}

// 在世界坐标 (x = 屏幕 x, yWorld = 世界高) 处弹出一条飘字（屏幕 y = H - yWorld）
function spawnFloater(state, cfg, x, yWorld, text, color, big) {
  state.floaters.push({
    x,
    y: cfg.view.height - yWorld,
    vy: -cfg.fx.floaterSpeed,
    life: cfg.fx.floaterMs,
    maxLife: cfg.fx.floaterMs,
    text,
    color,
    size: big ? 18 : 15,
  })
}

// 计分（前后端共用同一公式，保证一致；始终为数值，绝不拼接）
export function computeScore(s) {
  const kill = (s.bugsKilled | 0) * 10
  const time = Math.floor((s.timeSurvived || 0) / 2)
  return kill + time
}

// 推进一帧；返回事件数组（用于音效/特效，可忽略）
export function step(state, dt, input, cfg) {
  if (!state.running || state.gameOver) return []
  const events = []
  dt = Math.min(dt, 0.05) // 防止切后台后大跳
  state.timeSurvived += dt

  // 横向跳跃过场：快速但连续地“跳”过两树间隙（弧线），过程中位置连续变化，能接住间隙里的道具
  if (state.jump.active) {
    state.jump.t += (dt * 1000) / Math.max(1, state.jump.dur)
    if (state.jump.t >= 1) {
      state.lane = state.jump.toLane
      state.jump.active = false
      state.jump.t = 0
    }
  }

  // 下滑攻击：长按下键（或拍击键）0.2s 后进入攻击态；松开即退出
  const sHeld = !!(input.down || input.attack)
  state.sHeld = sHeld
  if (sHeld) {
    state.sHoldTimer += dt
    if (state.sHoldTimer >= cfg.character.attackHold) state.attacking = true
  } else {
    state.sHoldTimer = 0
    state.attacking = false
  }

  // 上下连续沿树攀爬（左右为离散 lane，由 moveLane 在按下边沿处理）
  const sp = cfg.character.verticalSpeed
  if (input.up) state.h += sp * dt
  if (sHeld) {
    // 短按下行=较慢下爬；长按超过阈值=下滑攻击快速俯冲
    const vy = state.attacking ? sp * cfg.character.attackSlideMul : sp * cfg.character.descendMul
    state.h -= vy * dt
  }

  // 限制在固定区域内：角色完整可见，绝不超出屏幕（顶部留白、底部贴近地面）
  const charH = cfg.character.frame.height * cfg.character.scale
  const minY = cfg.world.groundHeight + 4
  const maxY = cfg.view.height - charH - cfg.world.topClearance
  state.h = Math.max(minY, Math.min(maxY, state.h))

  if (state.shieldRemainingMs > 0)
    state.shieldRemainingMs = Math.max(0, state.shieldRemainingMs - dt * 1000)
  if (state.hitFlash > 0) state.hitFlash = Math.max(0, state.hitFlash - dt)

  // 动画状态：不爬=静止(idle)；上爬=正序(climbUp)；下爬=逆序(climbDown)；下滑攻击=slide
  // 仅“在动”时推进动画时钟，idle 时冻结在单帧，保持人物不动
  if (state.attacking) state.anim = 'slide'
  else if (input.up) state.anim = 'climbUp'
  else if (sHeld) state.anim = 'climbDown'
  else state.anim = 'idle'
  if (state.anim !== 'idle') state.animTime += dt

  // 生成虫子（基础间隔 + 抖动；20% 概率额外多刷一只）
  state.bugSpawnTimer -= dt * 1000
  if (state.bugSpawnTimer <= 0) {
    spawnBug(state, cfg)
    if (Math.random() < cfg.bugs.doubleSpawnChance) spawnBug(state, cfg)
    state.bugSpawnTimer = cfg.bugs.spawnIntervalMs + Math.random() * cfg.bugs.spawnIntervalJitter
  }
  // 生成道具（落在两树间隙，间隔较长）
  state.itemSpawnTimer -= dt * 1000
  if (state.itemSpawnTimer <= 0) {
    spawnItem(state, cfg)
    state.itemSpawnTimer = cfg.items.spawnIntervalMs + Math.random() * cfg.items.spawnIntervalJitter
  }

  // 角色碰撞盒：贴在精灵“身体中部”，与画面里角色的实际位置对齐
  // 精灵脚在世界 y = state.h（向上为正），向上 charH 才是头顶，故身体中心世界 y = state.h + charH/2
  const charW = cfg.character.frame.width * cfg.character.scale
  const hb = cfg.character.hitbox
  const hbW = charW * hb.w
  const hbH = charH * hb.h
  const cxBody = charScreenX(state, cfg)
  const bodyCenterY = state.h + charH * 0.5 // 身体中心世界 y（脚在 state.h）
  const charRect = {
    x: cxBody - hbW / 2,
    y: bodyCenterY - hbH / 2,
    w: hbW,
    h: hbH,
  }

  const H = cfg.view.height
  const pad = cfg.collidePad

  // 更新虫子（同 lane 才会在水平方向重叠 → 只有同一侧才会碰撞）
  for (let i = state.bugs.length - 1; i >= 0; i--) {
    const bug = state.bugs[i]
    bug.y += (cfg.bugs.speed + bug.speedJitter) * dt
    const r = bug.radius
    const bugRect = { x: laneX(bug.lane, cfg) - r, y: bug.y - r, w: r * 2, h: r * 2 }
    if (rectsOverlap(charRect, bugRect, pad)) {
      // 可击落且正在下滑攻击 → 击落得分
      if (bug.killable && state.attacking) {
        state.bugs.splice(i, 1)
        state.bugsKilled += 1
        spawnFloater(state, cfg, laneX(bug.lane, cfg), bug.y, '击落 +10', '#3f8f3a', true)
        events.push({ type: 'kill', bug })
        continue
      }
      // 否则（不可击落 / 未攻击）→ 护盾优先抵挡，否则扣血
      if (state.shieldRemainingMs > 0 && state.shieldCount > 0) {
        state.shieldCount -= 1
        if (state.shieldCount <= 0) state.shieldRemainingMs = 0
        state.bugs.splice(i, 1)
        spawnFloater(state, cfg, laneX(bug.lane, cfg), bug.y, '护盾抵挡!', '#3f7cac', false)
        events.push({ type: 'shieldBlock', bug })
      } else {
        state.hp -= 1
        state.hitFlash = 0.35
        state.attacking = false
        state.bugs.splice(i, 1)
        spawnFloater(state, cfg, cxBody, state.h + charH * 0.5, '-1 ♥', '#e74c3c', true)
        events.push({ type: 'damage', bug })
        if (state.hp <= 0) {
          state.gameOver = true
          events.push({ type: GAME_OVER })
          break
        }
        continue
      }
      continue
    }
    if (bug.y - r > H + 20) state.bugs.splice(i, 1) // 爬出顶部
  }

  // 更新道具（从两树间隙落下，靠切到相邻 lane 接住；用扩大判定保证相邻位置能接到）
  for (let i = state.items.length - 1; i >= 0; i--) {
    const item = state.items[i]
    item.y -= cfg.items.fallSpeed * dt
    const isz = cfg.items.size
    const itemRect = { x: item.x - isz / 2, y: item.y - isz / 2, w: isz, h: isz }
    if (rectsOverlap(charRect, itemRect, -cfg.items.catchReach)) {
      if (item.type === 'shield') {
        const def = cfg.items.types.find((t) => t.key === 'shield')
        state.shieldCount = def ? def.effectValue : 1
        state.shieldRemainingMs = def ? def.durationMs : 10000
        spawnFloater(state, cfg, item.x, item.y, '护盾!', '#3f7cac', false)
      } else if (item.type === 'heal') {
        const def = cfg.items.types.find((t) => t.key === 'heal')
        state.hp = Math.min(cfg.character.maxHp, state.hp + (def ? def.heal : 1))
        spawnFloater(state, cfg, item.x, item.y, '+1 ♥', '#c9743b', false)
      }
      events.push({ type: 'item', item })
      state.items.splice(i, 1)
      continue
    }
    if (item.y < -isz) state.items.splice(i, 1) // 落出底部
  }

  // 飘字：向上漂移并淡出
  for (let i = state.floaters.length - 1; i >= 0; i--) {
    const f = state.floaters[i]
    f.life -= dt * 1000
    f.y += f.vy * dt
    if (f.life <= 0) state.floaters.splice(i, 1)
  }

  // 统一重算得分（数值，绝不拼接）
  state.score = computeScore(state)

  return events
}
