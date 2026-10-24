// 千羽画圈圈 · 纯逻辑引擎（无 DOM / Canvas，PC 与移动端共用同一份）
// 坐标约定：角度制圆环。angle ∈ [0, 2π)，0 = 圆心右侧，π/2 = 正下方（y 向下屏幕坐标）。
// 人物顺时针跑（角速度为负），怪物逆时针定速循环（角速度为正），二者相对位置固定 = 恒可跳过。
// 人物跑过的地方涂色（区间合并），涂满 2π 获胜；碰到怪物失败。
// 新开局有「下落过场」：千羽从屏幕中央竖直落到圆环正下方，期间怪物静止，落地才开始。
// step() 每帧调用一次；跳跃是「事件」(jump)，不是持续按住。
//
// 状态（存档）形状（平台无关 JSON，随 HTTP 存/读，跨端续玩）：
//   标量：{ phase, angle, jumpTimer, dropTimer, paintedTotal, timeSurvived, startedAt,
//           monsterCount, monsterSpeed, runSpeed }
//   动态数组：painted[]（已合并的涂色区间 [[a,b],...]）、monsters[]（{ angle, typeKey, wobble }）
//   phase: 'ready' | 'dropping' | 'playing' | 'dead' | 'won'

export const GAME_OVER = 'gameOver'

const TAU = Math.PI * 2

function normAngle(a) {
  a = a % TAU
  if (a < 0) a += TAU
  return a
}

// 把 [a1,a2]（a1<a2，长度<2π）并入涂色区间，并重新合并（跨 0 点拆成两段）
function paintArc(painted, a1, a2) {
  const na1 = normAngle(a1)
  const na2 = normAngle(a2)
  if (a2 - a1 >= TAU) {
    painted.splice(0, painted.length, [0, TAU])
    return TAU
  }
  if (na1 < na2) {
    painted.push([na1, na2])
  } else {
    painted.push([na1, TAU], [0, na2])
  }
  painted.sort((x, y) => x[0] - y[0])
  const merged = []
  for (const seg of painted) {
    const last = merged[merged.length - 1]
    if (last && seg[0] <= last[1] + 1e-6) {
      last[1] = Math.max(last[1], seg[1])
    } else {
      merged.push([seg[0], seg[1]])
    }
  }
  painted.splice(0, painted.length, ...merged)
  let total = 0
  for (const seg of painted) total += seg[1] - seg[0]
  return Math.min(total, TAU)
}

// 新建一局状态；saved 存在时在其基础上恢复（续玩）
// difficulty = { monsterCount, monsterSpeed, runSpeed }（续玩时忽略，沿用 saved 里的配置）
export function createInitialState(cfg, saved, difficulty) {
  const diff = difficulty || cfg.difficulty
  const base = {
    phase: 'ready', // ready | dropping | playing | dead | won
    angle: Math.PI / 2, // 圆环正下方
    jumpTimer: 0,
    dropTimer: 0,
    painted: [], // 已合并的涂色区间 [[a,b],...]，0<=a<b<=TAU
    paintedTotal: 0,
    monsters: [],
    timeSurvived: 0,
    startedAt: null, // 本局真实开局时间戳（毫秒），用于历史记录展示
    monsterCount: diff.monsterCount,
    monsterSpeed: diff.monsterSpeed,
    runSpeed: diff.runSpeed,
  }
  spawnMonsters(base)
  if (saved && typeof saved === 'object') {
    base.phase = saved.phase === 'playing' || saved.phase === 'dropping' ? 'playing' : saved.phase || 'ready'
    base.angle = Number.isFinite(saved.angle) ? saved.angle : Math.PI / 2
    base.jumpTimer = Number.isFinite(saved.jumpTimer) ? saved.jumpTimer : 0
    base.paintedTotal = Number.isFinite(saved.paintedTotal) ? saved.paintedTotal : 0
    base.painted = Array.isArray(saved.painted)
      ? saved.painted
          .filter((s) => Array.isArray(s) && s.length === 2 && s.every((v) => Number.isFinite(v)))
          .map((s) => [s[0], s[1]])
      : []
    base.monsters = Array.isArray(saved.monsters) && saved.monsters.length
      ? saved.monsters
          .filter((m) => m && Number.isFinite(m.angle))
          .map((m, i) => ({
            angle: normAngle(m.angle),
            typeKey: typeof m.typeKey === 'string' ? m.typeKey : (cfg.monsters.types[i % cfg.monsters.types.length].key),
            wobble: Number.isFinite(m.wobble) ? m.wobble : 0,
          }))
      : []
    if (!base.monsters.length) spawnMonsters(base)
    base.timeSurvived = Number.isFinite(saved.timeSurvived) ? saved.timeSurvived : 0
    base.startedAt = saved.startedAt || null
    base.monsterCount = Number.isFinite(saved.monsterCount) ? saved.monsterCount : diff.monsterCount
    base.monsterSpeed = Number.isFinite(saved.monsterSpeed) ? saved.monsterSpeed : diff.monsterSpeed
    base.runSpeed = Number.isFinite(saved.runSpeed) ? saved.runSpeed : diff.runSpeed
    // 续玩不重新下落，直接进入游戏
    if (base.phase === 'dropping') base.phase = 'playing'
  }
  return base
}

