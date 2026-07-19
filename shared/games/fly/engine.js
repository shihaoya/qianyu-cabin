// 像素鸟（Flappy Bird 类）· 纯逻辑引擎（无 DOM / Canvas，PC 与移动端共用同一份）
// 坐标约定：屏幕坐标，y 向下（0 = 顶，H = 底）。鸟固定在 x = view.width * birdXFrac，
// 只上下移动；管道从右侧生成、向左匀速移动。撞管道 / 落地即结束，穿过一对管道 +1 分。
// step() 每帧调用一次；拍翅是「事件」(flap)，不是持续按住，故 input 在本引擎中被忽略。

export const GAME_OVER = 'gameOver'

// 把存档里的单根管道按「当前屏幕」重新夹到合法范围，并重算 gapTop/gapBottom。
// 解决：在高屏生成的存档换到矮屏加载时，gapCenter 越界导致 gapTop > gapBottom（管道变实心）。
function clampPipeToScreen(p, cfg) {
  const H = cfg.view.height
  const groundY = H - cfg.world.groundHeight
  const margin = cfg.pipes.gapMargin
  let gapSize = Number.isFinite(p.gapBottom - p.gapTop) ? p.gapBottom - p.gapTop : NaN
  if (!Number.isFinite(gapSize) || gapSize <= 0) gapSize = cfg.pipes.gapMin ?? cfg.pipes.gap
  gapSize = Math.max(1, Math.min(gapSize, groundY - 2 * margin)) // 不超过可用高度
  let center = Number.isFinite((p.gapTop + p.gapBottom) / 2) ? (p.gapTop + p.gapBottom) / 2 : groundY / 2
  const minC = margin + gapSize / 2
  const maxC = groundY - margin - gapSize / 2
  center = Math.max(minC, Math.min(maxC, center))
  return {
    ...p,
    gapCenter: center,
    gapTop: Math.max(0, center - gapSize / 2),
    gapBottom: Math.min(groundY, center + gapSize / 2),
  }
}

// 新建一局状态；saved 存在时在其基础上恢复（续玩）
export function createInitialState(cfg, saved) {
  const W = cfg.view.width
  const H = cfg.view.height
  const base = {
    birdXFrac: cfg.bird.xFrac,
    birdY: H * 0.42,
    vy: 0,
    pipes: [], // { x, gapTop, gapBottom, scored }（x 为管道左边缘）
    score: 0,
    pipesPassed: 0,
    timeSurvived: 0,
    startedAt: null, // 本局真实开局时间戳（毫秒），用于历史记录展示
    running: false,
    gameOver: false,
    animTime: 0, // 翅膀拍动动画时钟
  }
  if (saved && typeof saved === 'object') {
    base.birdY = Number.isFinite(saved.birdY) ? saved.birdY : H * 0.42
    base.vy = Number.isFinite(saved.vy) ? saved.vy : 0
    base.pipes = Array.isArray(saved.pipes) ? saved.pipes.map((p) => clampPipeToScreen(p, cfg)) : []
    base.score = Number.isFinite(saved.score) ? saved.score : 0
    base.pipesPassed = Number.isFinite(saved.pipesPassed) ? saved.pipesPassed : 0
    base.timeSurvived = Number.isFinite(saved.timeSurvived) ? saved.timeSurvived : 0
    base.startedAt = saved.startedAt || null
    // 兜底：坐标系变了（如换端）导致鸟飞出屏幕，拉回安全区
    base.birdY = Math.max(20, Math.min(H - cfg.world.groundHeight - 20, base.birdY))
  }
  return base
}

// 取出可序列化、平台无关的状态（用于存档 / 跨端续玩）
export function serialize(state) {
  return {
    birdXFrac: state.birdXFrac,
    birdY: state.birdY,
    vy: state.vy,
    pipes: state.pipes.map((p) => ({ ...p })),
    score: state.score,
    pipesPassed: state.pipesPassed,
    timeSurvived: state.timeSurvived,
    startedAt: state.startedAt || null,
  }
}

// 提交给后端的结果元组（后端会再校验并算分）
export function buildResult(state) {
  return {
    score: state.score | 0,
    pipesPassed: state.pipesPassed | 0,
    timeSurvived: Math.round(state.timeSurvived),
    startedAt: state.startedAt || null,
  }
}

// 拍翅：给一个向上的瞬时速度（仅游戏中有效）
export function flap(state, cfg) {
  if (!state.running || state.gameOver) return
  state.vy = -cfg.bird.flapImpulse
}

// AABB 碰撞检测（pad 为负=扩大判定，更容易撞）
function rectsOverlap(a, b, pad = 0) {
  return !(
    a.x + a.w - pad < b.x ||
    a.x + pad > b.x + b.w ||
    a.y + a.h - pad < b.y ||
    a.y + pad > b.y + b.h
  )
}

