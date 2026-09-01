// 打是亲 · Canvas 2D 渲染（只画，不含逻辑；PC/移动端共用同一份）
// 场景（小屋室内：墙、窗、地板、地毯）预渲染到离屏缓存，角色/手掌/连击/特效每帧绘制。
// 一次挥击 = 手掌从一侧飞入 → 打脸 → 顺势从另一侧飞出，故左右交替划动即为「左右开弓」。
// 图片未加载时自动回退为「代码绘制的占位小人 / 手掌」，图一放进目录即自动切换为真图。

import { faceOf } from './engine.js'

let _bgCache = null
function getStaticBackground(cfg) {
  const W = cfg.view.width
  const H = cfg.view.height
  const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1
  if (_bgCache && _bgCache.w === W && _bgCache.h === H && _bgCache.dpr === dpr) {
    return _bgCache.canvas
  }
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(W * dpr)
  canvas.height = Math.round(H * dpr)
  const bctx = canvas.getContext('2d')
  bctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  paintStaticScene(bctx, cfg, W, H)
  _bgCache = { canvas, w: W, h: H, dpr }
  return canvas
}

// 小屋室内：暖奶油墙 + 木地板 + 窗户 + 挂画 + 地毯
function paintStaticScene(ctx, cfg, W, H) {
  const groundY = H * cfg.character.groundFrac

  // 墙面（暖奶油 → 略深）
  const g = ctx.createLinearGradient(0, 0, 0, groundY)
  g.addColorStop(0, '#f5ecd9')
  g.addColorStop(1, '#eddcc0')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, groundY)

  // 墙面竖条纹（淡淡的墙纸质感）
  ctx.fillStyle = 'rgba(160, 120, 70, 0.05)'
  for (let x = 0; x < W; x += 28) ctx.fillRect(x, 0, 12, groundY)

  // 窗户（右上角）
  const wx = W * 0.6
  const wy = H * 0.08
  const ww = W * 0.3
  const wh = H * 0.2
  ctx.fillStyle = '#b98a55'
  ctx.fillRect(wx - 6, wy - 6, ww + 12, wh + 12)
  const sg = ctx.createLinearGradient(wx, wy, wx, wy + wh)
  sg.addColorStop(0, '#bfe3ef')
  sg.addColorStop(1, '#e8f4e4')
  ctx.fillStyle = sg
  ctx.fillRect(wx, wy, ww, wh)
  ctx.fillStyle = '#ffd98c'
  ctx.beginPath()
  ctx.arc(wx + ww * 0.74, wy + wh * 0.28, Math.min(ww, wh) * 0.16, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  for (const [cx, cy, r] of [[0.28, 0.62, 0.14], [0.42, 0.56, 0.1], [0.38, 0.7, 0.12]]) {
    ctx.beginPath()
    ctx.arc(wx + ww * cx, wy + wh * cy, ww * r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = '#b98a55'
  ctx.fillRect(wx + ww / 2 - 3, wy, 6, wh)
  ctx.fillRect(wx, wy + wh / 2 - 3, ww, 6)

  // 挂画（左上角，小方框 + 简笔小屋）
  const px = W * 0.08
  const py = H * 0.1
  const pw = W * 0.22
  const ph = H * 0.14
  ctx.fillStyle = '#a97c4e'
  ctx.fillRect(px - 5, py - 5, pw + 10, ph + 10)
  ctx.fillStyle = '#fdf6e6'
  ctx.fillRect(px, py, pw, ph)
  ctx.fillStyle = 'rgba(91,140,123,0.5)'
  ctx.beginPath()
  ctx.moveTo(px + pw * 0.1, py + ph * 0.72)
  ctx.lineTo(px + pw * 0.5, py + ph * 0.32)
  ctx.lineTo(px + pw * 0.9, py + ph * 0.72)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = 'rgba(201,116,59,0.55)'
  ctx.fillRect(px + pw * 0.38, py + ph * 0.55, pw * 0.24, ph * 0.28)

  // 踢脚线
  ctx.fillStyle = '#c9a978'
  ctx.fillRect(0, groundY - 8, W, 8)

  // 地板（木纹）
  const fg = ctx.createLinearGradient(0, groundY, 0, H)
  fg.addColorStop(0, '#c99a63')
  fg.addColorStop(1, '#b7854f')
  ctx.fillStyle = fg
  ctx.fillRect(0, groundY, W, H - groundY)
  ctx.strokeStyle = 'rgba(90, 60, 30, 0.18)'
  ctx.lineWidth = 2
  for (let i = 1; i < 5; i++) {
    const y = groundY + ((H - groundY) * i) / 5
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(W, y)
    ctx.stroke()
  }
  for (let i = 0; i < 8; i++) {
    const x = (W * i) / 8 + (i % 2 ? 20 : 0)
    const y0 = groundY + ((H - groundY) * ((i * 2) % 5)) / 5
    ctx.beginPath()
    ctx.moveTo(x, y0)
    ctx.lineTo(x, y0 + (H - groundY) / 5)
    ctx.stroke()
  }

  // 地毯（角色脚下）
  ctx.fillStyle = 'rgba(91,140,123,0.28)'
  ctx.beginPath()
  ctx.ellipse(W * cfg.character.xFrac, groundY + (H - groundY) * 0.42, W * 0.3, (H - groundY) * 0.3, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(91,140,123,0.45)'
  ctx.lineWidth = 3
  ctx.stroke()
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function clamp01(t) {
  return Math.max(0, Math.min(1, t))
}

export function draw(ctx, state, cfg, images) {
  const W = cfg.view.width
  const H = cfg.view.height
  if (!W || !H) return

  ctx.save()

  // 屏幕震动（挨打瞬间）
  if (state.shakeT > 0) {
    const k = state.shakeT / (cfg.hit.shakeMs / 1000)
    const amp = cfg.hit.shakeAmp * k
    ctx.translate((Math.random() * 2 - 1) * amp, (Math.random() * 2 - 1) * amp)
  }

  // 静态场景：一次性预渲染并缓存
  try {
    const bg = getStaticBackground(cfg)
    if (bg) ctx.drawImage(bg, 0, 0, W, H)
    else paintStaticScene(ctx, cfg, W, H)
  } catch (e) {
    /* 背景失败不阻断 */
  }

  try {
    drawCharacter(ctx, state, cfg, images)
  } catch (e) {
    /* 角色失败不阻断 */
  }
  try {
    drawStars(ctx, state, cfg)
  } catch (e) {
    /* 星星失败不阻断 */
  }
  try {
    drawHand(ctx, state, cfg, images)
  } catch (e) {
    /* 手掌失败不阻断 */
  }
  try {
    drawFloaters(ctx, state, cfg)
  } catch (e) {
    /* 飘字失败不阻断 */
  }
  try {
    drawCombo(ctx, state, cfg)
  } catch (e) {
    /* 连击失败不阻断 */
  }
  try {
    if (state.slaps === 0) drawHint(ctx, state, cfg)
    // 调试：画出「脸的中线」与重武装范围，方便核对命中判定
    if (cfg.debug && cfg.debug.showHitbox) drawFaceAxis(ctx, state, cfg)
  } catch (e) {
    /* 提示失败不阻断 */
  }

  ctx.restore()
}

// ── 千羽：受击时朝 dir 方向甩头，力度够大时被打飞 ──
function drawCharacter(ctx, state, cfg, images) {
  const W = cfg.view.width
  const H = cfg.view.height
  const groundY = H * cfg.character.groundFrac
  const ch = H * cfg.character.heightFrac
  const face = faceOf(state, cfg)
  const img = images ? images[face] : null

  let cx = W * cfg.character.xFrac
  const cy = groundY // 脚底
  let angle = 0
  let alpha = 1
  let scale = 1

  if (state.flyT > 0) {
    // 被打飞：沿 dir 方向抛物线飞出并翻滚，尾段淡出
    const total = Math.max(0.001, cfg.hit.flyDurationMs / 1000)
    const k = clamp01(1 - state.flyT / total) // 0 → 1
    cx += state.hitDir * k * W * cfg.hit.flyDxFrac
    const lift = Math.sin(Math.PI * k) * H * cfg.hit.flyArcFrac
    angle = state.hitDir * k * Math.PI * 1.15
    scale = 1 - k * 0.12
    alpha = 1 - clamp01((k - 0.75) / 0.25)
    drawCharImage(ctx, img, cx, cy - lift, ch, angle, alpha, scale, cfg, face)
    return
  }

  if (state.hitT > 0) {
    // 甩头：整体朝 dir 方向偏（叠加抖动），幅度随剩余时间衰减
    // 幅度按本记力度缩放——打得越响甩得越狠（情绪阶段只管表情，不参与这里）
    const total = Math.max(0.001, cfg.hit.durationMs / 1000)
    const elapsed = total - state.hitT
    const decay = clamp01(state.hitT / total)
    const wobble = 0.6 + 0.4 * Math.sin(elapsed * cfg.hit.shakeFreq)
    const powerK = clamp01(state.hitPower / 100)
    const dir = state.hitDir
    angle = dir * cfg.hit.tiltRad * decay * wobble * (0.45 + powerK)
    cx += dir * cfg.hit.shiftPx * decay * wobble * (0.45 + powerK)
  }

  // 高连击状态：她开始发抖/抽泣（100+ 生气鼓腮微颤、200+ 哭哭抖得更厉害）
  if (state.flyT <= 0 && state.combo >= 100) {
    const t = state.clock * (state.combo >= 200 ? 9 : 14)
    const amp = state.combo >= 200 ? ch * 0.012 : ch * 0.006
    cx += Math.sin(t) * amp
    angle += Math.sin(t * 0.7) * (state.combo >= 200 ? 0.02 : 0.01)
  }

  drawCharImage(ctx, img, cx, cy, ch, angle, alpha, scale, cfg, face)
}

// 以 pivotFrac 处为轴心旋转绘制；图片缺失时回退为代码绘制的占位小人
function drawCharImage(ctx, img, cx, cy, ch, angle, alpha, scale, cfg, face) {
  const pivotY = cy - ch * cfg.character.pivotFrac
  let w = ch * 0.8
  if (img && img.complete && img.naturalWidth) {
    w = ch * (img.naturalWidth / img.naturalHeight)
  }

  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(cx, pivotY)
  ctx.rotate(angle)
  ctx.scale(scale, scale)

  const top = -ch * (1 - cfg.character.pivotFrac)
  if (img && img.complete && img.naturalWidth) {
    ctx.drawImage(img, -w / 2, top, w, ch)
  } else {
    drawPlaceholderChar(ctx, -w / 2, top, w, ch, face)
  }

  if (cfg.debug && cfg.debug.showHitbox) {
    ctx.strokeStyle = 'rgba(255,0,0,0.9)'
    ctx.lineWidth = 2
    ctx.strokeRect(-w / 2, top, w, ch)
  }
  ctx.restore()
}

// 占位小人（图未加载时）：圆脸 + 身体 + 手脚，表情用眼睛/嘴巴简单区分
function drawPlaceholderChar(ctx, x, y, w, h, face) {
  const headR = h * 0.22
  const headCy = y + headR * 1.1
  const cx = x + w / 2

  // 腿
  ctx.fillStyle = '#8a6a4a'
  ctx.fillRect(cx - w * 0.16, y + h * 0.72, w * 0.12, h * 0.28)
  ctx.fillRect(cx + w * 0.04, y + h * 0.72, w * 0.12, h * 0.28)
  // 身体（连帽衫）
  ctx.fillStyle = '#f0e4cc'
  roundRect(ctx, cx - w * 0.24, y + h * 0.34, w * 0.48, h * 0.42, w * 0.16)
  ctx.fill()
  // 手臂
  ctx.strokeStyle = '#f0e4cc'
  ctx.lineWidth = w * 0.1
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(cx - w * 0.2, y + h * 0.42)
  ctx.lineTo(cx - w * 0.34, y + h * 0.58)
  ctx.moveTo(cx + w * 0.2, y + h * 0.42)
  ctx.lineTo(cx + w * 0.34, y + h * 0.58)
  ctx.stroke()
  // 头
  ctx.fillStyle = '#f7d9a8'
  ctx.beginPath()
  ctx.arc(cx, headCy, headR, 0, Math.PI * 2)
  ctx.fill()
  // 头发
  ctx.fillStyle = '#8fa6bd'
  ctx.beginPath()
  ctx.arc(cx, headCy - headR * 0.18, headR, Math.PI, Math.PI * 2)
  ctx.fill()
  // 呆毛
  ctx.strokeStyle = '#8fa6bd'
  ctx.lineWidth = Math.max(2, headR * 0.16)
  ctx.beginPath()
  ctx.moveTo(cx, headCy - headR)
  ctx.quadraticCurveTo(cx + headR * 0.5, headCy - headR * 1.6, cx + headR * 0.1, headCy - headR * 1.5)
  ctx.stroke()

  // 表情
  ctx.fillStyle = '#2b2b2b'
  const eyeY = headCy + headR * 0.05
  const eyeDx = headR * 0.36
  const eyeR = headR * 0.12
  if (face === 'fly') {
    ctx.strokeStyle = '#2b2b2b'
    ctx.lineWidth = Math.max(1.5, headR * 0.07)
    for (const dx of [-eyeDx, eyeDx]) {
      ctx.beginPath()
      ctx.arc(cx + dx, eyeY, eyeR * 1.5, 0, Math.PI * 1.6)
      ctx.stroke()
    }
  } else if (face === 'cry') {
    ctx.strokeStyle = '#2b2b2b'
    ctx.lineWidth = Math.max(1.5, headR * 0.08)
    for (const dx of [-eyeDx, eyeDx]) {
      ctx.beginPath()
      ctx.moveTo(cx + dx - eyeR, eyeY - eyeR * 0.4)
      ctx.quadraticCurveTo(cx + dx, eyeY + eyeR * 1.2, cx + dx + eyeR, eyeY - eyeR * 0.4)
      ctx.stroke()
    }
    ctx.fillStyle = '#6fb3d8'
    for (const dx of [-eyeDx, eyeDx]) {
      ctx.beginPath()
      ctx.ellipse(cx + dx, eyeY + eyeR * 1.6, eyeR * 0.7, eyeR * 1.4, 0, 0, Math.PI * 2)
      ctx.fill()
    }
  } else if (face === 'blink') {
    ctx.beginPath()
    ctx.arc(cx - eyeDx, eyeY, eyeR, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#2b2b2b'
    ctx.lineWidth = Math.max(1.5, headR * 0.08)
    ctx.beginPath()
    ctx.moveTo(cx + eyeDx - eyeR, eyeY)
    ctx.lineTo(cx + eyeDx + eyeR, eyeY)
    ctx.stroke()
  } else {
    ctx.beginPath()
    ctx.arc(cx - eyeDx, eyeY, eyeR, 0, Math.PI * 2)
    ctx.arc(cx + eyeDx, eyeY, eyeR, 0, Math.PI * 2)
    ctx.fill()
  }

  // 嘴
  ctx.fillStyle = '#b7654a'
  if (face === 'fly' || face === 'cry') {
    ctx.beginPath()
    ctx.ellipse(cx, headCy + headR * 0.5, headR * 0.2, headR * 0.28, 0, 0, Math.PI * 2)
    ctx.fill()
  } else if (face === 'angry') {
    ctx.strokeStyle = '#b7654a'
    ctx.lineWidth = Math.max(1.5, headR * 0.08)
    ctx.beginPath()
    ctx.moveTo(cx - headR * 0.22, headCy + headR * 0.55)
    ctx.quadraticCurveTo(cx, headCy + headR * 0.34, cx + headR * 0.22, headCy + headR * 0.55)
    ctx.stroke()
    ctx.strokeStyle = '#c0392b'
    ctx.lineWidth = Math.max(1.5, headR * 0.07)
    for (const dx of [-eyeDx, eyeDx]) {
      ctx.beginPath()
      ctx.moveTo(cx + dx - eyeR, eyeY - eyeR * 2)
      ctx.lineTo(cx + dx + eyeR, eyeY - eyeR * 0.6)
      ctx.stroke()
    }
  } else {
    ctx.strokeStyle = '#b7654a'
    ctx.lineWidth = Math.max(1.5, headR * 0.08)
    ctx.beginPath()
    ctx.arc(cx, headCy + headR * 0.3, headR * 0.22, 0.15 * Math.PI, 0.85 * Math.PI)
    ctx.stroke()
  }
}

// ── 手掌：实时跟随指针位置，按挥动速度倾斜 ──
// 素材是「掌心朝左」的右手掌，往右挥（dir=+1）时水平翻转，掌心自然朝右。
function drawHand(ctx, state, cfg, images) {
  const h = state.hand
  if (h.fade <= 0.01) return

  const H = cfg.view.height
  const hh = H * cfg.hand.heightFrac
  const dir = h.dir

  // 倾斜：速度越快越斜；停下时慢慢回正
  const speedK = clamp01(Math.abs(h.vx) / Math.max(1, cfg.swipe.maxSpeed))
  const tilt = dir * cfg.hand.maxTilt * speedK
  // 命中瞬间：放大一下，配合冲击线强化打击感
  const flashK = clamp01(h.flash / (cfg.fx.flashMs / 1000))
  const scale = 1 + flashK * 0.16

  const img = images ? images.hand : null
  let hw = hh * 0.85
  if (img && img.complete && img.naturalWidth) hw = hh * (img.naturalWidth / img.naturalHeight)

  ctx.save()
  ctx.globalAlpha = clamp01(h.fade)
  ctx.translate(h.x, h.y)
  ctx.rotate(tilt)
  ctx.scale((dir > 0 ? -1 : 1) * scale, scale)
  if (img && img.complete && img.naturalWidth) {
    ctx.drawImage(img, -hw / 2, -hh / 2, hw, hh)
  } else {
    drawPlaceholderHand(ctx, -hw / 2, -hh / 2, hw, hh)
  }
  if (cfg.debug && cfg.debug.showHitbox) {
    ctx.strokeStyle = 'rgba(255,0,0,0.9)'
    ctx.lineWidth = 2
    ctx.strokeRect(-hw / 2, -hh / 2, hw, hh)
  }
  ctx.restore()

  if (flashK > 0) drawImpact(ctx, state, cfg, dir, flashK)
}

// 命中冲击：以命中点为中心散开的短白线 + 一圈淡黄光晕
function drawImpact(ctx, state, cfg, dir, k) {
  const H = cfg.view.height
  const ch = H * cfg.character.heightFrac
  const cx = cfg.view.width * cfg.character.xFrac + dir * cfg.view.width * 0.06
  const cy = H * cfg.character.groundFrac - ch * cfg.hand.hitYFrac
  const R = H * 0.14

  ctx.save()
  ctx.globalAlpha = k * 0.9
  // 光晕
  const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, R)
  g.addColorStop(0, 'rgba(255,240,200,0.85)')
  g.addColorStop(1, 'rgba(255,240,200,0)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(cx, cy, R, 0, Math.PI * 2)
  ctx.fill()
  // 放射短线
  ctx.strokeStyle = 'rgba(255,255,255,0.95)'
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI * 2 * i) / 8 + 0.2
    const r0 = R * (0.35 + 0.4 * (1 - k))
    const r1 = r0 + R * 0.35 * k
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0)
    ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1)
    ctx.stroke()
  }
  ctx.restore()
}

// 占位手掌（图未加载时）：掌心椭圆 + 五指 + 手腕
function drawPlaceholderHand(ctx, x, y, w, h) {
  ctx.fillStyle = '#f7d9a8'
  ctx.strokeStyle = '#d8ab77'
  ctx.lineWidth = Math.max(2, h * 0.02)
  roundRect(ctx, x + w * 0.78, y + h * 0.34, w * 0.28, h * 0.32, h * 0.08)
  ctx.fill()
  ctx.stroke()
  roundRect(ctx, x + w * 0.16, y + h * 0.12, w * 0.64, h * 0.76, h * 0.18)
  ctx.fill()
  ctx.stroke()
  const fingers = [
    [0.2, 0.34, 0.1],
    [0.32, 0.2, 0.1],
    [0.44, 0.12, 0.1],
    [0.56, 0.16, 0.1],
    [0.68, 0.3, 0.09],
  ]
  for (const [fx, fy, fw] of fingers) {
    roundRect(ctx, x + w * fx, y + h * fy, w * fw, h * 0.4, w * fw * 0.5)
    ctx.fill()
    ctx.stroke()
  }
}

// ── 星星（绕头顶公转）──
function drawStars(ctx, state, cfg) {
  for (const s of state.stars) {
    const k = clamp01(s.life / s.maxLife)
    const r = s.r * (0.6 + (1 - k) * 0.8)
    const x = s.cx + Math.cos(s.a) * r
    const y = s.cy + Math.sin(s.a) * r * 0.6
    ctx.save()
    ctx.globalAlpha = k
    ctx.translate(x, y)
    ctx.rotate(s.a)
    drawStarShape(ctx, 0, 0, s.size * (0.6 + (1 - k) * 0.8))
    ctx.restore()
  }
}

function drawStarShape(ctx, cx, cy, r) {
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? r : r * 0.45
    const a = (Math.PI / 5) * i - Math.PI / 2
    const x = cx + Math.cos(a) * rr
    const y = cy + Math.sin(a) * rr
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.fillStyle = '#ffd98c'
  ctx.strokeStyle = '#e0a23b'
  ctx.lineWidth = 1.5
  ctx.fill()
  ctx.stroke()
}

// ── 飘字 ──
function drawFloaters(ctx, state, cfg) {
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const f of state.floaters) {
    const k = clamp01(f.life / f.maxLife)
    ctx.globalAlpha = k
    ctx.font = `900 ${Math.round(f.size)}px sans-serif`
    ctx.lineWidth = 6
    ctx.strokeStyle = 'rgba(255,255,255,0.92)'
    ctx.strokeText(f.text, f.x, f.y)
    ctx.fillStyle = f.color
    ctx.fillText(f.text, f.x, f.y)
  }
  ctx.restore()
}

