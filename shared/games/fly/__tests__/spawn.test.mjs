// 像素鸟 · 管道生成合理性测试
// 直接驱动真实引擎逻辑（engine.js 的 spawnPipe），验证：
//   1) 缝隙完整在屏内（不被屏幕裁切 / 不贴地、不贴顶）
//   2) 相邻管道缝隙中心有明显上下随机变化（一根在顶、一根在底）
//   3) 相邻缝隙中心位移 ≤ maxGapShift（鸟在水平时间内飞得过去）
// 同时用「旧的中心夹取逻辑」做对照，直观展示修复前后的差异。
//
// 运行：node shared/games/fly/__tests__/spawn.test.mjs

import assert from 'node:assert'
import { spawnPipe } from '../engine.js'

// ── 构造与真实配置等价的 cfg（不引入 @cabin 资源别名，纯逻辑）──
function makeCfg({ view, groundHeight, scale, xFrac, pipes }) {
  return {
    view,
    collidePad: 4,
    character: { frame: { width: 360, height: 360 }, scale, hitbox: { w: 0.62, h: 0.62 } },
    bird: { xFrac, flapImpulse: 430, gravity: 1500, maxFallVy: 720, hitbox: { w: 0.62, h: 0.62 } },
    pipes,
    world: { groundHeight },
  }
}

const PC_PIPES = {
  width: 80, widthMin: 58, widthMax: 108,
  gap: 210, gapMin: 160, gapMax: 250, gapMargin: 70, maxGapShift: 210,
  spacing: 320, spacingMin: 280, spacingMax: 400, speed: 160,
}
const MOBILE_PIPES = {
  width: 80, widthMin: 46, widthMax: 84,
  gap: 160, gapMin: 160, gapMax: 240, gapMargin: 70, maxGapShift: 150,
  spacing: 260, spacingMin: 230, spacingMax: 340, speed: 150,
}

const SCENARIOS = [
  { name: 'PC（480×640）', cfg: makeCfg({ view: { width: 480, height: 640 }, groundHeight: 96, scale: 0.3, xFrac: 0.3, pipes: PC_PIPES }) },
  { name: '手机竖屏-矮（730×390）', cfg: makeCfg({ view: { width: 730, height: 390 }, groundHeight: 60, scale: 0.16, xFrac: 0.28, pipes: MOBILE_PIPES }) },
  { name: '手机横屏-高（390×730）', cfg: makeCfg({ view: { width: 390, height: 730 }, groundHeight: 60, scale: 0.16, xFrac: 0.28, pipes: MOBILE_PIPES }) },
  { name: '极端矮屏（730×300）', cfg: makeCfg({ view: { width: 730, height: 300 }, groundHeight: 60, scale: 0.16, xFrac: 0.28, pipes: MOBILE_PIPES }) },
]

// ── 旧逻辑（修复前的「中心夹取」）复刻，仅用于对照展示 ──
function spawnPipeOld(state, cfg, x) {
  const H = cfg.view.height
  const groundY = H - cfg.world.groundHeight
  const margin = cfg.pipes.gapMargin
  const minC = margin
  const maxC = groundY - margin
  const gMin = cfg.pipes.gapMin ?? cfg.pipes.gap
  const gMax = cfg.pipes.gapMax ?? cfg.pipes.gap
  const gap = gMin + Math.random() * Math.max(1, gMax - gMin)
  let center
  const prev = state.pipes[state.pipes.length - 1]
  if (!prev || !Number.isFinite(prev.gapCenter)) center = minC + Math.random() * Math.max(1, maxC - minC)
  else {
    const shift = (Math.random() * 2 - 1) * (cfg.pipes.maxGapShift ?? 200)
    center = prev.gapCenter + shift
  }
  center = Math.max(minC, Math.min(maxC, center))
  const width = cfg.pipes.widthMin + Math.random() * Math.max(1, cfg.pipes.widthMax - cfg.pipes.widthMin)
  const spacing = cfg.pipes.spacingMin + Math.random() * Math.max(1, cfg.pipes.spacingMax - cfg.pipes.spacingMin)
  state.pipes.push({ x, width, spacing, gapCenter: center, gapTop: Math.max(0, center - gap / 2), gapBottom: Math.min(groundY, center + gap / 2), scored: false })
}

