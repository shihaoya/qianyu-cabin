<!--
@doc
name: SlapGame
path: src/views/games/SlapGame.vue
category: business
appliesTo: 移动
purpose: 打是亲（移动端）。蔷薇与椿式互扇：按住画面左右划动挥巴掌，划得越快越响，连续抽中攒连击。
         逻辑/渲染走 @cabin/games/slap/{engine,render}.js（与 PC 同一份）。
         纯娱乐：无开始/结束、无暂停、无排行榜与历史，进去就能抽，刷新即重来。
         画面为竖屏布局（角色居中），无需横屏旋转。
-->
<script setup>
import { onMounted, onBeforeUnmount, ref, reactive } from 'vue'
import BaseButton from '../../components/base/BaseButton.vue'
import config from '../../games/slap/config.js'
import { createInitialState, step, setHandPos, setHandOff } from '@cabin/games/slap/engine.js'
import { draw } from '@cabin/games/slap/render.js'

defineProps({ gameKey: { type: String, required: true } })

const canvasRef = ref(null)
const state = reactive(createInitialState(config))
const helpOpen = ref(false)

// 5 张表情图 + 1 张手掌图；未加载完时渲染层自动回退为代码绘制的占位图形
const images = {}
for (const k of ['idle', 'blink', 'cry', 'angry', 'fly']) {
  const im = new Image()
  im.src = config.character.images[k]
  images[k] = im
}
const handImg = new Image()
handImg.src = config.hand.image
images.hand = handImg

let raf = null
let last = null
let ctx2d = null

function resize() {
  const c = canvasRef.value
  if (!c) return
  // 用 offsetWidth/offsetHeight 取「布局尺寸」，避免被 transform 影响（与移动端其它游戏一致）
  const w = c.offsetWidth
  const h = c.offsetHeight
  if (!w || !h) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  c.width = Math.round(w * dpr)
  c.height = Math.round(h * dpr)
  config.view.width = w
  config.view.height = h
  ctx2d = c.getContext('2d')
  ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0)
}

function loop(ts) {
  raf = requestAnimationFrame(loop)
  if (last == null) last = ts
  const dt = (ts - last) / 1000
  last = ts
  if (!helpOpen.value) step(state, dt, config)
  if (!ctx2d) ctx2d = canvasRef.value?.getContext('2d')
  if (ctx2d) draw(ctx2d, state, config, images)
}

// ── 输入：手指按住拖动，手掌实时跟着走，划过千羽的脸就是一巴掌 ──
// 触摸没有 hover，故必须按住才跟随；松手手掌淡出。
function toCanvasPos(e) {
  const c = canvasRef.value
  if (!c) return null
  const r = c.getBoundingClientRect()
  return { x: e.clientX - r.left, y: e.clientY - r.top }
}

let dragging = false

function onDown(e) {
  dragging = true
  const p = toCanvasPos(e)
  if (p) setHandPos(state, p.x, p.y, true)
}
function onMove(e) {
  if (!dragging) return
  const p = toCanvasPos(e)
  if (p) setHandPos(state, p.x, p.y, true)
}
function onUp() {
  dragging = false
  setHandOff(state)
}

onMounted(() => {
  window.addEventListener('resize', resize)
  window.addEventListener('orientationchange', resize)
  resize()
  if (!ctx2d) ctx2d = canvasRef.value?.getContext('2d')
  if (ctx2d) draw(ctx2d, state, config, images)
  for (const im of Object.values(images)) {
    im.onload = () => {
      if (ctx2d) draw(ctx2d, state, config, images)
    }
  }
  last = null
  raf = requestAnimationFrame(loop)
})

onBeforeUnmount(() => {
  if (raf) cancelAnimationFrame(raf)
  window.removeEventListener('resize', resize)
  window.removeEventListener('orientationchange', resize)
})
</script>

<template>
  <div class="slap-game">
    <div class="sg-stage">
      <canvas
        ref="canvasRef"
        class="sg-canvas"
        @pointerdown.prevent="onDown"
        @pointermove="onMove"
        @pointerup="onUp"
        @pointercancel="onUp"
        @pointerleave="onUp"
      />

      <div v-if="helpOpen" class="sg-overlay">
        <div class="sg-panel">
          <div class="sg-panel__body">
            <h3>玩法说明</h3>
            <ul class="sg-help__rules">
              <li v-for="(t, i) in config.help" :key="i">{{ t }}</li>
            </ul>
          </div>
          <div class="sg-panel__foot">
            <BaseButton type="primary" size="lg" @click="helpOpen = false">知道了</BaseButton>
          </div>
        </div>
      </div>
    </div>

    <div class="sg-hud">
      <div class="sg-stat">
        <span class="sg-stat__label">总力度</span>
        <span class="sg-stat__value">{{ state.totalInt }}</span>
      </div>
      <div class="sg-right">
        <span class="sg-stat__chip">{{ state.slaps }} 下</span>
        <span class="sg-stat__chip">最高 {{ state.maxCombo }} 连</span>
        <span class="sg-stat__chip">打飞 {{ state.flyCount }}</span>
        <button class="sg-help-btn" title="玩法说明" @click="helpOpen = true">?</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.slap-game {
  position: relative; /* 作为 HUD 的定位父级（HUD 是 .sg-stage 的兄弟节点） */
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.sg-stage {
  position: relative;
  flex: 1;
  min-height: 50vh;
  width: 100%;
  overflow: hidden;
}
.sg-canvas {
  display: block;
  width: 100%;
  height: 100%;
  touch-action: none; /* 划动抽巴掌时不触发页面滚动/缩放 */
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}
.sg-hud {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 14px 14px;
  pointer-events: none;
  z-index: 10;
}
.sg-stat {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.sg-stat__label {
  font-size: 13px;
  color: #fff;
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
}
.sg-stat__value {
  font-variant-numeric: tabular-nums;
  font-weight: 900;
  font-size: 30px;
  color: #fff;
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
  line-height: 1;
}
.sg-right {
  display: flex;
  align-items: center;
  gap: 6px;
  pointer-events: auto;
}
.sg-stat__chip {
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  font-size: 12px;
  color: #fff;
  background: rgba(0, 0, 0, 0.25);
  padding: 4px 9px;
  border-radius: 999px;
}
.sg-help-btn {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.25);
  color: #fff;
  font-weight: 700;
  cursor: pointer;
}
.sg-help-btn:active {
  filter: brightness(0.9);
}
.sg-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  background: rgba(40, 30, 20, 0.55);
  backdrop-filter: blur(2px);
  z-index: 5;
}
.sg-panel {
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border-radius: var(--radius);
  max-width: 90%;
  width: 360px;
  max-height: 88%;
  overflow: hidden;
  box-shadow: var(--shadow);
  text-align: left;
}
.sg-panel__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 20px 22px;
}
.sg-panel__body h3 {
  margin: 0 0 10px;
  font-family: var(--font-display);
}
.sg-panel__foot {
  flex-shrink: 0;
  display: flex;
  padding: 12px 22px;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
}
.sg-panel__foot :deep(.base-btn) {
  width: 100%;
}
.sg-help__rules {
  margin: 0;
  padding-left: 18px;
  color: var(--text);
  font-size: 13px;
  line-height: 1.7;
}
</style>