function spawnMonsters(state) {
  state.monsters = []
  for (let i = 0; i < state.monsterCount; i++) {
    state.monsters.push({
      angle: (i / state.monsterCount) * TAU + 0.6, // 均匀分布，错开起点
      typeKey: null, // 由 render 层按索引取 types[i % len]
      wobble: Math.random() * TAU,
    })
  }
}

// 取出可序列化、平台无关的状态（用于存档 / 跨端续玩）
export function serialize(state) {
  return {
    phase: state.phase,
    angle: state.angle,
    jumpTimer: state.jumpTimer,
    paintedTotal: state.paintedTotal,
    painted: state.painted.map((s) => [s[0], s[1]]),
    monsters: state.monsters.map((m) => ({ angle: m.angle, typeKey: m.typeKey, wobble: m.wobble })),
    timeSurvived: state.timeSurvived,
    startedAt: state.startedAt || null,
    monsterCount: state.monsterCount,
    monsterSpeed: state.monsterSpeed,
    runSpeed: state.runSpeed,
  }
}

// 提交给后端的结果元组（后端会再校验并算分）
export function buildResult(state) {
  const paintPercent = Math.floor((state.paintedTotal / TAU) * 100)
  return {
    score: paintPercent,
    paintPercent,
    timeSurvived: Math.round(state.timeSurvived),
    monsterCount: state.monsterCount | 0,
    monsterSpeed: state.monsterSpeed,
    runSpeed: state.runSpeed,
    won: state.phase === 'won',
    startedAt: state.startedAt || null,
  }
}

// 进入「下落过场」：仅新开始的游戏调用。千羽从屏幕中央竖直落到圆环正下方，
// 期间怪物静止不碰撞，落地后 phase='playing' 正式开始。
// 续玩（读档）不调用此函数，直接 playing。
export function startDrop(state, cfg) {
  state.phase = 'dropping'
  state.dropTimer = cfg.drop.duration
  state.angle = Math.PI / 2
  state.jumpTimer = 0
  state.startedAt = Date.now()
}

// 跳跃：仅游戏中且未滞空时有效（dropping 阶段按跳跃无反应）
export function jump(state) {
  if (state.phase !== 'playing' || state.jumpTimer > 0) return
  state.jumpTimer = state._jumpTime || 0.42
}

// 检查是否胜利（涂满整圈），用于游戏循环中每帧判定
export function checkWin(state) {
  return state.paintedTotal >= TAU - 1e-4
}

// 主循环：每帧调用一次，返回事件数组（如 [GAME_OVER] / ['won']）
export function step(state, dt, input, cfg) {
  const events = []
  dt = Math.min(dt, 0.05)
  // 缓存配置，供 jump() 等事件函数读取（避免每次都传 cfg）
  state._jumpTime = cfg.character.jumpTime

  // 下落过场：千羽从屏幕中心竖直落下，怪物静止
  if (state.phase === 'dropping') {
    state.dropTimer -= dt
    if (state.dropTimer <= 0) {
      state.phase = 'playing'
      state.dropTimer = 0
    }
    return events
  }

  if (state.phase !== 'playing') return events

  state.timeSurvived += dt

  const prevAngle = state.angle
  const runSpeed = -(cfg.speed.base * state.runSpeed) // 顺时针（负角速度）
  state.angle += runSpeed * dt

  const airborne = state.jumpTimer > 0
  if (airborne) state.jumpTimer -= dt

  // 落地状态才涂色（paintArc 内部把角度归一化到 [0, TAU)）
  if (!airborne) {
    state.paintedTotal = paintArc(state.painted, state.angle, prevAngle)
  }

  // 怪物移动（与人物反向，定速循环）
  const monsterSpeed = cfg.speed.monsterBase * state.monsterSpeed
  for (const m of state.monsters) {
    m.angle = normAngle(m.angle + monsterSpeed * dt)
    m.wobble += dt * 6
  }

  // 碰撞（滞空时无敌；用屏幕坐标直线距离判定，比弧长更贴近视觉）
  if (!airborne) {
    const R = Math.min(cfg.view.width, cfg.view.height) * cfg.ring.radiusFrac
    const px = cfg.view.width / 2 + Math.cos(state.angle) * R
    const py = cfg.view.height / 2 + Math.sin(state.angle) * R
    const hit2 = cfg.monsters.hitDist * cfg.monsters.hitDist
    for (const m of state.monsters) {
      const mx = cfg.view.width / 2 + Math.cos(m.angle) * R
      const my = cfg.view.height / 2 + Math.sin(m.angle) * R
      const dx = px - mx
      const dy = py - my
      if (dx * dx + dy * dy < hit2) {
        state.phase = 'dead'
        events.push(GAME_OVER)
        return events
      }
    }
  }

  // 胜利判定移除：改由 PC/移动端游戏循环在渲染前调用 checkWin() 判定，
  // 避免在 step() 里直接改 phase 导致"刚落地涂了一点就瞬间胜利"的时序 bug。

  return events
}