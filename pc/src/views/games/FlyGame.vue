<!--
@doc
name: FlyGame
path: src/views/games/FlyGame.vue
category: business
appliesTo: PC
purpose: 像素鸟（PC）。游戏循环 + Canvas 渲染 + 空格/↑/点击 拍翅；
         逻辑/渲染走 ../fly/{engine,render}.js（与移动端同一份）；状态契约平台无关，保证跨端续玩。
-->
<script setup>
import { onMounted, onBeforeUnmount, ref, reactive, computed } from 'vue'
import BaseButton from '../../components/base/BaseButton.vue'
import { getGame } from '../../games/registry.js'
import { useGameSave, submitGameRecord, useGameLeaderboard, useGameHistory } from '../../composables/useGame.js'
import { confirm, alert } from '../../composables/useConfirm.js'
import config from '../../games/fly/config.js'
import { createInitialState, serialize, buildResult, step, flap, GAME_OVER } from '@cabin/games/fly/engine.js'
import { draw } from '@cabin/games/fly/render.js'

const props = defineProps({ gameKey: { type: String, required: true } })
const emit = defineEmits(['finished'])

const save = useGameSave(props.gameKey)
const canvasRef = ref(null)
const state = reactive(createInitialState(config))
const started = ref(false)
const helpOpen = ref(false)
const lastResult = ref(null)
const pendingSave = ref(null)

const game = getGame(props.gameKey)
const boardOpen = ref(false)
const historyOpen = ref(false)
const { list: boardList, total: boardTotal, load: loadBoard } = useGameLeaderboard(props.gameKey)
const { list: historyList, load: loadHistory } = useGameHistory(props.gameKey)
const panelOpen = computed(() => boardOpen.value || historyOpen.value || helpOpen.value)
let resumeRunning = false

