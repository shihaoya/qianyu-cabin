// 千羽画圈圈 · Canvas 渲染（纯绘制，无游戏逻辑）
// draw(ctx, state, cfg, images)：每一帧根据当前状态重绘整个画布。
// images = { sprite, bugs: { key: Image } }（贴图未加载完成时回退为矢量绘制）

const TAU = Math.PI * 2

// 人物图（307×307 整图）四周透明边约占 25%，裁掉后按 scale 缩放
const SRC_TRIM = 0.25

export function draw(ctx, state, cfg, images) {
  const W = cfg.view.width
  const H = cfg.view.height
  const CX = W / 2
  const CY = H / 2
  const R = Math.min(W, H) * cfg.ring.radiusFrac
  const T = cfg.monsters.types

  // 背景（暖色宣纸底 + 中心柔和光晕，与小屋整体风格一致）
  const bg = ctx.createRadialGradient(CX, CY, R * 0.2, CX, CY, R * 2.4)
  bg.addColorStop(0, '#fdfaf1')
  bg.addColorStop(1, cfg.view.background)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // 圆环跑道（未涂色部分）
  ctx.beginPath()
  ctx.arc(CX, CY, R, 0, TAU)
  ctx.lineWidth = cfg.ring.width
  ctx.strokeStyle = cfg.ring.color
  ctx.stroke()

  // 涂色部分（带柔和光晕）
  ctx.lineWidth = cfg.ring.width + 4
  ctx.lineCap = 'round'
  ctx.strokeStyle = cfg.ring.paintColor
  ctx.shadowColor = cfg.ring.paintGlow
  ctx.shadowBlur = 10
  for (const s of state.painted) {
    ctx.beginPath()
    ctx.arc(CX, CY, R, s[0], s[1])
    ctx.stroke()
  }
  ctx.shadowBlur = 0

  // 怪物（贴图或矢量回退）
  for (let i = 0; i < state.monsters.length; i++) {
    const m = state.monsters[i]
    const type = T.find((t) => t.key === m.typeKey) || T[i % T.length]
    drawMonster(ctx, CX, CY, R, m, type, cfg, images?.bugs?.[type.key])
  }

  // 千羽（贴图或矢量回退）
  drawPlayer(ctx, state, cfg, CX, CY, R, images?.sprite)
}

function drawMonster(ctx, CX, CY, R, m, type, cfg, img) {
  const mx = CX + Math.cos(m.angle) * R
  const my = CY + Math.sin(m.angle) * R
  const size = 500 * cfg.monsters.imageScale // 贴图基准 500×500

  if (img && img.complete && img.naturalWidth) {
    ctx.save()
    ctx.translate(mx, my)
    ctx.rotate(Math.sin(m.wobble) * 0.3)
    ctx.drawImage(img, -size / 2, -size / 2, size, size)
    ctx.restore()
    return
  }

  // 矢量回退：圆球怪（颜色取 type.color）
  const r = size * 0.32
  ctx.save()
  ctx.translate(mx, my)
  ctx.rotate(m.wobble * 0.3)
  // 刺
  const spikes = 8
  ctx.beginPath()
  for (let i = 0; i < spikes; i++) {
    const a = (i / spikes) * TAU
    const a2 = a + TAU / spikes / 2
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r)
    ctx.lineTo(Math.cos(a2) * r * 1.45, Math.sin(a2) * r * 1.45)
  }
  ctx.closePath()
  ctx.fillStyle = type?.color || '#c0392b'
  ctx.fill()
  // 身体
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, TAU)
  ctx.fillStyle = type?.color || '#e74c3c'
  ctx.fill()
  // 眼睛
  ctx.beginPath()
  ctx.arc(0, 0, r * 0.5, 0, TAU)
  ctx.fillStyle = '#fff'
  ctx.fill()
  ctx.beginPath()
  ctx.arc(r * 0.12, 0, r * 0.22, 0, TAU)
  ctx.fillStyle = '#111'
  ctx.fill()
  ctx.restore()
}

function drawPlayer(ctx, state, cfg, CX, CY, R, sprite) {
  const jumpTime = cfg.character.jumpTime
  const airborne = state.jumpTimer > 0
  const t = airborne ? (jumpTime - state.jumpTimer) / jumpTime : 0
  const hop = airborne ? Math.sin(t * Math.PI) : 0
  const radius = R - hop * R * cfg.character.jumpHeightFrac // 跳跃向圆心方向跳起
  const dropT = state.phase === 'dropping' ? state.dropTimer / cfg.drop.duration : 0 // 1→0
  const dropFromY = cfg.view.height * cfg.drop.fromYFrac

  let x = CX
  let y = CY
  if (state.phase === 'dropping') {
    y = dropFromY + (CY + R - dropFromY) * (1 - dropT)
  } else {
    x = CX + Math.cos(state.angle) * radius
    y = CY + Math.sin(state.angle) * radius
  }
  const scale = (1 + hop * 0.5) * (state.phase === 'dropping' ? 1 + dropT * 0.8 : 1)

  // 落点影子（在跑道上）
  if (state.phase !== 'dropping') {
    const spx = CX + Math.cos(state.angle) * R
    const spy = CY + Math.sin(state.angle) * R
    ctx.beginPath()
    ctx.ellipse(spx, spy, 8 * (1 - hop * 0.5), 4 * (1 - hop * 0.5), state.angle + Math.PI / 2, 0, TAU)
    ctx.fillStyle = `rgba(90,70,50,${0.22 * (1 - hop * 0.7)})`
    ctx.fill()
  }

  ctx.save()
  ctx.translate(x, y)
  ctx.scale(scale, scale)
  // 人物始终保持正向朝上；仅在跳跃滞空时以进度 t 做一整圈 360° 旋转，落地回到 0
  const spin = airborne ? t * TAU : 0
  const rot = state.phase === 'dropping' ? 0 : spin
  ctx.rotate(rot)

  if (sprite && sprite.complete && sprite.naturalWidth) {
    const iw = sprite.naturalWidth
    const ih = sprite.naturalHeight
    const trim = iw * SRC_TRIM * 0.5
    const dw = iw * cfg.character.scale
    const dh = ih * cfg.character.scale
    ctx.drawImage(sprite, trim, trim, iw - trim * 2, ih - trim * 2, -dw / 2, -dh / 2, dw, dh)
  } else {
    // 矢量回退：千羽（绿色细长水滴形 + 单眼）
    ctx.beginPath()
    ctx.ellipse(0, 0, 7, 12, 0, 0, TAU)
    ctx.fillStyle = '#57c256'
    ctx.fill()
    ctx.lineWidth = 1.5
    ctx.strokeStyle = '#2c7a2c'
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(0, -3, 5.5, 0, TAU)
    ctx.fillStyle = '#fdf6d8'
    ctx.fill()
    ctx.strokeStyle = '#2c7a2c'
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(0, -3, 2.2, 0, TAU)
    ctx.fillStyle = '#111'
    ctx.fill()
    // 两根触角
    ctx.beginPath()
    ctx.moveTo(-3, -11)
    ctx.quadraticCurveTo(-6, -18, -9, -20)
    ctx.moveTo(3, -11)
    ctx.quadraticCurveTo(6, -18, 9, -20)
    ctx.lineWidth = 1.6
    ctx.strokeStyle = '#2c7a2c'
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(-9, -20, 2, 0, TAU)
    ctx.arc(9, -20, 2, 0, TAU)
    ctx.fillStyle = '#ffd94d'
    ctx.fill()
  }

  ctx.restore()
}
