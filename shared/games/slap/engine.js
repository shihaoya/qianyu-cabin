// 打是亲 · 纯逻辑引擎（无 DOM / Canvas，PC 与移动端共用同一份，仅输入层不同）
//
// 玩法（蔷薇与椿式）：手掌**实时跟着光标/手指**走，划过千羽的脸就是一巴掌。
//   往右划过 → 从左往右抽；往左划过 → 从右往左抽。来回划 = 左右开弓连抽。
//   划得越快打得越响；连续抽中攒连击（COMBO），连击越高加成越多。
// 纯娱乐：没有开始/结束/血量，也不上报成绩，进去就能抽，刷新即重来。
//
// ── 两个正交维度（这是本作的核心设计）──
//   【连击状态】持续状态，回答「她现在有多惨」→ 决定显示哪张表情图。
//     连击是唯一驱动：0~9 微笑(blink) → 10~99 强颜欢笑(idle) → 100~199 生气(angry)
//     → 200~399 哭哭(cry) → 400+ 被打飞(fly)。连击显示上限 cfg.mood.displayMax（99999）。
//     停手超过窗口连击逐级回落；彻底冷却（停手 cooldownMs）后归零，完全缓过来。
//   【打击强度】瞬时演出，回答「这一下打得有多响」→ 决定甩头幅度 / 是否打飞。
//     打飞（力度 >= faces.flyAt）是最高优先级演出，盖住当前连击状态，演完回到该状态。
//   【力度飘字】每次抽打旁边飘出本次「力度」（0~999，纯装饰），与得分/连击/状态无关。
//
//   三者互不干扰，因此「越用力却越看不到强反馈」的问题不复存在。

// ── 连击 → 表情状态（连击是状态的唯一驱动）──
export function faceForCombo(combo, cfg) {
  const stages = cfg.mood.comboFaces // [{ min, face }] 升序，连击 >= min 即切到该表情
  let face = stages.length ? stages[0].face : 'blink'
  for (const s of stages) if (combo >= s.min) face = s.face
  return face
}

// ── 新建一局状态（本游戏无存档/续玩，每次挂载都是全新状态）──
export function createInitialState(cfg) {
  return {
    clock: 0, // 内部时钟（秒），用于连击窗口判定

    // ── 统计（仅本地展示，不上传）──
    slaps: 0, // 本轮累计挨打数（纯统计）
    totalPower: 0, // 累计力度（含各类加成，浮点）
    totalInt: 0, // 取整后的展示值
    combo: 0, // 当前连击级数
    maxCombo: 0, // 本轮最高连击
    flyCount: 0, // 打飞次数

    // ── 计时 ──
    sinceSlapMs: 99999, // 距上一记过了多少毫秒
    decayAcc: 0, // 连击回落的累计时间

    // ── 手掌（实时跟随输入）──
    hand: {
      on: false, // 指针是否在画面上（决定手掌显隐）
      fade: 0, // 淡入淡出 0..1
      x: 0, // 当前位置（画布 CSS px）
      y: 0,
      prevX: 0, // 上一帧位置，用于算速度
      prevY: 0,
      hasPrev: false,
      vx: 0, // 平滑后的横向速度（px/s，带正负）
      vy: 0,
      dir: 1, // 当前朝向：+1 手往右走（掌心朝右）/ -1 往左走
      side: 1, // 手掌当前在脸的哪一侧：+1 右 / -1 左
      armed: true, // 是否能打出下一记（打中后须移开脸中线才可再次触发）
      flash: 0, // 命中闪光剩余时间（秒），仅用于视觉
    },
    lastDir: 0, // 上一记的方向（0 = 还没有），用于判定左右交替

    // ── 受击演出（瞬时）──
    hitT: 0, // 甩头动画剩余时间（秒）
    hitDir: 1,
    hitPower: 0, // 本记力度，决定甩头幅度
    hitGain: 0, // 本记实际入账的分数（含各类加成）
    hitAlternating: false, // 本记是否吃到了左右交替加成
    hitFlew: false, // 本记是否打飞
    flyT: 0, // 「被打飞」演出剩余时间（秒）；> 0 时盖住一切
    shakeT: 0, // 屏幕震动剩余时间（秒）

    // ── 特效（瞬态）──
    floaters: [],
    stars: [],
    comboT: 0, // 连击数字的停留时间（秒）
    comboShown: 0, // 连击数字上显示的数字
    nextId: 1,
  }
}

// ── 输入层调用：把指针位置写进状态（坐标 = 画布 CSS 像素）──
export function setHandPos(state, x, y, on = true) {
  const h = state.hand
  if (on && !h.hasPrev) {
    // 首次出现：直接就位，避免从 (0,0) 瞬间飞入产生一个巨大的假速度
    h.x = x
    h.y = y
    h.prevX = x
    h.prevY = y
    h.hasPrev = true
  }
  h.x = x
  h.y = y
  if (on) h.on = true
}

// ── 输入层调用：指针离开画面（手掌淡出）──
export function setHandOff(state) {
  const h = state.hand
  h.on = false
  h.hasPrev = false
  h.vx = 0
  h.vy = 0
}