// ── 连击数字（角色头顶，连击越高越大越红，带弹跳缩放）──
function drawCombo(ctx, state, cfg) {
  if (state.comboT <= 0 || state.comboShown < cfg.combo.displayAt) return
  const W = cfg.view.width
  const H = cfg.view.height
  const k = clamp01(state.comboT / (cfg.fx.comboMs / 1000))
  const grown = Math.min(1, (state.comboShown - 1) / 8)
  const pop = 1 + 0.3 * k * k // 刚冒出来时弹一下，随后回稳
  const size = Math.round((26 + grown * 26) * pop)
  const x = W * cfg.character.xFrac
  // 停在头顶偏上：与击打位置飘出的「力度」留出间距，避免高连击时数字与力度叠在一起
  const y = Math.max(size * 0.7, H * cfg.character.groundFrac - H * cfg.character.heightFrac - 96)

  ctx.save()
  ctx.globalAlpha = Math.min(1, k * 1.6)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `900 ${size}px sans-serif`
  ctx.lineWidth = 7
  ctx.strokeStyle = 'rgba(255,255,255,0.92)'
  const shown = Math.min(state.comboShown, cfg.mood?.displayMax ?? 99999) // 显示上限 99999
  const text = `${shown} 连击!`
  ctx.strokeText(text, x, y)
  // 颜色随连击升高：鼠尾草绿 → 赭石 → 朱红
  ctx.fillStyle = grown > 0.6 ? '#c0392b' : grown > 0.3 ? '#c9743b' : '#5b8c7b'
  ctx.fillText(text, x, y)
  ctx.restore()
}

