<!--
@doc
name: CircleGame
path: src/views/games/CircleGame.vue
category: business
appliesTo: PC
purpose: 千羽画圈圈（PC）。游戏循环 + Canvas 渲染 + 键盘控制（空格跳跃）。
         逻辑/渲染走 ../circle/{engine,render}.js（与移动端同一份）；状态契约平台无关，保证跨端续玩。
         资源加载：进入页面先加载全部贴图，显示进度，全部加载完成后才能点击开始游戏。
-->
<script setup>
import { onMounted, onBeforeUnmount, ref, reactive, computed } from 'vue'
import BaseButton from '../../components/base/BaseButton.vue'
import { getGame } from '../../games/registry.js'
import { submitGameRecord, useGameLeaderboard, useGameHistory } from '../../composables/useGame.js'
import { alert } from '../../composables/useConfirm.js'
import config from '../../games/circle/config.js'
import { createInitialState, buildResult, step, jump, startDrop, checkWin, GAME_OVER } from '@cabin/games/circle/engine.js'
import { draw } from '@cabin/games/circle/render.js'

const props = defineProps({ gameKey: { type: String, required: true } })
const emit = defineEmits(['finished'])

const canvasRef = ref(null)
const state = reactive(createInitialState(config))
const started = ref(false)
const helpOpen = ref(false)
const lastResult = ref(null)

// 游戏内面板（排行榜 / 历史 / 说明）互斥弹出；暂停时也能打开，关闭后回到打开前的状态
const game = getGame(props.gameKey)
const boardOpen = ref(false)
const historyOpen = ref(false)
const { list: boardList, load: loadBoard } = useGameLeaderboard(props.gameKey)
const { list: historyList, load: loadHistory } = useGameHistory(props.gameKey)
const panelOpen = computed(() => boardOpen.value || historyOpen.value || helpOpen.value)
let resumeRunning = false

// ── 资源加载：进入页面即加载全部贴图，进度到 100% 才能开始游戏 ──
const assetsReady = ref(false)
const loadError = ref(false)
const loadedCount = ref(0)
const totalCount = ref(1) // 至少 1，避免除 0

// 加载一张图片，返回 Promise<Image>
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const im = new Image()
    im.onload = () => { loadedCount.value += 1; resolve(im) }
    im.onerror = () => reject(new Error(`加载失败: ${src}`))
    im.src = src
  })
}

// 全部贴图（主角 + 怪物）
const sprite = new Image()
const images = { sprite, bugs: {} }
const imageSources = [
  { key: 'sprite', src: config.character.image },
  ...config.monsters.types.map((t) => ({ key: t.key, src: t.image })),
]
totalCount.value = imageSources.length

async function preloadAssets() {
  try {
    const loaded = await Promise.all(imageSources.map((s) => loadImage(s.src)))
    // 按 key 放回 images 对象
    for (let i = 0; i < loaded.length; i++) {
      const { key } = imageSources[i]
      if (key === 'sprite') {
        images.sprite = loaded[i]
      } else {
        images.bugs[key] = loaded[i]
      }
    }
    assetsReady.value = true
  } catch (e) {
    loadError.value = true
  }
}

const loadProgress = computed(() => Math.round((loadedCount.value / totalCount.value) * 100))

const paused = computed(
  () =>
    started.value &&
    !state.running &&
    state.phase !== 'dead' &&
    state.phase !== 'won' &&
    !helpOpen.value &&
    !boardOpen.value &&
    !historyOpen.value,
)

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

// 难度调节（开始前）
const difficulty = reactive({
  monsterCount: config.difficulty.monsterCount,
  monsterSpeed: config.difficulty.monsterSpeed,
  runSpeed: config.difficulty.runSpeed,
})

function loop(ts) {
  raf = requestAnimationFrame(loop)
  if (last == null) last = ts
  let dt = (ts - last) / 1000
  last = ts

  if (state.running && started.value) {
    const events = step(state, dt, null, config)
    if (events.includes(GAME_OVER)) onGameOver()
    else if (state.phase === 'playing' && checkWin(state)) {
      state.phase = 'won'
      onGameOver()
    }
  }
  const ctx = canvasRef.value?.getContext('2d')
  if (ctx) draw(ctx, state, config, images)
}