// ── 当前该显示哪张表情图 ──
// 打飞演出优先级最高，盖住连击状态；演完回到当前连击状态。
export function faceOf(state, cfg) {
  if (state.flyT > 0) return 'fly'
  return faceForCombo(state.combo, cfg)
}

// ── 由划动速度（px/s）算力度（0..100）──
export function powerFromSpeed(speed, cfg) {
  const s = cfg.swipe
  const t = (speed - s.minSpeed) / Math.max(1, s.maxSpeed - s.minSpeed)
  const k = Math.max(0, Math.min(1, t))
  return Math.round(s.minPower + (100 - s.minPower) * k)
}

// ── 键盘抽一巴掌：没有光标，直接结算一次并把掌甩到 dir 那一侧 ──
export function slapByKey(state, dir, cfg) {
  const d = dir >= 0 ? 1 : -1
  const h = state.hand
  h.on = true
  h.fade = 1
  h.dir = d
  h.side = d
  h.armed = true
  h.hasPrev = true
  h.prevX = h.x
  h.prevY = h.y
  h.x = cfg.view.width * cfg.character.xFrac + d * (cfg.hand.rearmPx + 24)
  h.y = cfg.view.height * cfg.character.groundFrac - cfg.view.height * cfg.character.heightFrac * cfg.hand.hitYFrac
  h.vx = d * 900 // 给出甩动速度，供渲染计算倾斜
  return resolveHit(state, d, cfg.swipe.keyPower, cfg, [])
}

// ── 在屏幕坐标 (x, y) 处弹出一条飘字 ──
function spawnFloater(state, cfg, x, y, text, color, big) {
  state.floaters.push({
    id: state.nextId++,
    x,
    y,
    vy: -cfg.fx.floaterSpeed,
    life: cfg.fx.floaterMs,
    maxLife: cfg.fx.floaterMs,
    text,
    color,
    size: big ? cfg.fx.floaterSize : cfg.fx.floaterSize * 0.78,
  })
}

// ── 命中结算：情绪推进 / 计分 / 演出 ──
function resolveHit(state, dir, power, cfg, events) {
  const p = Math.max(0, Math.min(100, power))

  // 连击：在窗口内接着抽就累加；否则从 1 重新起算（显示上限 99999，内部也封顶）
  const inWindow = state.sinceSlapMs <= cfg.combo.windowMs
  state.combo = inWindow ? state.combo + 1 : 1
  const comboCap = cfg.mood?.displayMax ?? 99999
  if (state.combo > comboCap) state.combo = comboCap
  if (state.combo > state.maxCombo) state.maxCombo = state.combo

  // 左右交替：连上了、且本记方向与上一记相反才算（慢慢抽永远吃不到）
  const alternating = inWindow && state.lastDir !== 0 && dir !== state.lastDir

  // 计分 = 力度 × 连击加成 × 交替加成 + 打飞奖励
  const comboBonus = 1 + Math.min(Math.max(0, state.combo - 1), cfg.combo.maxLevel) * cfg.combo.bonusPerLevel
  const altBonus = alternating ? cfg.rhythm.alternateMul : 1
  const flew = p >= cfg.faces.flyAt
  const gain = p * comboBonus * altBonus + (flew ? cfg.rhythm.flyBonus : 0)

  state.totalPower += gain
  state.hitGain = gain
  state.hitAlternating = alternating
  state.hitFlew = flew
  state.lastDir = dir

  // 累计挨打数（纯统计）
  state.slaps += 1

  // 连击数字：达到展示阈值才弹，每次刷新停留时长
  if (state.combo >= cfg.combo.displayAt) {
    state.comboShown = state.combo
    state.comboT = cfg.fx.comboMs / 1000
  }

  // 演出：打飞是最高优先级（盖住情绪阶段），否则只是甩个头
  state.hitDir = dir
  state.hitPower = p
  if (flew) {
    state.flyCount += 1
    state.flyT = cfg.hit.flyDurationMs / 1000
    state.hitT = 0 // 打飞时不叠加甩头
  } else {
    state.hitT = cfg.hit.durationMs / 1000
  }
  state.shakeT = cfg.hit.shakeMs / 1000
  state.hand.flash = cfg.fx.flashMs / 1000

  // 计时器重置（注意：上面已用完 sinceSlapMs 做判定）
  state.sinceSlapMs = 0
  state.decayAcc = 0

  // ── 飘字：只保留「本次力度」（0~999，纯装饰），显示在击打位置 ──
  // 力度 = 本次划动速度（power 已是 0..100）映射到 0~999：划得越快数字越大
  const W = cfg.view.width
  const H = cfg.view.height
  const force = Math.min(999, Math.max(1, Math.round((p / 100) * 999)))
  const forceY = H * cfg.character.groundFrac - H * cfg.character.heightFrac * cfg.hand.hitYFrac - 10
  spawnFloater(state, cfg, W * cfg.character.xFrac + dir * W * 0.17, forceY, String(force), cfg.fx.forceColor, true)

  // 星星：绕头顶转一圈（力度越大越多）
  const cx = W * cfg.character.xFrac
  const cy = H * cfg.character.groundFrac - H * cfg.character.heightFrac * 0.82
  const count = Math.max(3, Math.round((p / 100) * cfg.fx.starCount) + 2)
  for (let i = 0; i < count; i++) {
    state.stars.push({
      id: state.nextId++,
      cx,
      cy,
      a: (Math.PI * 2 * i) / count,
      r: cfg.fx.starRadius * (0.7 + Math.random() * 0.6),
      life: cfg.fx.starMs,
      maxLife: cfg.fx.starMs,
      spin: cfg.fx.starSpin * (0.8 + Math.random() * 0.5),
      size: 5 + Math.random() * 5,
    })
  }

  events.push({ type: 'hit', power: p, dir, gain, combo: state.combo, alternating, flew })
  return p
}