function runSpawn(fn, cfg, n) {
  const state = { pipes: [] }
  for (let i = 0; i < n; i++) fn(state, cfg, 1000 + i * 300)
  return state.pipes
}

function stats(pipes, cfg) {
  const groundY = cfg.view.height - cfg.world.groundHeight
  const centers = pipes.map((p) => p.gapCenter)
  const gaps = pipes.map((p) => p.gapBottom - p.gapTop)
  let clipped = 0
  let minTopClear = Infinity
  let minBotClear = Infinity
  let minGap = Infinity
  for (const p of pipes) {
    if (p.gapTop < 0 || p.gapBottom > groundY) clipped++
    minTopClear = Math.min(minTopClear, p.gapTop)
    minBotClear = Math.min(minBotClear, groundY - p.gapBottom)
    minGap = Math.min(minGap, p.gapBottom - p.gapTop)
  }
  let maxShift = 0
  for (let i = 1; i < pipes.length; i++) maxShift = Math.max(maxShift, Math.abs(pipes[i].gapCenter - pipes[i - 1].gapCenter))
  const range = (arr) => Math.max(...arr) - Math.min(...arr)
  const mean = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length
  const std = (arr) => {
    const m = mean(arr)
    return Math.sqrt(mean(arr.map((v) => (v - m) ** 2)))
  }
  return {
    groundY,
    n: pipes.length,
    clipped,
    minTopClear: Math.round(minTopClear),
    minBotClear: Math.round(minBotClear),
    minGap: Math.round(minGap),
    centerRange: Math.round(range(centers)),
    centerStd: Math.round(std(centers)),
    gapRange: Math.round(range(gaps)),
    maxShift: Math.round(maxShift),
    cfgMaxShift: cfg.pipes.maxGapShift,
  }
}

const N = 4000
let failed = false
console.log(`\n=== 像素鸟管道生成合理性测试（每场景生成 ${N} 根管道）===\n`)
for (const sc of SCENARIOS) {
  const newPipes = runSpawn(spawnPipe, sc.cfg, N)
  const oldPipes = runSpawn(spawnPipeOld, sc.cfg, N)
  const s = stats(newPipes, sc.cfg)
  const so = stats(oldPipes, sc.cfg)

  console.log(`【${sc.name}】  groundY=${s.groundY}`)
  console.log(`   新逻辑(边缘自适应): 裁切=${s.clipped}  顶留白min=${s.minTopClear}  底留白min=${s.minBotClear}  最小缝=${s.minGap}  中心极差=${s.centerRange}  中心σ=${s.centerStd}  缝极差=${s.gapRange}  最大位移=${s.maxShift}/${s.cfgMaxShift}`)
  console.log(`   旧逻辑(中心夹取) : 裁切=${so.clipped}  顶留白min=${so.minTopClear}  底留白min=${so.minBotClear}  最小缝=${so.minGap}  中心极差=${so.centerRange}  中心σ=${so.centerStd}  缝极差=${so.gapRange}`)

  // ── 断言（仅针对新逻辑）──
  try {
    assert.strictEqual(s.clipped, 0, '存在被屏幕裁切的管道（缝隙贴顶/贴地）')
    assert.ok(s.minTopClear > 0, '缝隙顶部贴边（留白=0）')
    assert.ok(s.minBotClear > 0, '缝隙底部贴地（留白=0）')
    assert.ok(s.minGap >= 80, `最小可穿越缝隙过小: ${s.minGap}`)
    assert.ok(s.centerRange > 30, `缝隙中心几乎无变化（极差=${s.centerRange}），不随机`)
    assert.ok(s.maxShift <= s.cfgMaxShift + 1, `相邻位移超过 maxGapShift: ${s.maxShift} > ${s.cfgMaxShift}`)
    console.log(`   ✅ 通过：缝隙完整可见、上下随机、且鸟飞得过去\n`)
  } catch (e) {
    failed = true
    console.log(`   ❌ 失败：${e.message}\n`)
  }
}

console.log(failed ? '结果：存在失败项 ❌' : '结果：全部通过 ✅')
process.exit(failed ? 1 : 0)
