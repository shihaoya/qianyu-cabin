// 千羽爬树 · Canvas 2D 渲染（只画，不含逻辑；PC/移动端共用同一份）
// 树、虫子、道具、人物全部用代码绘制；人物从精灵图按帧裁切。
import { charScreenX, charJumpArc } from './engine.js'

// 第 i 棵树中心的屏幕 x（与引擎 treeCenterX 保持一致）
export function treeX(i, cfg) {
  const n = cfg.world.treeCount
  return (cfg.view.width * (i + 1)) / (n + 1)
}

// 第 lane 个横向位置（某棵树左/右）的屏幕 x（与引擎 laneX 保持一致）
export function laneX(lane, cfg) {
  const treeIndex = Math.floor(lane / 2)
  const side = lane % 2 === 0 ? -1 : 1
  return treeX(treeIndex, cfg) + side * cfg.world.sideOffset
}

export function draw(ctx, state, cfg, images) {
  const W = cfg.view.width
  const H = cfg.view.height
  if (!W || !H) return

  // 背景天空
  try {
    const g = ctx.createLinearGradient(0, 0, 0, H)
    g.addColorStop(0, '#cfe8df')
    g.addColorStop(1, cfg.view.background)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
  } catch (e) { renderError(ctx, W, H, 'bg', e); return }

  // 地面
  try {
    const gh = cfg.world.groundHeight
    ctx.fillStyle = '#d9c9a3'
    ctx.fillRect(0, H - gh, W, gh)
    ctx.fillStyle = '#c9b98a'
    ctx.fillRect(0, H - gh, W, 4)
  } catch (e) { renderError(ctx, W, H, 'ground', e); return }

  // 树（仅树干：上窄下宽 + 树皮纹理 + 根部 + 树瘤；固定区域不滚动；不画叶子，避免显得假）
  try {
    const tw = cfg.world.trunkWidth
    for (let i = 0; i < cfg.world.treeCount; i++) {
      const x = treeX(i, cfg)
      const halfTop = tw / 2
      const halfBot = tw / 2 * 1.28 // 根部稍宽，更自然
      // 树干主体（梯形，圆柱体积感）
      const g = ctx.createLinearGradient(x - halfTop, 0, x + halfTop, 0)
      g.addColorStop(0, '#5b3a1a')
      g.addColorStop(0.5, cfg.world.trunkColor)
      g.addColorStop(1, '#5b3a1a')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.moveTo(x - halfTop, 0)
      ctx.lineTo(x + halfTop, 0)
      ctx.lineTo(x + halfBot, H)
      ctx.lineTo(x - halfBot, H)
      ctx.closePath()
      ctx.fill()
      // 树皮竖纹（带轻微弯曲）
      ctx.strokeStyle = 'rgba(60,38,16,0.35)'
      ctx.lineWidth = 2
      const offsets = [-tw * 0.26, 0, tw * 0.26]
      for (const o of offsets) {
        ctx.beginPath()
        ctx.moveTo(x + o, 0)
        let yy = 0
        while (yy < H) {
          yy += 26
          ctx.lineTo(x + o + Math.sin(yy * 0.12 + i * 1.7) * 3, yy)
        }
        ctx.stroke()
      }
      // 树瘤（几个小椭圆点缀）
      ctx.fillStyle = 'rgba(60,38,16,0.3)'
      for (let k = 1; k <= 4; k++) {
        const ky = (H * k) / 5 + ((i * 37) % 30) - 15
        ctx.beginPath()
        ctx.ellipse(x + (k % 2 ? 7 : -7), ky, 5, 7, 0, 0, Math.PI * 2)
        ctx.fill()
      }
      // 根部（底部向外散开，增强“扎根地面”感）
      ctx.fillStyle = '#6f4420'
      for (const s of [-1, 1]) {
        ctx.beginPath()
        ctx.moveTo(x, H - 2)
        ctx.lineTo(x + s * halfBot, H)
        ctx.lineTo(x + s * (halfBot + 22), H)
        ctx.lineTo(x + s * (halfBot + 6), H - 16)
        ctx.closePath()
        ctx.fill()
      }
    }
  } catch (e) { renderError(ctx, W, H, 'tree', e); return }

  // 道具（带光晕；贴图优先，缺图回退到代码绘制）
  try {
    const isz = cfg.items.size
    for (const item of state.items) {
      const sy = H - item.y
      if (sy < -isz || sy > H + isz) continue
      ctx.save()
      ctx.globalAlpha = 0.33
      ctx.fillStyle = item.color
      ctx.beginPath()
      ctx.arc(item.x, sy, isz * 0.72, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
      const img = images?.items?.[item.type]
      if (img && img.complete && img.naturalWidth) drawImageItem(ctx, item.x, sy, isz, img)
      else drawItem(ctx, item.x, sy, item, isz)
    }
  } catch (e) { /* 道具失败不阻断 */ }

  // 虫子（按所在 lane 定位在该树左/右侧；贴图优先，缺图回退到代码绘制）
  try {
    const bscale = cfg.bugs.imageScale || 1
    for (const bug of state.bugs) {
      const sy = H - bug.y
      if (sy < -30 || sy > H + 30) continue
      const x = laneX(bug.lane, cfg)
      const img = images?.bugs?.[bug.type]
      if (img && img.complete && img.naturalWidth) {
        const s = bug.radius * 2.4 * bscale // 按 imageScale 放大贴图
        const flip = bug.lane % 2 === 1 // 树右侧 → 水平翻转贴图，面向树干
        drawImageBug(ctx, x, sy, s, img, flip)
      }
      else if (bug.killable) drawBug(ctx, x, sy, bug.radius, bug.color)
      else drawArmored(ctx, x, sy, bug.radius, bug.color)
    }
  } catch (e) { /* 虫子失败不阻断 */ }

  // 人物
  try {
    drawCharacter(ctx, state, cfg, images ? images.sprite : null)
  } catch (e) { renderError(ctx, W, H, 'char', e) }

  // 飘字提示（击落/扣血/接道具）
  try {
    drawFloaters(ctx, state)
  } catch (e) { /* 不阻断 */ }
}

function renderError(ctx, W, H, phase, err) {
  console.error('[climb:render] error at phase=' + phase, err)
  ctx.fillStyle = '#e74c3c'
  ctx.font = '14px monospace'
  ctx.textAlign = 'center'
  ctx.fillText('RENDER ERROR (' + phase + ') – open console for details', W / 2, H / 2)
}

function drawCharacter(ctx, state, cfg, sprite) {
  const charW = cfg.character.frame.width * cfg.character.scale
  const charH = cfg.character.frame.height * cfg.character.scale
  // 角色站在某棵树的某一侧（离散 lane）；上下连续攀爬用 h；切树时做一次快速跳跃弧线
  const cxRaw = charScreenX(state, cfg)
  const arch = charJumpArc(state, cfg) // 跳跃拱起（世界坐标，向上为正），让角色划弧掠过两树间隙
  const feetYRaw = cfg.view.height - (state.h + arch)
  // 钳制：水平按中心、垂直按顶/底，保证角色始终完整在画面内（不超出屏幕）
  const cx = Math.max(charW / 2, Math.min(cfg.view.width - charW / 2, cxRaw))
  const drawY = Math.max(0, Math.min(cfg.view.height - charH, feetYRaw - charH))
  const feetY = drawY + charH
  const flipped = state.lane % 2 === 1 // 树的右侧 → 面向树，水平翻转

  // 护盾光环（对称，无需翻转）
  if (state.shieldRemainingMs > 0) {
    ctx.save()
    ctx.globalAlpha = 0.35
    ctx.fillStyle = '#3f7cac'
    ctx.beginPath()
    ctx.ellipse(cx, drawY + charH / 2, charW * 0.75, charH * 0.6, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  // 下滑攻击特效（明显可见）：脉动橙色光环 + 向下速度线 + 头顶标签
  if (state.attacking) {
    // 光环
    ctx.save()
    const pulse = 0.5 + 0.28 * Math.sin(state.animTime * 22)
    const grd = ctx.createRadialGradient(cx, drawY + charH * 0.5, charW * 0.15, cx, drawY + charH * 0.5, charW * 1.15)
    grd.addColorStop(0, 'rgba(255,150,80,0)')
    grd.addColorStop(0.65, `rgba(255,150,80,${0.3 + 0.22 * pulse})`)
    grd.addColorStop(1, 'rgba(201,116,59,0)')
    ctx.fillStyle = grd
    ctx.beginPath()
    ctx.ellipse(cx, drawY + charH * 0.5, charW * 1.1, charH * 0.72, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    // 向下速度线（俯冲感）
    ctx.save()
    ctx.strokeStyle = 'rgba(255,170,90,0.9)'
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    const t = (state.animTime * 240) % 28
    for (let i = 0; i < 4; i++) {
      const lx = cx + (i - 1.5) * 13
      const ly = drawY + charH * 0.5 + ((t + i * 7) % 28)
      ctx.beginPath()
      ctx.moveTo(lx, ly)
      ctx.lineTo(lx, ly + 13)
      ctx.stroke()
    }
    ctx.restore()

    // 头顶「下滑攻击!」标签
    ctx.save()
    ctx.font = 'bold 14px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    const lbl = '下滑攻击!'
    const tw = ctx.measureText(lbl).width
    ctx.fillStyle = 'rgba(0,0,0,0.35)'
    roundRect(ctx, cx - tw / 2 - 6, drawY - 24, tw + 12, 20, 8)
    ctx.fill()
    ctx.fillStyle = '#ffce8a'
    ctx.fillText(lbl, cx, drawY - 6)
    ctx.restore()
  }

  // 精灵图（或占位）；站在树右侧时以角色中心水平翻转，面向树干
  if (sprite && sprite.complete && sprite.naturalWidth) {
    const cols = cfg.character.sheet.cols
    const fw = sprite.naturalWidth / cols
    const fh = sprite.naturalHeight / cfg.character.sheet.rows
    // 动画帧选择：slide 用 slide 帧；climbDown 用 climb 帧逆序；climbUp 正序；idle 单帧静止
    const am = cfg.character.anim
    let frames
    if (state.anim === 'slide') frames = am.slide
    else if (state.anim === 'climbDown') frames = am.climb.slice().reverse()
    else if (state.anim === 'climbUp') frames = am.climb
    else frames = am.idle
    const f = frames[Math.floor(state.animTime * cfg.character.fps) % frames.length]
    const sx = (f % cols) * fw
    const sy = Math.floor(f / cols) * fh
    ctx.save()
    ctx.translate(cx, 0)
    if (flipped) ctx.scale(-1, 1)
    ctx.drawImage(sprite, sx, sy, fw, fh, -charW / 2, drawY, charW, charH)
    ctx.restore()
  } else {
    // 占位（图未加载时）
    ctx.fillStyle = '#c9743b'
    roundRect(ctx, cx - charW / 2, drawY, charW, charH, 10)
    ctx.fill()
  }

  // 受击红闪
  if (state.hitFlash > 0) {
    ctx.save()
    ctx.globalAlpha = Math.min(0.6, state.hitFlash * 1.6)
    ctx.fillStyle = '#e74c3c'
    roundRect(ctx, cx - charW / 2, drawY, charW, charH, 10)
    ctx.fill()
    ctx.restore()
  }
}

function drawBug(ctx, x, y, r, color) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.ellipse(x, y, r * 0.8, r, 0, 0, Math.PI * 2)
  ctx.fill()
  // 腿
  ctx.strokeStyle = '#3f5e36'
  ctx.lineWidth = 2
  for (const s of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + s * (r + 4), y - 4)
    ctx.moveTo(x, y + 4)
    ctx.lineTo(x + s * (r + 4), y + 6)
    ctx.stroke()
  }
  // 眼睛
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.arc(x - 4, y - 3, 3, 0, Math.PI * 2)
  ctx.arc(x + 4, y - 3, 3, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#222'
  ctx.beginPath()
  ctx.arc(x - 4, y - 3, 1.5, 0, Math.PI * 2)
  ctx.arc(x + 4, y - 3, 1.5, 0, Math.PI * 2)
  ctx.fill()
}

function drawArmored(ctx, x, y, r, color) {
  ctx.fillStyle = color
  ctx.beginPath()
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 2
    const px = x + Math.cos(a) * r
    const py = y + Math.sin(a) * r
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)
  }
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = '#5b4b52'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x - r * 0.5, y - r * 0.3)
  ctx.lineTo(x + r * 0.5, y - r * 0.3)
  ctx.moveTo(x - r * 0.5, y + r * 0.3)
  ctx.lineTo(x + r * 0.5, y + r * 0.3)
  ctx.stroke()
}

