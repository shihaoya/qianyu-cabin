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
    // 飞入过场（仅「新开始」的游戏有；续玩/读档直接进入游戏，不加动画）：
    //   entering: 是否处于「从左侧飞到起点」的过场中（此时不推进物理、不生成管道、不碰撞）
    //   enterT: 过场进度 0→1
    //   birdX: 小鸟当前横坐标（px）；飞入时从屏幕左侧插值到 W*birdXFrac，正常游戏恒为 W*birdXFrac
    entering: false,
    enterT: 0,
    birdX: W * cfg.bird.xFrac,
    // 续玩倒计时（仅「继续上局」有；新局走飞入过场，不倒计时）：
    //   countdown > 0 时处于「3-2-1」倒数，期间不推进物理、不生成管道、不碰撞，
    //   但游戏内容（管道/鸟）可见；到 0 后自动 running=true 正式开始。
    countdown: 0,
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
    base.birdX = W * base.birdXFrac // 续玩无飞入，横坐标直接就位
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

// 进入「飞入过场」：仅新开始的游戏调用。小鸟从屏幕左侧外飞到起点位置，
// 期间不推进物理/管道/碰撞，等玩家点击屏幕才正式开始（见 beginPlay）。
// 续玩（读档）不调用此函数，直接 running，故无飞入。
export function startEnter(state, cfg) {
  const W = cfg.view.width
  const H = cfg.view.height
  state.entering = true
  state.enterT = 0
  state.running = false
  state.gameOver = false
  state.birdY = H * 0.42
  state.vy = 0
  // 起点横坐标：屏幕左侧外（fromXFrac 为负 → 屏外）
  const fromX = (cfg.enter?.fromXFrac ?? -0.15) * W
  state.birdX = fromX
  state._enterFromX = fromX
  state._enterToX = W * state.birdXFrac
}

// 推进飞入过场一帧；进度按配置的 enter.duration（秒）走 easeOutCubic 缓动。
// 到 1 后停在未 running 的待命态，等待玩家点击 beginPlay。
export function stepEnter(state, dt, cfg) {
  if (!state.entering) return
  const dur = Math.max(0.001, cfg.enter?.duration ?? 1.1)
  state.enterT = Math.min(1, state.enterT + dt / dur)
  const t = state.enterT
  const e = 1 - Math.pow(1 - t, 3) // easeOutCubic
  state.birdX = state._enterFromX + (state._enterToX - state._enterFromX) * e
  // 轻微上下浮动，让飞入更有生气
  state.birdY = cfg.view.height * 0.42 + Math.sin(t * Math.PI * 3) * 10
  state.animTime += dt
}

// 玩家点击「飞入中」的屏幕 → 正式开始游戏（结束过场，进入物理循环）
export function beginPlay(state, cfg) {
  if (!state.entering) return
  state.entering = false
  state.enterT = 0
  state.birdX = cfg.view.width * state.birdXFrac
  state.birdY = cfg.view.height * 0.42
  state.vy = 0
  state.running = true
  state.startedAt = Date.now()
}

// 进入「续玩倒计时」：仅「继续上局」调用。小鸟停在存档位置（不飞入、不下落），
// 屏幕显示 3-2-1 倒计时，期间内容可见但不操作；到 0 自动开始游戏。
export function startCountdown(state, cfg) {
  state.entering = false
  state.countdown = Math.max(0, (cfg.countdown && cfg.countdown.duration) || 3)
  state.running = false
  state.gameOver = false
}