function togglePause() {
  if (!started.value) return
  if (state.phase === 'dead' || state.phase === 'won') return
  if (panelOpen.value) {
    boardOpen.value = false
    historyOpen.value = false
    helpOpen.value = false
    state.running = resumeRunning
    return
  }
  state.running = !state.running
}

function openHelp() {
  if (state.phase === 'dead' || state.phase === 'won') return
  if (!panelOpen.value) resumeRunning = state.running
  helpOpen.value = true
  boardOpen.value = false
  historyOpen.value = false
  state.running = false
}
function closeHelp() {
  helpOpen.value = false
  if (!panelOpen.value && state.phase !== 'dead' && state.phase !== 'won') state.running = resumeRunning
}
function platformLabel(p) {
  return p === 'mobile' ? '手机' : '电脑'
}
function openBoard() {
  if (state.phase === 'dead' || state.phase === 'won') return
  if (!panelOpen.value) resumeRunning = state.running
  boardOpen.value = true
  historyOpen.value = false
  helpOpen.value = false
  state.running = false
  loadBoard()
}
function closeBoard() {
  boardOpen.value = false
  if (!panelOpen.value && state.phase !== 'dead' && state.phase !== 'won') state.running = resumeRunning
}
function openHistory() {
  if (state.phase === 'dead' || state.phase === 'won') return
  if (!panelOpen.value) resumeRunning = state.running
  historyOpen.value = true
  boardOpen.value = false
  helpOpen.value = false
  state.running = false
  loadHistory()
}
function closeHistory() {
  historyOpen.value = false
  if (!panelOpen.value && state.phase !== 'dead' && state.phase !== 'won') state.running = resumeRunning
}

async function onGameOver() {
  state.running = false
  const result = buildResult(state)
  lastResult.value = result
  try {
    await submitGameRecord(props.gameKey, result)
    emit('finished')
  } catch (e) {
    await alert({ title: '提交失败', message: e.message || '成绩上传失败' })
  }
}

function restart() {
  lastResult.value = null
  // 回到准备界面，让玩家可以重新调整配置
  started.value = false
  const fresh = createInitialState(config, null, {
    monsterCount: difficulty.monsterCount,
    monsterSpeed: difficulty.monsterSpeed,
    runSpeed: difficulty.runSpeed,
  })
  // 先清空旧数组，避免 Object.assign 替换引用后旧数组仍被 step() 引用导致数据错乱
  state.painted.splice(0)
  state.monsters.splice(0)
  Object.assign(state, fresh)
  last = null
}

function onKeyDown(e) {
  if (e.code === 'Space' || e.key === ' ') {
    e.preventDefault()
    doJump()
  }
}

// 电脑端：空格 或 点击屏幕 都可跳跃
function onStageClick() {
  doJump()
}

function doJump() {
  if (!started.value) return
  if (state.phase === 'playing' && state.running) jump(state)
}

function onVisibility() {
  if (document.hidden && state.running && state.phase === 'playing') {
    state.running = false
  }
}

onMounted(async () => {
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('resize', resize)
  document.addEventListener('visibilitychange', onVisibility)

  resize()
  preloadAssets()
  // 启动唯一一个 RAF 循环，整局游戏期间持续运行
  raf = requestAnimationFrame(loop)
})

async function startGame() {
  if (started.value) return
  if (!assetsReady.value) return
  if (state.phase === 'ready') {
    // 新开局：应用难度配置 + 下落过场
    const fresh = createInitialState(config, null, {
      monsterCount: difficulty.monsterCount,
      monsterSpeed: difficulty.monsterSpeed,
      runSpeed: difficulty.runSpeed,
    })
    // 先清空旧数组，避免 Object.assign 替换引用后旧数组仍被 step() 引用导致数据错乱
    state.painted.splice(0)
    state.monsters.splice(0)
    Object.assign(state, fresh)
    startDrop(state, config)
    state.running = true
  }
  started.value = true
  last = null
}

onBeforeUnmount(() => {
  if (raf) cancelAnimationFrame(raf)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('resize', resize)
  document.removeEventListener('visibilitychange', onVisibility)
})

