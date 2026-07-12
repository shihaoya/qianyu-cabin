<!--
@doc
name: ClimbGame
path: src/views/games/ClimbGame.vue
category: business
appliesTo: 移动
purpose: 千羽爬树（移动端）。游戏循环 + Canvas 渲染 + 虚拟按键（上下左右移动，拍击键）。
         逻辑/渲染走 ../climb/{engine,render}.js（与 PC 同一份）；状态契约平台无关，保证跨端续玩。
-->
<script setup>
import { onMounted, onBeforeUnmount, ref, reactive, computed } from 'vue'
import BaseButton from '../../components/base/BaseButton.vue'
import { getGame } from '../../games/registry.js'
import { useGameSave, submitGameRecord, useGameLeaderboard, useGameHistory } from '../../composables/useGame.js'
import { confirm, alert } from '../../composables/useConfirm.js'
import config from '../../games/climb/config.js'
import { createInitialState, serialize, buildResult, step, moveLane, GAME_OVER } from '@cabin/games/climb/engine.js'
import { draw } from '@cabin/games/climb/render.js'

const props = defineProps({ gameKey: { type: String, required: true } })
const emit = defineEmits(['finished'])

const save = useGameSave(props.gameKey)
const canvasRef = ref(null)
const state = reactive(createInitialState(config))
const started = ref(false)
const helpOpen = ref(false)
const lastResult = ref(null)
const pendingSave = ref(null)

// 游戏内面板（排行榜 / 历史 / 说明）互斥弹出；暂停时也能打开，关闭后回到打开前的状态
const game = getGame(props.gameKey)
const boardOpen = ref(false)
const historyOpen = ref(false)
const { list: boardList, total: boardTotal, load: loadBoard } = useGameLeaderboard(props.gameKey)
const { list: historyList, load: loadHistory } = useGameHistory(props.gameKey)
const panelOpen = computed(() => boardOpen.value || historyOpen.value || helpOpen.value)
let resumeRunning = false // 打开面板前游戏是否在跑，关闭后据此恢复（暂停→仍暂停，游戏中→继续）

function platformLabel(p) {
  return p === 'mobile' ? '手机' : '电脑'
}
function openBoard() {
  if (state.gameOver) return
  if (!panelOpen.value) resumeRunning = state.running
  boardOpen.value = true
  historyOpen.value = false
  helpOpen.value = false
  state.running = false
  loadBoard()
}
function closeBoard() {
  boardOpen.value = false
  if (!panelOpen.value && !state.gameOver) state.running = resumeRunning
}
function openHistory() {
  if (state.gameOver) return
  if (!panelOpen.value) resumeRunning = state.running
  historyOpen.value = true
  boardOpen.value = false
  helpOpen.value = false
  state.running = false
  loadHistory()
}
function closeHistory() {
  historyOpen.value = false
  if (!panelOpen.value && !state.gameOver) state.running = resumeRunning
}

const sprite = new Image()
sprite.src = config.character.image

// 预加载虫子 / 掉落物贴图，按 type(key) 建索引交给渲染层
const images = { sprite, bugs: {}, items: {} }
for (const t of config.bugs.types) {
  const im = new Image()
  im.src = t.image
  images.bugs[t.key] = im
}
for (const t of config.items.types) {
  const im = new Image()
  im.src = t.image
  images.items[t.key] = im
}

const paused = computed(
  () =>
    started.value &&
    !state.running &&
    !state.gameOver &&
    !helpOpen.value &&
    !boardOpen.value &&
    !historyOpen.value,
)

// 输入：上/下 连续 + 拍击（持续按住）；左右为离散换 lane，按下触发一次
const held = reactive({ up: false, down: false, attack: false })

let raf = null
let last = null
let autoSaveAcc = 0

// 让画布填满整个舞台（整页即游戏）；内部分辨率跟随显示尺寸与 dpr
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