function platformLabel(p) {
  return p === 'mobile' ? '手机' : '电脑'
}
function openBoard() {
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
const images = { sprite }

const paused = computed(
  () =>
    started.value &&
    !state.running &&
    !state.gameOver &&
    !helpOpen.value &&
    !boardOpen.value &&
    !historyOpen.value,
)

let raf = null
let last = null
let autoSaveAcc = 0

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
    const events = step(state, dt, {}, config)
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

function onTap() {
  flap(state, config)
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
  state.startedAt = Date.now()
  state.running = true
  autoSaveAcc = 0
}

function onKeyDown(e) {
  const k = e.key.toLowerCase()
  if (e.code === 'Space' || k === ' ' || k === 'arrowup' || k === 'w') {
    e.preventDefault()
    onTap()
  } else if (k === 'p' || k === 'escape') {
    e.preventDefault()
    togglePause()
  }
}

function onVisibility() {
  if (document.hidden && state.running && !state.gameOver) {
    state.running = false
    doSave()
  }
}

onMounted(async () => {
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('beforeunload', doSave)
  window.addEventListener('resize', resize)
  document.addEventListener('visibilitychange', onVisibility)
  resize()
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
  } else {
    // 全新开局：按当前画布高度把小鸟放到偏上的安全位置（初始 state 创建时画布尚未 resize）
    state.birdY = config.view.height * 0.42
    state.vy = 0
  }
  if (!state.startedAt) state.startedAt = Date.now()
  state.running = true
  started.value = true
  pendingSave.value = null
  last = null
  raf = requestAnimationFrame(loop)
}

onBeforeUnmount(() => {
  if (raf) cancelAnimationFrame(raf)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('beforeunload', doSave)
  window.removeEventListener('resize', resize)
  document.removeEventListener('visibilitychange', onVisibility)
  doSave()
})

defineExpose({ togglePause, onSave: doSave })
</script>

<template>
  <div class="climb-game">
    <div class="cg-stage">
      <canvas ref="canvasRef" class="cg-canvas" @pointerdown.prevent="onTap" />

      <div class="cg-hud">
        <div class="cg-score-big">{{ state.score }}</div>
        <div class="cg-right">
          <span class="cg-time">{{ formatTime(state.timeSurvived) }}</span>
          <button class="cg-board-btn" title="排行榜" @click="openBoard">榜</button>
          <button class="cg-board-btn" title="历史记录" @click="openHistory">史</button>
          <button class="cg-help-btn" title="玩法说明" @click="openHelp">?</button>
          <button class="cg-help-btn" title="暂停" @click="togglePause">⏸</button>
        </div>
      </div>

      <div v-if="!started && !state.gameOver" class="cg-overlay">
        <div class="cg-start">
          <h3>像素鸟</h3>
          <p>空格 / ↑ / 点击 让小鸟拍翅向上，穿过管道缝隙得分，撞到或落地就结束。比谁飞得更远~</p>
          <BaseButton type="primary" @click="startGame">开始游戏</BaseButton>
        </div>
      </div>

      <div v-if="paused" class="cg-overlay">
        <p class="cg-overlay__title">已暂停</p>
        <BaseButton type="primary" @click="togglePause">继续游戏</BaseButton>
      </div>

      <div v-if="helpOpen" class="cg-overlay">
        <div class="cg-help">
          <h3>玩法说明</h3>
          <ul class="cg-help__rules">
            <li v-for="(t, i) in config.help" :key="i">{{ t }}</li>
          </ul>
          <BaseButton type="primary" @click="closeHelp">继续游戏</BaseButton>
        </div>
      </div>

      <div v-if="state.gameOver" class="cg-overlay">
        <div class="cg-over">
          <h3>本局结束</h3>
          <p>得分 <b>{{ lastResult.score }}</b> · 飞过 <b>{{ lastResult.pipesPassed }}</b> 根管道</p>
          <BaseButton type="primary" @click="restart">再来一局</BaseButton>
        </div>
      </div>

      <div v-if="boardOpen" class="cg-overlay">
        <div class="cg-board">
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
          <BaseButton type="primary" @click="closeBoard">返回游戏</BaseButton>
        </div>
      </div>

      <div v-if="historyOpen" class="cg-overlay">
        <div class="cg-hist">
          <h3>我的历史</h3>
          <div class="cg-hist__list">
            <div v-for="row in historyList" :key="row.id" class="cg-hist__item">
              <div class="cg-hist__top">
                <span class="cg-hist__score">{{ row.score }} {{ game.scoreLabel }}</span>
                <span class="cg-hist__alive">飞过 {{ row.detail?.pipesPassed ?? 0 }} 根</span>
              </div>
              <div class="cg-hist__times">
                <span>开始 {{ formatDateTime(row.detail?.startedAt) }}</span>
                <span>结束 {{ formatDateTime(row.finishedAt) }}</span>
              </div>
            </div>
            <p v-if="!historyList.length" class="cg-hist__empty">还没有历史记录，先玩一局吧～</p>
          </div>
          <BaseButton type="primary" @click="closeHistory">返回游戏</BaseButton>
        </div>
      </div>
    </div>

    <p class="cg-tip">空格 / ↑ / W / 点击 拍翅 · P 或 Esc 暂停</p>
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
  cursor: pointer;
}
.cg-hud {
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
.cg-score-big {
  font-variant-numeric: tabular-nums;
  font-weight: 900;
  font-size: 44px;
  color: #fff;
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
  line-height: 1;
}
.cg-right {
  display: flex;
  align-items: center;
  gap: 8px;
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
.cg-board-btn,
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
.cg-board-btn:hover,
.cg-help-btn:hover {
  background: rgba(0, 0, 0, 0.4);
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
.cg-over,
.cg-start {
  background: var(--surface);
  border-radius: var(--radius);
  padding: 22px 24px;
  max-width: 86%;
  text-align: center;
}
.cg-start h3,
.cg-over h3 {
  margin: 0 0 10px;
  font-family: var(--font-display);
}
.cg-start p,
.cg-over p {
  margin: 0 0 14px;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.6;
}
.cg-over b {
  color: var(--primary);
}
.cg-help {
  background: var(--surface);
  border-radius: var(--radius);
  padding: 20px 22px;
  width: min(420px, 90%);
  max-height: 86%;
  overflow-y: auto;
  text-align: left;
}
.cg-help__rules {
  margin: 0 0 14px;
  padding-left: 18px;
  color: var(--text);
  font-size: 13px;
  line-height: 1.7;
}
.cg-board {
  background: var(--surface);
  border-radius: var(--radius);
  padding: 20px 22px;
  max-width: 90%;
  width: 360px;
  text-align: left;
}
.cg-board h3,
.cg-hist h3 {
  margin: 0 0 12px;
  font-family: var(--font-display);
}
.cg-board__list {
  list-style: none;
  margin: 0 0 14px;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 50vh;
  overflow-y: auto;
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
.cg-hist {
  background: var(--surface);
  border-radius: var(--radius);
  padding: 20px 22px;
  max-width: 90%;
  width: 360px;
  text-align: left;
}
.cg-hist__list {
  margin: 0 0 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 50vh;
  overflow-y: auto;
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
.cg-tip {
  color: var(--muted);
  font-size: 12px;
  text-align: center;
  margin: 0;
}
</style>