defineExpose({ togglePause })
</script>

<template>
  <div class="circle-game">
    <div class="cg-stage" @click="onStageClick">
      <canvas ref="canvasRef" class="cg-canvas" />

      <!-- HUD -->
      <div class="cg-hud">
        <div class="cg-hud__left">
          <span class="cg-score">涂色 {{ Math.floor((state.paintedTotal / (Math.PI * 2)) * 100) }}%</span>
        </div>
        <div class="cg-hud__right">
          <span class="cg-time">{{ formatTime(state.timeSurvived) }}</span>
          <button class="cg-board-btn" title="排行榜" @click="openBoard">榜</button>
          <button class="cg-board-btn" title="历史记录" @click="openHistory">史</button>
          <button class="cg-help-btn" title="玩法说明" @click="openHelp">?</button>
        </div>
      </div>

      <!-- 开始遮罩（含资源加载进度） -->
      <div v-if="!started && state.phase !== 'dead' && state.phase !== 'won'" class="cg-overlay">
        <div class="cg-start">
          <h3>千羽画圈圈</h3>
          <p>千羽沿圆环自动奔跑，跑过的地方会被涂上颜色。圆环上有怪物在定速游走，按空格或点击屏幕让千羽跳起躲开，把整条圆环涂满就胜利！</p>

          <!-- 资源加载进度 -->
          <div class="cg-load">
            <div v-if="!assetsReady && !loadError" class="cg-load__bar-wrap">
              <div class="cg-load__bar" :style="{ width: loadProgress + '%' }"></div>
            </div>
            <p v-if="!assetsReady && !loadError" class="cg-load__text">正在加载资源 {{ loadProgress }}%</p>
            <p v-if="loadError" class="cg-load__error">资源加载失败，请刷新页面重试</p>
          </div>

          <!-- 难度调节 -->
          <div class="cg-diff">
            <label class="cg-diff__item">
              <span>怪物数量：{{ difficulty.monsterCount }}</span>
              <input v-model.number="difficulty.monsterCount" type="range" min="1" max="8" step="1" />
            </label>
            <label class="cg-diff__item">
              <span>怪物速度：{{ difficulty.monsterSpeed }}</span>
              <input v-model.number="difficulty.monsterSpeed" type="range" min="0.5" max="2" step="0.1" />
            </label>
            <label class="cg-diff__item">
              <span>奔跑速度：{{ difficulty.runSpeed }}</span>
              <input v-model.number="difficulty.runSpeed" type="range" min="0.5" max="2" step="0.1" />
            </label>
          </div>

          <BaseButton type="primary" :disabled="!assetsReady" @click="startGame">
            {{ assetsReady ? '开始游戏' : '加载中…' }}
          </BaseButton>
        </div>
      </div>

      <!-- 暂停遮罩 -->
      <div v-if="paused" class="cg-overlay">
        <p class="cg-overlay__title">已暂停</p>
        <BaseButton type="primary" @click="togglePause">继续游戏</BaseButton>
      </div>

      <!-- 帮助遮罩 -->
      <div v-if="helpOpen" class="cg-overlay">
        <div class="cg-help">
          <h3>玩法说明</h3>
          <ul class="cg-help__rules">
            <li v-for="(t, i) in config.help" :key="i">{{ t }}</li>
          </ul>
          <BaseButton type="primary" @click="closeHelp">继续游戏</BaseButton>
        </div>
      </div>

      <!-- 游戏结束遮罩 -->
      <div v-if="state.phase === 'dead' || state.phase === 'won'" class="cg-overlay">
        <div class="cg-over">
          <h3>{{ state.phase === 'won' ? '胜利！涂满整圈！' : '被怪物抓住了！' }}</h3>
          <p v-if="lastResult">
            涂色 <b>{{ lastResult.paintPercent }}%</b> · 用时 <b>{{ formatTime(lastResult.timeSurvived) }}</b><br />
            怪物 ×{{ lastResult.monsterCount }} · 怪速 {{ lastResult.monsterSpeed }} · 跑速 {{ lastResult.runSpeed }}
          </p>
          <BaseButton type="primary" @click="restart">再来一局</BaseButton>
        </div>
      </div>

      <!-- 排行榜 -->
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

      <!-- 历史记录 -->
      <div v-if="historyOpen" class="cg-overlay">
        <div class="cg-hist">
          <h3>我的历史</h3>
          <div class="cg-hist__list">
            <div v-for="row in historyList" :key="row.id" class="cg-hist__item">
              <div class="cg-hist__top">
                <span class="cg-hist__score">{{ row.score }} {{ game.scoreLabel }}</span>
                <span class="cg-hist__alive">存活 {{ formatTime(row.detail?.timeSurvived || 0) }}</span>
              </div>
              <div class="cg-hist__cfg">
                怪物 ×{{ row.detail?.monsterCount ?? '-' }} · 怪速 {{ row.detail?.monsterSpeed ?? '-' }} · 跑速 {{ row.detail?.runSpeed ?? '-' }}
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

    <p class="cg-tip">电脑：空格 / 点击屏幕 跳跃 · 跳跃可躲避怪物 · 空格（暂停后继续）· 涂满整圈获胜</p>
  </div>