function formatTime(s) {
  const m = Math.floor(s / 60)
  const ss = Math.floor(s % 60)
  return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

// 历史记录里的日期时间显示（毫秒时间戳或 ISO 字符串 → YYYY-MM-DD HH:mm）
function formatDateTime(v) {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return '—'
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function loop(ts) {
  raf = requestAnimationFrame(loop)
  if (last == null) last = ts
  let dt = (ts - last) / 1000
  last = ts

  if (state.running && !state.gameOver && started.value) {
    const input = { up: held.up, down: held.down, attack: held.attack }
    const events = step(state, dt, input, config)
    if (events.some((e) => e.type === GAME_OVER)) onGameOver()
    autoSaveAcc += dt * 1000
    if (autoSaveAcc >= config.save.autoSaveIntervalMs) {
      autoSaveAcc = 0
      doSave()
    }
  }
  const ctx = canvasRef.value?.getContext('2d')
  if (ctx) draw(ctx, state, config, images)
}

async function doSave() {
  if (state.gameOver) return
  try {
    await save.save(serialize(state), state.score)
  } catch (e) {
    /* 静默 */
  }
}

function togglePause() {
  if (state.gameOver || !started.value) return
  if (panelOpen.value) {
    // 关闭所有面板，回到打开前的状态（暂停或继续）
    boardOpen.value = false
    historyOpen.value = false
    helpOpen.value = false
    state.running = resumeRunning
    return
  }
  state.running = !state.running
  if (!state.running) doSave()
}
function openHelp() {
  if (state.gameOver) return
  if (!panelOpen.value) resumeRunning = state.running
  helpOpen.value = true
  boardOpen.value = false
  historyOpen.value = false
  state.running = false
}
function closeHelp() {
  helpOpen.value = false
  if (!panelOpen.value && !state.gameOver) state.running = resumeRunning
}

async function onGameOver() {
  state.running = false
  const result = buildResult(state)
  lastResult.value = result
  try {
    await submitGameRecord(props.gameKey, result)
    await save.clear()
    emit('finished')
  } catch (e) {
    await alert({ title: '提交失败', message: e.message || '成绩上传失败' })
  }
}

async function restart() {
  lastResult.value = null
  Object.assign(state, createInitialState(config))
  state.startedAt = Date.now() // 记录本局真实开局时间（历史「开始时间」）
  state.running = true
  autoSaveAcc = 0
}

// 虚拟按键：上/下/拍击 持续按住；左/右 按一次换一格
function press(name) {
  if (name === 'left') { if (state.running && !state.gameOver) moveLane(state, -1, config) }
  else if (name === 'right') { if (state.running && !state.gameOver) moveLane(state, 1, config) }
  else if (name === 'up') held.up = true
  else if (name === 'down') held.down = true
  else if (name === 'attack') held.attack = true
}
function release(name) {
  if (name === 'up') held.up = false
  else if (name === 'down') held.down = false
  else if (name === 'attack') held.attack = false
}
// 指针事件兼容触摸与鼠标；阻止默认避免页面滚动/缩放
function onDown(e, name) {
  e.preventDefault()
  press(name)
}
function onUp(e, name) {
  e.preventDefault()
  release(name)
}

function onVisibility() {
  if (document.hidden && state.running && !state.gameOver) {
    state.running = false
    doSave()
  }
}

onMounted(async () => {
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('resize', resize)

  // 让画布填满整个舞台（整页即游戏）
  resize()
  // 进入页面只渲染一帧静态背景（不启动循环），等用户点「开始游戏」
  const ctx = canvasRef.value?.getContext('2d')
  if (ctx) draw(ctx, state, config, images)
  sprite.onload = () => {
    if (!started.value) {
      const c = canvasRef.value?.getContext('2d')
      if (c) draw(c, state, config, images)
    }
  }

  try {
    pendingSave.value = await save.load()
  } catch (e) {
    pendingSave.value = null
  }
})

async function startGame() {
  if (started.value) return
  const existing = pendingSave.value
  if (existing && existing.state) {
    const plat = existing.platform === 'mobile' ? '手机' : '电脑'
    const ok = await confirm({
      title: '继续上局？',
      message: `检测到上次在${plat}端的进度（得分 ${existing.score ?? 0}），要继续吗？`,
      confirmText: '继续',
      cancelText: '重新开始',
    })
    if (ok) Object.assign(state, createInitialState(config, existing.state))
    else await save.clear()
  }
  if (!state.startedAt) state.startedAt = Date.now() // 新开局记开始时间；续玩则沿用存档里的原始开局时间
  state.running = true
  started.value = true
  pendingSave.value = null
  last = null
  raf = requestAnimationFrame(loop)
}

onBeforeUnmount(() => {
  if (raf) cancelAnimationFrame(raf)
  document.removeEventListener('visibilitychange', onVisibility)
  window.removeEventListener('resize', resize)
  doSave()
})

defineExpose({ togglePause, onSave: doSave })
</script>

<template>
  <div class="climb-game">
    <div class="cg-stage">
      <canvas ref="canvasRef" class="cg-canvas" />

      <div class="cg-hud">
        <div class="cg-hearts">
          <span v-for="n in config.character.maxHp" :key="n" class="cg-heart" :class="{ 'is-empty': n > state.hp }">♥</span>
        </div>
        <div class="cg-right">
          <span v-if="state.attacking" class="cg-atk-badge">下滑攻击中</span>
          <span class="cg-score">{{ state.score }}</span>
          <span class="cg-time">{{ formatTime(state.timeSurvived) }}</span>
          <button class="cg-board-btn" title="排行榜" @click="openBoard">榜</button>
          <button class="cg-board-btn" title="历史记录" @click="openHistory">史</button>
          <button class="cg-help-btn" title="玩法说明" @click="openHelp">?</button>
        </div>
      </div>

      <div v-if="!started && !state.gameOver" class="cg-overlay">
        <div class="cg-start">
          <h3>千羽爬树</h3>
          <p>3 棵树之间上爬、长按下键俯冲下滑，躲开往上爬的虫子，击落「加班虫/熬夜虫」得分。</p>
          <BaseButton type="primary" @click="startGame">开始游戏</BaseButton>
        </div>
      </div>

      <div v-if="paused" class="cg-overlay">
        <p class="cg-overlay__title">已暂停</p>
        <BaseButton type="primary" @click="togglePause">继续游戏</BaseButton>
      </div>

      <div v-if="helpOpen" class="cg-overlay">
        <div class="cg-panel cg-panel--help">
          <div class="cg-panel__body">
            <h3>玩法说明</h3>
            <ul class="cg-help__rules">
              <li v-for="(t, i) in config.help" :key="i">{{ t }}</li>
            </ul>

            <h4>虫子图鉴</h4>
            <ul class="cg-help__codex">
              <li v-for="b in config.bugs.types" :key="b.key">
                <img v-if="images.bugs[b.key]" :src="images.bugs[b.key].src" class="cg-help__ico" :alt="b.name" />
                <span class="cg-help__name">{{ b.name }}</span>
                <span class="cg-help__tag" :class="b.killable ? 'is-kill' : 'is-dodge'">{{ b.killable ? '可击落' : '需躲避' }}</span>
                <span class="cg-help__desc">{{ b.desc }}</span>
              </li>
            </ul>

            <h4>掉落物图鉴</h4>
            <ul class="cg-help__codex">
              <li v-for="it in config.items.types" :key="it.key">
                <img v-if="images.items[it.key]" :src="images.items[it.key].src" class="cg-help__ico" :alt="it.name" />
                <span class="cg-help__name">{{ it.name }}</span>
                <span class="cg-help__desc">{{ it.desc }}</span>
              </li>
            </ul>
          </div>
          <div class="cg-panel__foot">
            <BaseButton type="primary" size="lg" @click="closeHelp">继续游戏</BaseButton>
          </div>
        </div>
      </div>

      <div v-if="state.gameOver" class="cg-overlay">
        <div class="cg-over">
          <h3>本局结束</h3>
          <p>得分 <b>{{ lastResult.score }}</b> · 击虫 <b>{{ lastResult.bugsKilled }}</b></p>
          <BaseButton type="primary" @click="restart">再来一局</BaseButton>
        </div>
      </div>

      <div v-if="boardOpen" class="cg-overlay">
        <div class="cg-panel cg-panel--board">
          <div class="cg-panel__body">
            <h3>排行榜</h3>
            <ol class="cg-board__list">
              <li v-for="row in boardList" :key="row.userId" class="cg-board__item">
                <span class="cg-board__no">{{ row.rank }}</span>
                <span class="cg-board__name">{{ row.nickname }}</span>
                <span class="cg-board__plat">{{ platformLabel(row.platform) }}</span>
                <span class="cg-board__score">{{ row.score }} {{ game.scoreLabel }}</span>
              </li>
              <li v-if="!boardList.length" class="cg-board__empty">还没有记录，来抢第一名～</li>
            </ol>
          </div>
          <div class="cg-panel__foot">
            <BaseButton type="primary" size="lg" @click="closeBoard">返回游戏</BaseButton>
          </div>
        </div>
      </div>

      <div v-if="historyOpen" class="cg-overlay">
        <div class="cg-panel cg-panel--hist">
          <div class="cg-panel__body">
            <h3>我的历史</h3>
            <div class="cg-hist__list">
              <div v-for="row in historyList" :key="row.id" class="cg-hist__item">
                <div class="cg-hist__top">
                  <span class="cg-hist__score">{{ row.score }} {{ game.scoreLabel }}</span>
                  <span class="cg-hist__alive">存活 {{ formatTime(row.detail?.timeSurvived || 0) }}</span>
                </div>
                <div class="cg-hist__times">
                  <span>开始 {{ formatDateTime(row.detail?.startedAt) }}</span>
                  <span>结束 {{ formatDateTime(row.finishedAt) }}</span>
                </div>
              </div>
              <p v-if="!historyList.length" class="cg-hist__empty">还没有历史记录，先玩一局吧～</p>
            </div>
          </div>
          <div class="cg-panel__foot">
            <BaseButton type="primary" size="lg" @click="closeHistory">返回游戏</BaseButton>
          </div>
        </div>
      </div>
    </div>

    <!-- 虚拟按键 -->
    <div class="cg-pad">
      <button class="cg-key cg-key--up" @pointerdown="onDown($event, 'up')" @pointerup="onUp($event, 'up')" @pointerleave="onUp($event, 'up')" @pointercancel="onUp($event, 'up')">▲</button>
      <button class="cg-key cg-key--left" @pointerdown="onDown($event, 'left')" @pointerup="onUp($event, 'left')" @pointercancel="onUp($event, 'left')">◀</button>
      <button class="cg-key cg-key--down" @pointerdown="onDown($event, 'down')" @pointerup="onUp($event, 'down')" @pointerleave="onUp($event, 'down')" @pointercancel="onUp($event, 'down')">▼</button>
      <button class="cg-key cg-key--right" @pointerdown="onDown($event, 'right')" @pointerup="onUp($event, 'right')" @pointercancel="onUp($event, 'right')">▶</button>
      <button class="cg-key cg-key--pause" @pointerdown.prevent="togglePause">⏸</button>
    </div>
  </div>
</template>

<style scoped>
.climb-game {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.cg-stage {
  position: relative;
  flex: 1;
  min-height: 0;
  width: 100%;
  overflow: hidden;
}
.cg-canvas {
  display: block;
  width: 100%;
  height: 100%;
}
.cg-hud {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  pointer-events: none;
  z-index: 10; /* 始终在遮罩层之上，暂停时也能点按钮 */
}
.cg-hearts {
  display: flex;
  gap: 4px;
  font-size: 22px;
  line-height: 1;
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.2));
}
.cg-heart {
  color: #e74c3c;
}
.cg-heart.is-empty {
  color: rgba(255, 255, 255, 0.55);
}
.cg-right {
  display: flex;
  align-items: center;
  gap: 10px;
  pointer-events: auto;
}
.cg-time {
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  color: #fff;
  background: rgba(0, 0, 0, 0.25);
  padding: 2px 8px;
  border-radius: 999px;
}
.cg-help-btn {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.25);
  color: #fff;
  font-weight: 700;
  cursor: pointer;
}
.cg-score {
  font-variant-numeric: tabular-nums;
  font-weight: 800;
  font-size: 18px;
  color: #fff;
  background: rgba(201, 116, 59, 0.55);
  padding: 2px 10px;
  border-radius: 999px;
}
.cg-atk-badge {
  font-weight: 800;
  font-size: 13px;
  color: #fff;
  background: linear-gradient(90deg, #ff8c42, #c9743b);
  padding: 3px 10px;
  border-radius: 999px;
  animation: cg-atk-pulse 0.5s ease-in-out infinite alternate;
}
@keyframes cg-atk-pulse {
  from {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(255, 140, 66, 0.6);
  }
  to {
    transform: scale(1.06);
    box-shadow: 0 0 0 5px rgba(255, 140, 66, 0);
  }
}
.cg-board-btn {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.25);
  color: #fff;
  font-weight: 700;
  cursor: pointer;
}
.cg-panel {
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border-radius: var(--radius);
  max-width: 90%;
  width: 360px;
  max-height: 88%;
  overflow: hidden; /* 内容在 body 滚动，foot 按钮固定底部 */
  box-shadow: var(--shadow);
  text-align: left;
}
.cg-panel--help {
  width: min(420px, 90%);
}
.cg-panel__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 20px 22px;
}
.cg-panel__foot {
  flex-shrink: 0;
  display: flex;
  padding: 12px 22px;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
}
.cg-panel__foot :deep(.base-btn) {
  width: 100%;
}
.cg-board h3 {
  margin: 0 0 12px;
  font-family: var(--font-display);
}
.cg-board__list {
  list-style: none;
  margin: 0 0 4px;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.cg-board__item {
  display: grid;
  grid-template-columns: 26px 1fr auto;
  grid-template-areas: 'no name plat' 'no score score';
  gap: 2px 8px;
  align-items: center;
  padding: 7px 10px;
  border-radius: 10px;
  background: rgba(91, 140, 123, 0.08);
}
.cg-board__no {
  grid-area: no;
  font-weight: 700;
  color: var(--primary);
  text-align: center;
}
.cg-board__name {
  grid-area: name;
  font-weight: 600;
}
.cg-board__plat {
  grid-area: plat;
  font-size: 12px;
  padding: 1px 8px;
  border-radius: 999px;
  justify-self: end;
  background: rgba(201, 116, 59, 0.18);
  color: var(--primary);
}
.cg-board__score {
  grid-area: score;
  font-size: 13px;
  color: var(--text);
}
.cg-board__empty {
  color: var(--muted);
  font-size: 13px;
  text-align: center;
  padding: 16px 0;
}
/* 历史弹框沿用 .cg-panel 容器样式 */
.cg-hist h3 {
  margin: 0 0 12px;
  font-family: var(--font-display);
}
.cg-hist__list {
  margin: 0 0 4px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.cg-hist__item {
  padding: 8px 10px;
  border-radius: 10px;
  background: rgba(91, 140, 123, 0.08);
}
.cg-hist__top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 4px;
}
.cg-hist__score {
  font-weight: 800;
  color: var(--primary);
  font-variant-numeric: tabular-nums;
}
.cg-hist__alive {
  font-size: 12px;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}
.cg-hist__times {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12px;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
.cg-hist__empty {
  color: var(--muted);
  font-size: 13px;
  text-align: center;
  padding: 16px 0;
}
.cg-overlay {
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
.cg-overlay__title {
  color: #fff;
  font-size: 24px;
  font-family: var(--font-display);
}
.cg-over {
  background: var(--surface);
  border-radius: var(--radius);
  padding: 20px 22px;
  max-width: 86%;
  text-align: left;
}
/* 帮助弹框沿用 .cg-panel / .cg-panel--help 样式 */
.cg-start {
  background: var(--surface);
  border-radius: var(--radius);
  padding: 24px 26px;
  max-width: 86%;
  text-align: center;
}
.cg-start h3 {
  margin: 0 0 8px;
  font-family: var(--font-display);
  font-size: 26px;
}
.cg-start p {
  margin: 0 0 16px;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.6;
}
.cg-help h3,
.cg-over h3 {
  margin: 0 0 10px;
  font-family: var(--font-display);
}
.cg-help__rules {
  margin: 0 0 14px;
  padding-left: 18px;
  color: var(--text);
  font-size: 13px;
  line-height: 1.7;
}
.cg-help h4 {
  margin: 14px 0 6px;
  font-family: var(--font-display);
  color: var(--primary);
  font-size: 15px;
}
.cg-help__codex {
  list-style: none;
  margin: 0 0 10px;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.cg-help__codex li {
  display: grid;
  grid-template-columns: 30px auto 1fr;
  grid-template-areas:
    'ico name tag'
    'ico desc desc';
  gap: 2px 8px;
  align-items: center;
  padding: 6px 8px;
  border-radius: 10px;
  background: rgba(91, 140, 123, 0.08);
  font-size: 12px;
  line-height: 1.5;
}
.cg-help__ico {
  grid-area: ico;
  width: 28px;
  height: 28px;
  object-fit: contain;
}
.cg-help__name {
  grid-area: name;
  font-weight: 700;
}
.cg-help__tag {
  grid-area: tag;
  justify-self: start;
  font-size: 11px;
  padding: 1px 7px;
  border-radius: 999px;
}
.cg-help__tag.is-kill {
  background: rgba(63, 143, 58, 0.18);
  color: #3f8f3a;
}
.cg-help__tag.is-dodge {
  background: rgba(214, 48, 49, 0.15);
  color: #d63031;
}
.cg-help__desc {
  grid-area: desc;
  color: var(--text);
}
.cg-over p {
  margin: 0 0 14px;
  color: var(--muted);
}
.cg-over b {
  color: var(--primary);
}
.cg-pad {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-areas:
    '. up .'
    'left down right'
    '. pause .';
  gap: 10px;
  width: 100%;
  max-width: 320px;
}
.cg-key {
  touch-action: none;
  user-select: none;
  border: none;
  border-radius: 14px;
  padding: 16px 0;
  font-size: 18px;
  font-weight: 700;
  color: #fff;
  background: var(--primary);
  box-shadow: var(--shadow);
}
.cg-key:active {
  transform: translateY(1px);
  filter: brightness(0.95);
}
.cg-key--up {
  grid-area: up;
}
.cg-key--left {
  grid-area: left;
}
.cg-key--down {
  grid-area: down;
}
.cg-key--right {
  grid-area: right;
}
.cg-key--pause {
  grid-area: pause;
  background: var(--accent);
}
</style>
