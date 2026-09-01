<!--
@doc
name: SlapGame
path: src/views/games/SlapGame.vue
category: business
appliesTo: PC
purpose: 打是亲（PC）。蔷薇与椿式互扇：按住画面左右划动挥巴掌，划得越快越响，连续抽中攒连击。
         逻辑/渲染走 @cabin/games/slap/{engine,render}.js（与移动端同一份）。
         纯娱乐：无开始/结束、无暂停、无排行榜与历史，进去就能抽，刷新即重来。
-->
<script setup>
import { onMounted, onBeforeUnmount, ref, reactive, computed } from 'vue'
import BaseButton from '../../components/base/BaseButton.vue'
import config from '../../games/slap/config.js'
import { createInitialState, step, setHandPos, setHandOff, slapByKey } from '@cabin/games/slap/engine.js'
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

function resize() {
  const c = canvasRef.value
  if (!c) return
  const rect = c.getBoundingClientRect()
  if (!rect.width || !rect.height) return
  const dpr = window.devicePixelRatio || 1
  c.width = Math.round(rect.width * dpr)
  c.height = Math.round(rect.height * dpr)
  config.view.width = Math.round(rect.width)
  config.view.height = Math.round(rect.height)
  const ctx = c.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}

function loop(ts) {
  raf = requestAnimationFrame(loop)
  if (last == null) last = ts
  const dt = (ts - last) / 1000
  last = ts
  // 说明面板打开时冻结画面（此时本来也划不动）
  if (!helpOpen.value) step(state, dt, config)
  const ctx = canvasRef.value?.getContext('2d')
  if (ctx) draw(ctx, state, config, images)
}

// ── 输入：手掌实时跟着光标走，划过千羽的脸就是一巴掌 ──
// 鼠标移上去就直接跟，不需要按住；触摸/手写笔则需按住拖动（没有 hover）。
function toCanvasPos(e) {
  const c = canvasRef.value
  if (!c) return null
  const r = c.getBoundingClientRect()
  return { x: e.clientX - r.left, y: e.clientY - r.top }
}

let dragging = false

function onDown(e) {
  if (e.pointerType !== 'mouse') dragging = true
  const p = toCanvasPos(e)
  if (p) setHandPos(state, p.x, p.y, true)
}
function onMove(e) {
  if (e.pointerType !== 'mouse' && !dragging) return
  const p = toCanvasPos(e)
  if (p) setHandPos(state, p.x, p.y, true)
}
function onUp() {
  dragging = false
}
function onLeave(e) {
  if (e.pointerType === 'mouse') setHandOff(state)
}

function onKeyDown(e) {
  const k = e.key.toLowerCase()
  if (k === 'arrowright') {
    e.preventDefault()
    slapByKey(state, 1, config)
  } else if (k === 'arrowleft') {
    e.preventDefault()
    slapByKey(state, -1, config)
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('resize', resize)
  resize()
  const ctx = canvasRef.value?.getContext('2d')
  if (ctx) draw(ctx, state, config, images)
  for (const im of Object.values(images)) {
    im.onload = () => {
      const c = canvasRef.value?.getContext('2d')
      if (c) draw(c, state, config, images)
    }
  }
  last = null
  raf = requestAnimationFrame(loop)
})

onBeforeUnmount(() => {
  if (raf) cancelAnimationFrame(raf)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('resize', resize)
})
</script>

<template>
  <div class="slap-game">
    <div class="sg-stage">
      <canvas
        ref="canvasRef"
        class="sg-canvas"
        @pointerdown.prevent="onDown"
        @pointerenter="onMove"
        @pointermove="onMove"
        @pointerup="onUp"
        @pointercancel="onUp"
        @pointerleave="onLeave"
      />

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

      <div v-if="helpOpen" class="sg-overlay">
        <div class="sg-help">
          <h3>玩法说明</h3>
          <ul class="sg-help__rules">
            <li v-for="(t, i) in config.help" :key="i">{{ t }}</li>
          </ul>
          <BaseButton type="primary" @click="helpOpen = false">知道了</BaseButton>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.slap-game {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.sg-stage {
  position: relative;
  flex: 1;
  min-height: 0;
  width: 100%;
  overflow: hidden;
}
.sg-canvas {
  display: block;
  width: 100%;
  height: 100%;
  cursor: none; /* 手掌就是光标，隐藏系统指针 */
  touch-action: none; /* 划动抽巴掌时不触发页面滚动/缩放 */
  user-select: none;
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
  font-size: 34px;
  color: #fff;
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
  line-height: 1;
}
.sg-right {
  display: flex;
  align-items: center;
  gap: 8px;
  pointer-events: auto;
}
.sg-stat__chip {
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  font-size: 13px;
  color: #fff;
  background: rgba(0, 0, 0, 0.25);
  padding: 4px 10px;
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
.sg-help-btn:hover {
  background: rgba(0, 0, 0, 0.4);
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
.sg-help {
  background: var(--surface);
  border-radius: var(--radius);
  padding: 20px 22px;
  width: min(420px, 90%);
  max-height: 86%;
  overflow-y: auto;
  text-align: left;
}
.sg-help h3 {
  margin: 0 0 10px;
  font-family: var(--font-display);
}
.sg-help__rules {
  margin: 0 0 14px;
  padding-left: 18px;
  color: var(--text);
  font-size: 13px;
  line-height: 1.7;
}
</style>