</template>

<style scoped>
.circle-game {
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
  z-index: 10;
}
.cg-hud__left {
  pointer-events: auto;
}
.cg-hud__right {
  display: flex;
  align-items: center;
  gap: 10px;
  pointer-events: auto;
}
.cg-score {
  font-variant-numeric: tabular-nums;
  font-weight: 800;
  font-size: 18px;
  color: var(--primary);
  background: rgba(201, 116, 59, 0.16);
  padding: 2px 10px;
  border-radius: 999px;
}
.cg-time {
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  color: var(--text);
  background: rgba(58, 50, 42, 0.1);
  padding: 2px 8px;
  border-radius: 999px;
}
.cg-board-btn,
.cg-help-btn {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: none;
  background: rgba(58, 50, 42, 0.1);
  color: var(--text);
  font-weight: 700;
  cursor: pointer;
}
.cg-board-btn:hover,
.cg-help-btn:hover {
  background: rgba(58, 50, 42, 0.18);
}
.cg-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  background: rgba(247, 241, 227, 0.72);
  backdrop-filter: blur(2px);
  z-index: 5;
}
.cg-overlay__title {
  color: var(--text);
  font-size: 24px;
  font-family: var(--font-display);
}
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
  margin: 0 0 14px;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.6;
}
.cg-load {
  margin-bottom: 14px;
}
.cg-load__bar-wrap {
  width: 100%;
  height: 8px;
  background: rgba(58, 50, 42, 0.12);
  border-radius: 999px;
  overflow: hidden;
  margin-bottom: 6px;
}
.cg-load__bar {
  height: 100%;
  background: linear-gradient(90deg, var(--accent), #4a7a68);
  border-radius: 999px;
  transition: width 0.2s ease;
}
.cg-load__text {
  font-size: 12px;
  color: var(--muted);
  margin: 0;
}
.cg-load__error {
  font-size: 13px;
  color: #d63031;
  margin: 0;
}
.cg-diff {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 14px;
  text-align: left;
}
.cg-diff__item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 13px;
  color: var(--text);
}
.cg-diff__item input[type='range'] {
  width: 100%;
  accent-color: var(--primary);
}
.cg-over {
  background: var(--surface);
  border-radius: var(--radius);
  padding: 20px 22px;
  max-width: 86%;
  text-align: center;
}
.cg-over h3 {
  margin: 0 0 10px;
  font-family: var(--font-display);
}
.cg-over p {
  margin: 0 0 14px;
  color: var(--muted);
}
.cg-over b {
  color: var(--primary);
}
.cg-board {
  background: var(--surface);
  border-radius: var(--radius);
  padding: 20px 22px;
  max-width: 90%;
  width: 360px;
  text-align: left;
}
.cg-board h3 {
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
.cg-hist h3 {
  margin: 0 0 12px;
  font-family: var(--font-display);
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
.cg-hist__cfg {
  font-size: 12px;
  color: var(--text);
  font-variant-numeric: tabular-nums;
  margin-bottom: 4px;
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