// 推进一帧；返回事件数组（用于音效 / 结束判定）
export function step(state, dt, _input, cfg) {
  if (!state.running || state.gameOver) return []
  const events = []
  dt = Math.min(dt, 0.05) // 防止切后台后大跳
  state.timeSurvived += dt
  state.animTime += dt

  const W = cfg.view.width
  const H = cfg.view.height
  const bx = W * state.birdXFrac
  const birdW = cfg.character.frame.width * cfg.character.scale
  const birdH = cfg.character.frame.height * cfg.character.scale
  const hb = cfg.bird.hitbox
  const hbW = birdW * hb.w
  const hbH = birdH * hb.h

  // 物理：重力下坠 + 拍翅冲量
  state.vy += cfg.bird.gravity * dt
  if (state.vy > cfg.bird.maxFallVy) state.vy = cfg.bird.maxFallVy
  state.birdY += state.vy * dt

  // 天花板：夹住，不致死（经典手感）
  const topLimit = birdH * 0.5
  if (state.birdY < topLimit) {
    state.birdY = topLimit
    if (state.vy < 0) state.vy = 0
  }

  // 生成管道：首根在右侧屏外；之后每根按「自己的随机间距」决定下一根的出生位置
  const wMax = cfg.pipes.widthMax
  const sp = cfg.pipes.spacing
  if (state.pipes.length === 0) {
    spawnPipe(state, cfg, W + wMax)
  } else {
    const last = state.pipes[state.pipes.length - 1]
    const nextX = last.x + (last.spacing ?? sp)
    if (nextX <= W + wMax) spawnPipe(state, cfg, nextX)
  }

  // 移动 / 计分 / 移除离屏管道（每根管道用各自的宽度）
  for (const p of state.pipes) {
    const pw = p.width ?? cfg.pipes.width
    p.x -= cfg.pipes.speed * dt
    if (!p.scored && p.x + pw < bx) {
      p.scored = true
      state.score += 1
      state.pipesPassed += 1
    }
  }
  while (state.pipes.length && state.pipes[0].x + (state.pipes[0].width ?? cfg.pipes.width) < -8) {
    state.pipes.shift()
  }

  // ── 碰撞 ──
  const groundY = H - cfg.world.groundHeight
  const birdRect = {
    x: bx - hbW / 2,
    y: state.birdY - hbH / 2,
    w: hbW,
    h: hbH,
  }
  // 落地
  if (state.birdY + hbH / 2 >= groundY) {
    state.birdY = groundY - hbH / 2
    gameOver(state, events)
    return events
  }
  // 撞管道
  for (const p of state.pipes) {
    const pw = p.width ?? cfg.pipes.width
    const topRect = { x: p.x, y: 0, w: pw, h: p.gapTop }
    const botRect = { x: p.x, y: p.gapBottom, w: pw, h: groundY - p.gapBottom }
    if (rectsOverlap(birdRect, topRect, cfg.collidePad) || rectsOverlap(birdRect, botRect, cfg.collidePad)) {
      gameOver(state, events)
      return events
    }
  }

  return events
}

function gameOver(state, events) {
  state.gameOver = true
  state.running = false
  events.push({ type: GAME_OVER })
}

export function spawnPipe(state, cfg, x) {
  const H = cfg.view.height
  const groundY = H - cfg.world.groundHeight
  const gMin = cfg.pipes.gapMin ?? cfg.pipes.gap
  const gMax = cfg.pipes.gapMax ?? cfg.pipes.gap
  const maxShift = cfg.pipes.maxGapShift ?? 200

  // 边缘留白：屏幕够高时用配置的 gapMargin；屏幕偏矮时自动收紧，
  // 给缝隙留出「上下移动」的空间——否则缝隙占满整屏、中心无法变化，相邻管道就全一样（不随机）。
  // 目标：即使取最小缝隙 gMin，中心可行区间也至少 >= maxShift（能出现「一个在顶、一个在底」）。
  const margin = Math.max(16, Math.min(cfg.pipes.gapMargin, (groundY - gMin) / 2 - maxShift / 2))

  // 随机缝隙大小：在 [gMin, gMax] 间取值，但不超过「可用高度」(保证完整可见)，
  // 也不超过「可用高度 - maxShift」(保证相邻缝隙中心还能上下移动 maxShift，产生顶/底差异)。
  const usableH = groundY - 2 * margin
  const effGapMax = Math.max(gMin, Math.min(gMax, usableH - maxShift))
  let gap = gMin + Math.random() * Math.max(1, effGapMax - gMin)
  if (gap > usableH) gap = usableH // 极端矮屏兜底：优先保证完整可见

  // 缝隙中心可行区间：以「边缘」为基准留 margin（与 clampPipeToScreen 语义一致）。
  const minC = margin + gap / 2
  const maxC = groundY - margin - gap / 2

  // 缝隙中心：
  //  - 第一根完全随机（鸟在进场过程中有充足时间对准）
  //  - 之后的每根，限制相对「上一根缝隙中心」的最大垂直位移 maxGapShift，
  //    保证鸟在两根管道之间的水平时间内，垂直方向飞得过去（解决“穿过第一根就过不了第二根”）
  let center
  const prev = state.pipes[state.pipes.length - 1]
  if (!prev || !Number.isFinite(prev.gapCenter)) {
    center = minC + Math.random() * Math.max(1, maxC - minC)
  } else {
    const shift = (Math.random() * 2 - 1) * (cfg.pipes.maxGapShift ?? 200)
    center = prev.gapCenter + shift
  }
  center = Math.max(minC, Math.min(maxC, center))

  // 随机粗细：在 [widthMin, widthMax] 间均匀取值（每根独立）
  const wMin = cfg.pipes.widthMin
  const wMax = cfg.pipes.widthMax
  const width = wMin + Math.random() * Math.max(1, wMax - wMin)
  // 随机水平间距：在 [spacingMin, spacingMax] 间均匀取值（每根独立，决定它与下一根的距离）
  const sMin = cfg.pipes.spacingMin
  const sMax = cfg.pipes.spacingMax
  const spacing = sMin + Math.random() * Math.max(1, sMax - sMin)
  state.pipes.push({
    x,
    width,
    spacing,
    gapCenter: center,
    gapTop: Math.max(0, center - gap / 2),
    gapBottom: Math.min(groundY, center + gap / 2),
    scored: false,
  })
}