// 推进续玩倒计时一帧；到 0 后自动 running=true 正式开始。
// 注意：续玩沿用存档里的 startedAt（历史「开始时间」保持真实），故仅当缺失时才补。
export function stepCountdown(state, dt, cfg) {
  if (state.countdown <= 0) return
  state.countdown = Math.max(0, state.countdown - dt)
  if (state.countdown <= 0) {
    state.countdown = 0
    state.running = true
    if (!state.startedAt) state.startedAt = Date.now()
  }
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

// 当前精灵图帧索引（0..total-1）。anim.fly 是乒乓展开数组，元素值即精灵图帧索引。
function currentFrameIndex(state, cfg) {
  const frames = cfg.character.anim.fly
  return frames[Math.floor(state.animTime * cfg.character.fps) % frames.length]
}

// 像素级碰撞：按角色实际轮廓（精灵图 alpha 掩码）判定，与渲染的旋转/位置完全一致。
// 先算「旋转包围盒」粗判，重叠才逐像素精判；返回 true 表示撞到管道或落地。
function pixelCollides(state, cfg, mask, angle, groundY) {
  const W = cfg.view.width
  const bx = W * state.birdXFrac
  const birdW = cfg.character.frame.width * cfg.character.scale
  const birdH = cfg.character.frame.height * cfg.character.scale
  const pts = mask.points[currentFrameIndex(state, cfg)]
  if (!pts || pts.length === 0) return false
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const halfW = mask.frameW / 2
  const halfH = mask.frameH / 2
  // 把「精灵图原始像素坐标」缩放到「屏幕显示尺寸」：pts 是 0..frameW 的原始像素，
  // 而角色显示宽高 = frame * scale（birdW/birdH），必须乘缩放因子，否则碰撞体会被放大 1/scale 倍。
  const sxScale = birdW / mask.frameW
  const syScale = birdH / mask.frameH
  const pad = cfg.collidePad || 0

  // 旋转后包围盒（粗判，保守地用整帧旋转框）
  const rHW = Math.abs((birdW / 2) * cos) + Math.abs((birdH / 2) * sin)
  const rHH = Math.abs((birdW / 2) * sin) + Math.abs((birdH / 2) * cos)
  const ax = bx - rHW
  const ay = state.birdY - rHH
  const aw = rHW * 2
  const ah = rHH * 2

  // 落地：任一角色像素触地
  if (ay + ah >= groundY) {
    for (let i = 0; i < pts.length; i += 2) {
      const lx = (pts[i] - halfW) * sxScale
      const ly = (pts[i + 1] - halfH) * syScale
      const sy = state.birdY + (lx * sin + ly * cos)
      if (sy >= groundY) return true
    }
  }

  // 管道：仅对包围盒重叠的管道逐像素精判
  for (const p of state.pipes) {
    const pw = p.width ?? cfg.pipes.width
    const top = { x: p.x + pad, y: pad, w: pw - 2 * pad, h: p.gapTop - 2 * pad }
    const bot = { x: p.x + pad, y: p.gapBottom + pad, w: pw - 2 * pad, h: groundY - p.gapBottom - 2 * pad }
    if (!rectsOverlap({ x: ax, y: ay, w: aw, h: ah }, top) && !rectsOverlap({ x: ax, y: ay, w: aw, h: ah }, bot)) continue
    for (let i = 0; i < pts.length; i += 2) {
      const lx = (pts[i] - halfW) * sxScale
      const ly = (pts[i + 1] - halfH) * syScale
      const sx = bx + (lx * cos - ly * sin)
      const sy = state.birdY + (lx * sin + ly * cos)
      if (sx >= top.x && sx <= top.x + top.w && sy >= top.y && sy <= top.y + top.h) return true
      if (sx >= bot.x && sx <= bot.x + bot.w && sy >= bot.y && sy <= bot.y + bot.h) return true
    }
  }
  return false
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
  state.birdX = bx // 正常游戏时横坐标恒为固定点（飞入过场已结束）
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
  const mask = cfg.character.mask
  if (mask) {
    // 像素级碰撞：按角色实际轮廓（精灵图 alpha）判定，和屏幕上显示的角色完全一致
    const angle = state.gameOver
      ? 1.35
      : Math.max(-0.5, Math.min(1.2, state.vy / cfg.bird.flapImpulse) * 0.5)
    if (pixelCollides(state, cfg, mask, angle, groundY)) {
      gameOver(state, events)
      return events
    }
  } else {
    // 回退：矩形碰撞（图未加载 / 无掩码时）。hbW/hbH 在上方已算。
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
