// 像素鸟 · Canvas 2D 渲染（只画，不含逻辑；PC/移动端共用同一份）
// 天空、云、地面用代码绘制并预渲染到离屏缓存；管道、小鸟每帧绘制。
// 小鸟从精灵图按帧裁切，并随垂直速度做俯仰旋转（经典手感）。

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

function paintStaticScene(ctx, cfg, W, H) {
  // 天空渐变（暖奶油色过渡到天蓝，呼应小屋配色）
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, '#bfe3ef')
  g.addColorStop(0.55, '#dff0e6')
  g.addColorStop(1, '#f7f1e3')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  // 太阳（右上角暖黄圆 + 光晕）
  const sx = W * 0.82
  const sy = H * 0.16
  const sg = ctx.createRadialGradient(sx, sy, 4, sx, sy, 90)
  sg.addColorStop(0, 'rgba(255,221,140,0.95)')
  sg.addColorStop(1, 'rgba(255,221,140,0)')
  ctx.fillStyle = sg
  ctx.beginPath()
  ctx.arc(sx, sy, 90, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#ffd98c'
  ctx.beginPath()
  ctx.arc(sx, sy, 26, 0, Math.PI * 2)
  ctx.fill()

  // 云朵（几团叠加的半透明白圆）
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  const clouds = [
    [W * 0.2, H * 0.22, 1],
    [W * 0.55, H * 0.12, 0.8],
    [W * 0.38, H * 0.34, 0.6],
  ]
  for (const [cx, cy, s] of clouds) {
    for (const [dx, dy, r] of [[0, 0, 22], [22, 6, 18], [-22, 6, 18], [10, -8, 16]]) {
      ctx.beginPath()
      ctx.arc(cx + dx * s, cy + dy * s, r * s, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // 远处山丘（两层，增加层次）
  ctx.fillStyle = 'rgba(91,140,123,0.35)'
  ctx.beginPath()
  ctx.moveTo(0, H * 0.78)
  ctx.quadraticCurveTo(W * 0.25, H * 0.66, W * 0.5, H * 0.78)
  ctx.quadraticCurveTo(W * 0.75, H * 0.9, W, H * 0.76)
  ctx.lineTo(W, H)
  ctx.lineTo(0, H)
  ctx.closePath()
  ctx.fill()

  // 地面（草皮带 + 泥土）
  const gh = cfg.world.groundHeight
  ctx.fillStyle = '#7bbf6a'
  ctx.fillRect(0, H - gh, W, gh)
  ctx.fillStyle = '#6aa85b'
  ctx.fillRect(0, H - gh, W, 8)
  // 草地上的小条纹（让地面有“移动”感由 pipes 体现，这里只做装饰）
  ctx.fillStyle = 'rgba(0,0,0,0.06)'
  for (let x = 0; x < W; x += 26) {
    ctx.fillRect(x, H - gh + 14, 13, 4)
  }
  ctx.fillStyle = '#caa46a'
  ctx.fillRect(0, H - gh + gh * 0.5, W, gh * 0.5)
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

// 调试：碰撞盒可视化（红框 + 半透明填充）。x/y/w/h 为判定矩形（已含 collidePad 收缩）。
function drawHitboxRect(ctx, x, y, w, h) {
  ctx.save()
  ctx.strokeStyle = 'rgba(255,0,0,0.9)'
  ctx.lineWidth = 2
  ctx.fillStyle = 'rgba(255,0,0,0.15)'
  ctx.fillRect(x, y, w, h)
  ctx.strokeRect(x, y, w, h)
  ctx.restore()
}

export function draw(ctx, state, cfg, images) {
  const W = cfg.view.width
  const H = cfg.view.height
  if (!W || !H) return

  // 静态场景（天空+云+山+地面）：一次性预渲染并缓存，每帧只贴一张图
  try {
    const bg = getStaticBackground(cfg)
    if (bg) ctx.drawImage(bg, 0, 0, W, H)
    else paintStaticScene(ctx, cfg, W, H)
  } catch (e) {
    /* 背景失败不阻断 */
  }

  // 管道
  try {
    const groundY = H - cfg.world.groundHeight
    for (const p of state.pipes) {
      const pw = p.width ?? cfg.pipes.width
      drawPipe(ctx, p.x, p.gapTop, p.gapBottom, pw, groundY, cfg)
    }
  } catch (e) {
    /* 管道失败不阻断 */
  }

  // 小鸟
  try {
    drawBird(ctx, state, cfg, images ? images.sprite : null)
  } catch (e) {
    console.error('[fly:render] bird error', e)
  }

  // 过场提示（直接画在画布上，不挡点击）：飞入引导 / 续玩倒计时
  try {
    if (state.entering) drawEnterHint(ctx, state, cfg)
    if (state.countdown > 0) drawCountdown(ctx, state, cfg)
  } catch (e) {
    /* 提示失败不阻断 */
  }
}

// 飞入过场中的引导文字（点击屏幕开始）；画在画面中部偏下，半透明描边，不拦截点击
function drawEnterHint(ctx, state, cfg) {
  const W = cfg.view.width
  const H = cfg.view.height
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = 'bold 26px sans-serif'
  ctx.lineWidth = 4
  ctx.strokeStyle = 'rgba(0,0,0,0.45)'
  ctx.strokeText('点击屏幕开始', W / 2, H * 0.72)
  ctx.fillStyle = 'rgba(255,255,255,0.95)'
  ctx.fillText('点击屏幕开始', W / 2, H * 0.72)
  ctx.restore()
}

// 续玩倒计时（3-2-1）：大号数字 + 脉冲圆环，每秒“弹”一下
function drawCountdown(ctx, state, cfg) {
  const W = cfg.view.width
  const H = cfg.view.height
  const n = Math.ceil(state.countdown)
  const frac = state.countdown - Math.floor(state.countdown) // 当前秒内的进度 0..1
  const scale = 1 + (1 - frac) * 0.45 // 整数秒时 1.45 → 渐缩到 1.0，跳动感
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.globalAlpha = 0.5
  ctx.strokeStyle = 'rgba(255,255,255,0.95)'
  ctx.lineWidth = 6
  ctx.beginPath()
  ctx.arc(W / 2, H / 2, 64 * scale, 0, Math.PI * 2)
  ctx.stroke()
  ctx.globalAlpha = 1
  ctx.fillStyle = '#fff'
  ctx.font = `900 ${Math.round(76 * scale)}px sans-serif`
  ctx.shadowColor = 'rgba(0,0,0,0.4)'
  ctx.shadowBlur = 12
  ctx.fillText(String(n), W / 2, H / 2)
  ctx.restore()
}

function drawPipe(ctx, x, gapTop, gapBottom, pw, groundY, cfg) {
  const body = '#5b8c4b'
  const rim = '#3f6b34'
  const light = '#7bbf6a'
  // 上管道（从顶到 gapTop）
  pipeBody(ctx, x, 0, pw, gapTop, groundY, body, rim, light, true)
  // 下管道（从 gapBottom 到地面）
  pipeBody(ctx, x, gapBottom, pw, groundY - gapBottom, groundY, body, rim, light, false)

  // 调试：管道碰撞盒（红框）。与引擎判定一致：上管 {x,0,w,gapTop}、下管 {x,gapBottom,w,groundY-gapBottom}，
  // 并应用 collidePad 收缩（pad 为正 → 判定矩形向内收，故这里也收 pad）。
  if (cfg.debug?.showHitbox) {
    const pad = cfg.collidePad || 0
    drawHitboxRect(ctx, x + pad, pad, pw - 2 * pad, gapTop - 2 * pad)
    drawHitboxRect(ctx, x + pad, gapBottom + pad, pw - 2 * pad, groundY - gapBottom - 2 * pad)
  }
}

function pipeBody(ctx, x, y, pw, h, groundY, body, rim, light, isTop) {
  if (h <= 0) return
  // 主干
  const g = ctx.createLinearGradient(x, 0, x + pw, 0)
  g.addColorStop(0, rim)
  g.addColorStop(0.5, light)
  g.addColorStop(1, body)
  ctx.fillStyle = g
  ctx.fillRect(x, y, pw, h)
  // 高光
  ctx.fillStyle = 'rgba(255,255,255,0.25)'
  ctx.fillRect(x + pw * 0.18, y, pw * 0.16, h)
  // 管口（粗一圈的帽）
  const capH = 22
  const capY = isTop ? y + h - capH : y
  ctx.fillStyle = body
  ctx.fillRect(x - 4, capY, pw + 8, capH)
  ctx.fillStyle = rim
  ctx.fillRect(x - 4, isTop ? capY : capY + capH - 5, pw + 8, 5)
  ctx.fillStyle = 'rgba(255,255,255,0.2)'
  ctx.fillRect(x - 4 + pw * 0.18, capY, (pw + 8) * 0.16, capH)
}

function drawBird(ctx, state, cfg, sprite) {
  const W = cfg.view.width
  const H = cfg.view.height
  // 飞入过场中 birdX 为插值横坐标；正常游戏 birdX 恒为 W*birdXFrac（step 已同步）
  const bx = Number.isFinite(state.birdX) ? state.birdX : W * state.birdXFrac
  const birdW = cfg.character.frame.width * cfg.character.scale
  const birdH = cfg.character.frame.height * cfg.character.scale

  // 俯仰角：上升抬头、下落低头（死亡时固定低头）
  let angle
  if (state.gameOver) angle = 1.35
  else angle = Math.max(-0.5, Math.min(1.2, state.vy / cfg.bird.flapImpulse) * 0.5)

  // 翅膀拍动帧
  let frame = cfg.character.anim.idle[0]
  if (sprite && sprite.complete && sprite.naturalWidth) {
    const cols = cfg.character.sheet.cols
    const fw = sprite.naturalWidth / cols
    const fh = sprite.naturalHeight / cfg.character.sheet.rows
    const frames = cfg.character.anim.fly
    frame = frames[Math.floor(state.animTime * cfg.character.fps) % frames.length]
    const sx = (frame % cols) * fw
    const sy = Math.floor(frame / cols) * fh
    ctx.save()
    ctx.translate(bx, state.birdY)
    ctx.rotate(angle)
    ctx.drawImage(sprite, sx, sy, fw, fh, -birdW / 2, -birdH / 2, birdW, birdH)
    ctx.restore()
  } else {
    // 占位（图未加载）
    ctx.save()
    ctx.translate(bx, state.birdY)
    ctx.rotate(angle)
    ctx.fillStyle = '#c9743b'
    roundRect(ctx, -birdW / 2, -birdH / 2, birdW, birdH, 12)
    ctx.fill()
    ctx.restore()
  }

  // 调试：碰撞体可视化。优先画「像素级轮廓」（红色半透明，贴合角色实际范围）；
  // 无掩码时回退到矩形红框。
  if (cfg.debug?.showHitbox) {
    const m = cfg.character.mask
    if (m && m.redCanvas && sprite && sprite.complete && sprite.naturalWidth) {
      const cols = cfg.character.sheet.cols
      const rows = cfg.character.sheet.rows
      const fw = sprite.naturalWidth / cols
      const fh = sprite.naturalHeight / rows
      const sx = (frame % cols) * fw
      const sy = Math.floor(frame / cols) * fh
      ctx.save()
      ctx.translate(bx, state.birdY)
      ctx.rotate(angle)
      ctx.drawImage(m.redCanvas, sx, sy, fw, fh, -birdW / 2, -birdH / 2, birdW, birdH)
      ctx.restore()
    } else {
      const hb = cfg.bird.hitbox
      const hbW = birdW * hb.w
      const hbH = birdH * hb.h
      drawHitboxRect(ctx, bx - hbW / 2, state.birdY - hbH / 2, hbW, hbH)
    }
  }
}
