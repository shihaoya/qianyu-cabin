// 像素鸟 · 精灵图掩码提取（仅在浏览器 / 有 DOM 环境调用）
// 从精灵图逐帧提取角色实像素（alpha 阈值），生成：
//   - points:    每帧实像素的局部坐标（帧左上角为原点），供引擎做像素级碰撞
//   - redCanvas: 与精灵图同尺寸的「红色轮廓图」，供渲染层可视化碰撞体
// 结果挂到 cfg.character.mask（纯数据，引擎可安全读取，无需 DOM）。

const ALPHA_THRESHOLD = 24 // alpha > 此值视为角色实像素（过滤抗锯齿半透明边缘）

export function prepareSpriteMask(sprite, cfg) {
  if (!sprite || !sprite.complete || !sprite.naturalWidth) return
  const cols = cfg.character.sheet.cols
  const rows = cfg.character.sheet.rows
  const W = sprite.naturalWidth
  const H = sprite.naturalHeight
  const fw = Math.floor(W / cols)
  const fh = Math.floor(H / rows)
  const total = Math.min(cols * rows, cfg.character.sheet.totalFrames || cols * rows)

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  ctx.drawImage(sprite, 0, 0)
  const data = ctx.getImageData(0, 0, W, H).data

  // 红色轮廓图（用于可视化）：与精灵图同尺寸，角色实像素染红半透明
  const rc = document.createElement('canvas')
  rc.width = W
  rc.height = H
  const rctx = rc.getContext('2d')
  const rdata = rctx.createImageData(W, H)

  const points = []
  for (let f = 0; f < total; f++) {
    const cx = f % cols
    const cy = Math.floor(f / cols)
    const ox = cx * fw
    const oy = cy * fh
    const pts = []
    for (let y = 0; y < fh; y++) {
      for (let x = 0; x < fw; x++) {
        const a = data[((oy + y) * W + (ox + x)) * 4 + 3]
        if (a > ALPHA_THRESHOLD) {
          pts.push(x, y)
          const di = ((oy + y) * W + (ox + x)) * 4
          rdata.data[di] = 255
          rdata.data[di + 1] = 0
          rdata.data[di + 2] = 0
          rdata.data[di + 3] = 110
        }
      }
    }
    points.push(pts)
  }
  rctx.putImageData(rdata, 0, 0)

  cfg.character.mask = { frameW: fw, frameH: fh, cols, rows, total, points, redCanvas: rc }
}