// 用用户提供的贴图绘制虫子 / 掉落物（缺图时由 drawBug/drawArmored/drawItem 回退）
function drawImageBug(ctx, x, y, s, img, flip) {
  ctx.save()
  ctx.translate(x, y)
  if (flip) ctx.scale(-1, 1) // 树右侧水平翻转，面向树干
  ctx.drawImage(img, -s / 2, -s / 2, s, s)
  ctx.restore()
}
function drawImageItem(ctx, x, y, size, img) {
  const s = size * 1.15
  ctx.drawImage(img, x - s / 2, y - s / 2, s, s)
}

function drawBadge(ctx, x, y, color, label, size = 36) {
  ctx.save()
  ctx.fillStyle = color
  roundRect(ctx, x - size / 2, y - size / 2, size, size, 8)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.fillStyle = '#fff'
  ctx.font = `bold ${Math.round(size * 0.4)}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, x, y + 1)
  ctx.restore()
}

// 掉落物图标（缺图时的回退绘制）：回血=心形，护盾=盾形
function drawItem(ctx, x, y, item, size) {
  if (item.effect === 'heal') drawHeart(ctx, x, y, size * 0.5, item.color)
  else drawShieldIcon(ctx, x, y, size * 0.48, item.color)
}

function drawHeart(ctx, x, y, r, color) {
  ctx.save()
  ctx.translate(x, y)
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(0, r * 0.45)
  ctx.bezierCurveTo(r * 1.1, -r * 0.2, r * 0.6, -r * 1.05, 0, -r * 0.35)
  ctx.bezierCurveTo(-r * 0.6, -r * 1.05, -r * 1.1, -r * 0.2, 0, r * 0.45)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.restore()
}

function drawShieldIcon(ctx, x, y, r, color) {
  ctx.save()
  ctx.translate(x, y)
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(0, -r)
  ctx.lineTo(r * 0.85, -r * 0.55)
  ctx.lineTo(r * 0.85, r * 0.2)
  ctx.quadraticCurveTo(r * 0.85, r * 0.95, 0, r)
  ctx.quadraticCurveTo(-r * 0.85, r * 0.95, -r * 0.85, r * 0.2)
  ctx.lineTo(-r * 0.85, -r * 0.55)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.restore()
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

function drawFloaters(ctx, state) {
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const f of state.floaters || []) {
    const a = Math.max(0, Math.min(1, f.life / f.maxLife))
    ctx.globalAlpha = a
    ctx.font = `bold ${f.size}px sans-serif`
    ctx.lineWidth = 3
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'
    ctx.strokeText(f.text, f.x, f.y)
    ctx.fillStyle = f.color
    ctx.fillText(f.text, f.x, f.y)
  }
  ctx.restore()
}