// ── 连击回落 / 彻底冷却 ──
function updateCombo(state, dt, cfg) {
  state.sinceSlapMs += dt * 1000

  if (state.combo > 0 && state.sinceSlapMs > cfg.combo.windowMs) {
    // 停手超过窗口 → 连击逐级回落（她慢慢缓过来）
    state.decayAcc += dt * 1000
    if (state.decayAcc >= cfg.combo.decayMs) {
      state.decayAcc = 0
      state.combo -= 1
    }
  }

  // 彻底冷却：累计清零、连击归零，完全缓过来（回到微笑）
  if (state.sinceSlapMs > cfg.combo.cooldownMs) {
    state.slaps = 0
    state.combo = 0
    state.lastDir = 0
  }
}

// ── 每帧推进手掌：算速度 → 判断是否划过脸 → 打中则结算 ──
function updateHand(state, dt, cfg, events) {
  const h = state.hand
  const W = cfg.view.width
  const H = cfg.view.height
  const faceX = W * cfg.character.xFrac
  const hitY = H * cfg.character.groundFrac - H * cfg.character.heightFrac * cfg.hand.hitYFrac

  // 速度：按帧间位移算（平滑一下，避免单帧抖动造成力度忽高忽低）
  const rawVx = dt > 0 ? (h.x - h.prevX) / dt : 0
  const rawVy = dt > 0 ? (h.y - h.prevY) / dt : 0
  const k = Math.max(0, Math.min(1, cfg.hand.follow))
  h.vx += (rawVx - h.vx) * k
  h.vy += (rawVy - h.vy) * k
  h.prevX = h.x
  h.prevY = h.y

  // 朝向：速度够明显才翻转（停下时保持上一刻朝向，避免手掌左右抽搐）
  if (Math.abs(h.vx) > cfg.swipe.dirDeadZone) h.dir = h.vx > 0 ? 1 : -1

  const side = h.x >= faceX ? 1 : -1
  const dist = Math.abs(h.x - faceX)
  const reachY = Math.abs(h.y - hitY) <= H * cfg.hand.hitRangeY // 高度够不够得着脸

  // 划过脸的中线 = 一巴掌；之后必须把手移开 rearmPx 才能再打下一记（防原地抖动刷连击）
  if (side !== h.side) {
    h.side = side
    const speed = Math.abs(h.vx)
    if (h.armed && reachY && speed >= cfg.swipe.minSpeed) {
      resolveHit(state, side, powerFromSpeed(speed, cfg), cfg, events)
      h.armed = false
    }
  }
  if (dist >= cfg.hand.rearmPx) h.armed = true

  if (h.flash > 0) h.flash = Math.max(0, h.flash - dt)
}

// ── 推进一帧；返回事件数组（供音效等使用，可忽略）──
export function step(state, dt, cfg) {
  const events = []
  dt = Math.min(dt, 0.05) // 防止切后台后大跳
  state.clock += dt

  const h = state.hand
  const fadeTarget = h.on ? 1 : 0
  h.fade += (fadeTarget - h.fade) * Math.min(1, dt * 12)
  if (h.on || h.fade > 0.01) updateHand(state, dt, cfg, events)

  updateCombo(state, dt, cfg)

  // 演出计时
  if (state.hitT > 0) state.hitT = Math.max(0, state.hitT - dt)
  if (state.flyT > 0) state.flyT = Math.max(0, state.flyT - dt)
  if (state.shakeT > 0) state.shakeT = Math.max(0, state.shakeT - dt)
  if (state.comboT > 0) state.comboT = Math.max(0, state.comboT - dt)

  // 飘字：上飘并淡出
  for (let i = state.floaters.length - 1; i >= 0; i--) {
    const f = state.floaters[i]
    f.life -= dt * 1000
    f.y += f.vy * dt
    if (f.life <= 0) state.floaters.splice(i, 1)
  }
  // 星星：绕头顶公转并淡出
  for (let i = state.stars.length - 1; i >= 0; i--) {
    const s = state.stars[i]
    s.life -= dt * 1000
    s.a += s.spin * dt
    if (s.life <= 0) state.stars.splice(i, 1)
  }

  state.totalInt = Math.round(state.totalPower)
  return events
}