// 调试：脸的中线（竖线）+ 重武装范围（半透明带）
function drawFaceAxis(ctx, state, cfg) {
  const W = cfg.view.width
  const H = cfg.view.height
  const faceX = W * cfg.character.xFrac
  const hitY = H * cfg.character.groundFrac - H * cfg.character.heightFrac * cfg.hand.hitYFrac
  ctx.save()
  ctx.strokeStyle = 'rgba(255,0,0,0.9)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(faceX, 0)
  ctx.lineTo(faceX, H)
  ctx.stroke()
  ctx.fillStyle = 'rgba(255,0,0,0.08)'
  ctx.fillRect(faceX - cfg.hand.rearmPx, hitY - H * cfg.hand.hitRangeY, cfg.hand.rearmPx * 2, H * cfg.hand.hitRangeY * 2)
  ctx.restore()
}

// ── 首次进入的操作提示（抽过第一记后就不再显示）──
function drawHint(ctx, state, cfg) {
  const W = cfg.view.width
  const H = cfg.view.height
  const y = H * cfg.character.groundFrac + (H - H * cfg.character.groundFrac) * 0.42
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '700 17px sans-serif'
  ctx.lineWidth = 5
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'
  const text = '← 左右划过脸 →'
  ctx.strokeText(text, W / 2, y)
  ctx.fillStyle = '#7a5a3a'
  ctx.fillText(text, W / 2, y)
  ctx.restore()
}
