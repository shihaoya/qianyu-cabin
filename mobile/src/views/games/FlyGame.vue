<!--
@doc
name: FlyGame
path: src/views/games/FlyGame.vue
category: business
appliesTo: 移动
purpose: 像素鸟（移动端）。游戏循环 + Canvas 渲染 + 点击屏幕拍翅；
         逻辑/渲染走 ../fly/{engine,render}.js（与 PC 同一份）；状态契约平台无关，保证跨端续玩。
-->
<script setup>
import { onMounted, onBeforeUnmount, ref, reactive, computed, watch, nextTick } from 'vue'
import BaseButton from '../../components/base/BaseButton.vue'
import { getGame } from '../../games/registry.js'
import { useGameSave, submitGameRecord, useGameLeaderboard, useGameHistory } from '../../composables/useGame.js'
import { createConfirmScope } from '../../composables/useConfirm.js'
import ConfirmDialog from '../../components/base/ConfirmDialog.vue'

// 飞鸟游戏专属弹框实例：挂在自身旋转后的 DOM 子树内，随游戏一起横过来；
// 与全局 confirm 完全独立，不影响其它页面/游戏（彻底隔离）。
const flyConfirm = createConfirmScope()
import config from '../../games/fly/config.js'
import { createInitialState, serialize, buildResult, step, flap, startEnter, stepEnter, beginPlay, startCountdown, stepCountdown, GAME_OVER } from '@cabin/games/fly/engine.js'
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
// 竖屏检测：竖屏时用 CSS 把游戏画面旋转 90° 横过来游玩（无需系统横屏锁定）
const isPortrait = ref(false)
function checkOrientation() {
  isPortrait.value = window.innerHeight > window.innerWidth
}

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
    !state.entering && // 飞入过场中不算暂停（否则会误弹「已暂停」遮罩）
    state.countdown <= 0 && // 续玩倒计时中也不算暂停
    !helpOpen.value &&
    !boardOpen.value &&
    !historyOpen.value,
)

let raf = null
let last = null
let autoSaveAcc = 0
let ctx2d = null


function resize() {
  const c = canvasRef.value
  if (!c) return
  checkOrientation()
  // 注意：竖屏时整块 .fly-game 被 rotate(90deg) 旋转，getBoundingClientRect() 会返回
  // 旋转后的「视觉边界框」（宽高互换），与 canvas 的 CSS 布局尺寸不一致 → bitmap 被拉伸变形
  // （鸟被压扁）。改用 offsetWidth/offsetHeight：它返回未受 transform 影响的「布局尺寸」，正确。
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
  } else if (state.entering && started.value) {
    // 飞入过场：只推进飞入动画，不推进物理/管道/碰撞
    stepEnter(state, dt, config)
  } else if (state.countdown > 0 && started.value) {
    // 续玩倒计时：只推进倒计时，不推进物理/管道/碰撞（内容可见、不操作）
    stepCountdown(state, dt, config)
  }
  if (!ctx2d) ctx2d = canvasRef.value?.getContext('2d')
  if (ctx2d) draw(ctx2d, state, config, images)
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
  if (state.entering || state.countdown > 0) return // 飞入/倒计时过场中忽略暂停
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

// 拍翅：点击画布 / 空格 触发（竖屏下画面已旋转，点击照常生效）
function onTap() {
  // 飞入过场中点击 → 直接正式开始（不再拍翅）
  if (state.entering) {
    beginPlay(state, config)
    return
  }
  if (state.countdown > 0) return // 续玩倒计时中点击无效（倒计时结束才正式开始）
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
    await flyConfirm.alert({ title: '提交失败', message: e.message || '成绩上传失败' })
  }
}

async function restart() {
  lastResult.value = null
  Object.assign(state, createInitialState(config))
  startEnter(state, config) // 新一局：先飞入过场，再等点击开始
  started.value = true
  autoSaveAcc = 0
  // 关闭可能残留的面板，避免遮罩盖住新一局导致“点再来一局立刻死”
  helpOpen.value = false
  boardOpen.value = false
  historyOpen.value = false
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
  window.addEventListener('orientationchange', resize)
  // 方向变化时，等 DOM 应用 is-portrait 旋转布局后再量 canvas，rect 才准确
  watch(isPortrait, () => resize())
  checkOrientation()
  await nextTick()
  resize()
  if (!ctx2d) ctx2d = canvasRef.value?.getContext('2d')
  if (ctx2d) draw(ctx2d, state, config, images)
  sprite.onload = () => {
    if (!started.value && ctx2d) draw(ctx2d, state, config, images)
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
    const ok = await flyConfirm.confirm({
      title: '继续上局？',
      message: `检测到上次在${plat}端的进度（得分 ${existing.score ?? 0}），要继续吗？`,
      confirmText: '继续',
      cancelText: '重新开始',
    })
    if (ok) {
      // 续玩：直接就位进入游戏，先 3 秒倒计时（内容可见），结束自动开始
      Object.assign(state, createInitialState(config, existing.state))
      startCountdown(state, config)
    } else {
      await save.clear()
      startEnter(state, config) // 新局：飞入过场
    }
  } else {
    // 全新开局：飞入过场（小鸟从左侧飞到起点）
    startEnter(state, config)
  }
  started.value = true
  pendingSave.value = null
  last = null
  raf = requestAnimationFrame(loop)
}

onBeforeUnmount(() => {
  if (raf) cancelAnimationFrame(raf)
  document.removeEventListener('visibilitychange', onVisibility)
  window.removeEventListener('resize', resize)
  window.removeEventListener('orientationchange', resize)
  doSave()
})

defineExpose({ togglePause, onSave: doSave })
</script>

<template>
  <div class="fly-game" :class="{ 'is-portrait': isPortrait }">
    <div class="fly-stage">
      <canvas ref="canvasRef" class="fly-canvas" @pointerdown.prevent="onTap" />

      <div v-if="!started && !state.gameOver" class="fly-overlay fly-overlay--start">
        <div class="fly-start">
          <h3>像素鸟</h3>
          <p>点击屏幕让小鸟拍翅向上，穿过管道缝隙得分，撞到或落地就结束。比谁飞得更远~</p>
          <BaseButton type="primary" @click="startGame">开始游戏</BaseButton>
        </div>
      </div>

      <div v-if="paused" class="fly-overlay fly-overlay--pause">
        <p class="fly-overlay__title">已暂停</p>
        <BaseButton type="primary" @click="togglePause">继续游戏</BaseButton>
      </div>

      <div v-if="helpOpen" class="fly-overlay fly-overlay--help">
        <div class="fly-panel fly-panel--help">
          <div class="fly-panel__body">
            <h3>玩法说明</h3>
            <ul class="fly-help__rules">
              <li v-for="(t, i) in config.help" :key="i">{{ t }}</li>
            </ul>
          </div>
          <div class="fly-panel__foot">
            <BaseButton type="primary" size="lg" @click="closeHelp">继续游戏</BaseButton>
          </div>
        </div>
      </div>

      <div v-if="state.gameOver" class="fly-overlay fly-overlay--over">
        <div class="fly-over">
          <h3>本局结束</h3>
          <p>得分 <b>{{ lastResult.score }}</b> · 飞过 <b>{{ lastResult.pipesPassed }}</b> 根管道</p>
          <BaseButton type="primary" @click="restart">再来一局</BaseButton>
        </div>
      </div>

      <div v-if="boardOpen" class="fly-overlay fly-overlay--board">
        <div class="fly-panel fly-panel--board">
          <div class="fly-panel__body">
            <h3>排行榜</h3>
            <ol class="fly-board__list">
              <li v-for="row in boardList" :key="row.userId" class="fly-board__item">
                <span class="fly-board__no">{{ row.rank }}</span>
                <span class="fly-board__name">{{ row.nickname }}</span>
                <span class="fly-board__plat">{{ platformLabel(row.platform) }}</span>
                <span class="fly-board__score">{{ row.score }} {{ game.scoreLabel }}</span>
              </li>
              <li v-if="!boardList.length" class="fly-board__empty">还没有记录，来抢第一名～</li>
            </ol>
          </div>
          <div class="fly-panel__foot">
            <BaseButton type="primary" size="lg" @click="closeBoard">返回游戏</BaseButton>
          </div>
        </div>
      </div>

      <div v-if="historyOpen" class="fly-overlay fly-overlay--hist">
        <div class="fly-panel fly-panel--hist">
          <div class="fly-panel__body">
            <h3>我的历史</h3>
            <div class="fly-hist__list">
              <div v-for="row in historyList" :key="row.id" class="fly-hist__item">
                <div class="fly-hist__top">
                  <span class="fly-hist__score">{{ row.score }} {{ game.scoreLabel }}</span>
                  <span class="fly-hist__alive">飞过 {{ row.detail?.pipesPassed ?? 0 }} 根</span>
                </div>
                <div class="fly-hist__times">
                  <span>开始 {{ formatDateTime(row.detail?.startedAt) }}</span>
                  <span>结束 {{ formatDateTime(row.finishedAt) }}</span>
                </div>
              </div>
              <p v-if="!historyList.length" class="fly-hist__empty">还没有历史记录，先玩一局吧～</p>
            </div>
          </div>
          <div class="fly-panel__foot">
            <BaseButton type="primary" size="lg" @click="closeHistory">返回游戏</BaseButton>
          </div>
        </div>
      </div>

    </div>

    <div class="fly-hud">
      <div class="fly-score-big">{{ state.score }}</div>
      <div class="fly-right">
        <span class="fly-time">{{ formatTime(state.timeSurvived) }}</span>
        <button class="fly-board-btn" title="排行榜" @click="openBoard">榜</button>
        <button class="fly-board-btn" title="历史记录" @click="openHistory">史</button>
        <button class="fly-help-btn" title="玩法说明" @click="openHelp">?</button>
        <button class="fly-help-btn" title="暂停" @click="togglePause">⏸</button>
      </div>
    </div>

    <!-- 局部弹框：挂在本组件内，随飞鸟游戏旋转一起横过来；使用独立实例，与全局弹框完全隔离 -->
    <ConfirmDialog :scope="flyConfirm" />
  </div>
</template>

<style scoped>
.fly-game {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.fly-stage {
  position: relative;
  flex: 1;
  min-height: 50vh;
  width: 100%;
  overflow: hidden;
}
.fly-canvas {
  display: block;
  width: 100%;
  height: 100%;
  touch-action: none; /* 点击拍翅时不触发页面滚动/缩放 */
}
/* 竖屏：整块游戏区（画面 + HUD + 遮罩/弹窗）一起旋转 90° 横过来，落于顶部导航之下。
   旋转前盒子 宽=(视觉高)=100vh-导航高、高=(视觉宽)=100vw；旋转中心落在
   (50vw, 导航高+(视口高-导航高)/2)，使旋转后游戏区视觉上铺满导航下方的剩余空间，
   既不占满顶栏、也不被顶栏遮挡。 */
.fly-game.is-portrait {
  position: fixed;
  top: calc(var(--gs-head-h, 48px) + (100vh - var(--gs-head-h, 48px)) / 2);
  left: 50vw;
  width: calc(100vh - var(--gs-head-h, 48px)); /* 旋转前宽 → 视觉高（减掉导航） */
  height: 100vw; /* 旋转前高 → 视觉宽 = 屏宽 */
  transform: translate(-50%, -50%) rotate(90deg);
  transform-origin: center;
  z-index: 1;
}
.fly-hud {
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
.fly-score-big {
  font-variant-numeric: tabular-nums;
  font-weight: 900;
  font-size: 40px;
  color: #fff;
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
  line-height: 1;
}
.fly-right {
  display: flex;
  align-items: center;
  gap: 8px;
  pointer-events: auto;
}
.fly-time {
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  color: #fff;
  background: rgba(0, 0, 0, 0.25);
  padding: 2px 8px;
  border-radius: 999px;
}
.fly-board-btn,
.fly-help-btn {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.25);
  color: #fff;
  font-weight: 700;
  cursor: pointer;
}
.fly-board-btn:active,
.fly-help-btn:active {
  filter: brightness(0.9);
}
.fly-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  background: rgba(40, 30, 20, 0.55);
  backdrop-filter: blur(2px);
  z-index: 5; /* 默认层级 = 开始/结束遮罩 */
}
/* 遮罩层级（低→高）：开始/结束(5) < 暂停(6) < 帮助(7) < 历史(8) < 榜单(9)；HUD(10) 与横屏提示(30) 更高 */
.fly-overlay--pause { z-index: 6; }
.fly-overlay--help { z-index: 7; }
.fly-overlay--hist { z-index: 8; }
.fly-overlay--board { z-index: 9; }
.fly-overlay__title {
  color: #fff;
  font-size: 24px;
  font-family: var(--font-display);
}
.fly-over,
.fly-start {
  background: var(--surface);
  border-radius: var(--radius);
  padding: 22px 24px;
  max-width: 86%;
  text-align: center;
}
.fly-start h3,
.fly-over h3 {
  margin: 0 0 10px;
  font-family: var(--font-display);
}
.fly-start p,
.fly-over p {
  margin: 0 0 14px;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.6;
}
.fly-over b {
  color: var(--primary);
}
.fly-panel {
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
.fly-panel--help {
  width: min(420px, 90%);
}
.fly-panel__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 20px 22px;
}
.fly-panel__foot {
  flex-shrink: 0;
  display: flex;
  padding: 12px 22px;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
}
.fly-panel__foot :deep(.base-btn) {
  width: 100%;
}
.fly-help__rules {
  margin: 0;
  padding-left: 18px;
  color: var(--text);
  font-size: 13px;
  line-height: 1.7;
}
.fly-board h3,
.fly-hist h3 {
  margin: 0 0 12px;
  font-family: var(--font-display);
}
.fly-board__list {
  list-style: none;
  margin: 0 0 4px;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.fly-board__item {
  display: grid;
  grid-template-columns: 26px 1fr auto;
  grid-template-areas: 'no name plat' 'no score score';
  gap: 2px 8px;
  align-items: center;
  padding: 7px 10px;
  border-radius: 10px;
  background: rgba(91, 140, 123, 0.08);
}
.fly-board__no {
  grid-area: no;
  font-weight: 700;
  color: var(--primary);
  text-align: center;
}
.fly-board__name {
  grid-area: name;
  font-weight: 600;
}
.fly-board__plat {
  grid-area: plat;
  font-size: 12px;
  padding: 1px 8px;
  border-radius: 999px;
  justify-self: end;
  background: rgba(201, 116, 59, 0.18);
  color: var(--primary);
}
.fly-board__score {
  grid-area: score;
  font-size: 13px;
  color: var(--text);
}
.fly-board__empty {
  color: var(--muted);
  font-size: 13px;
  text-align: center;
  padding: 16px 0;
}
.fly-hist__list {
  margin: 0 0 4px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.fly-hist__item {
  padding: 8px 10px;
  border-radius: 10px;
  background: rgba(91, 140, 123, 0.08);
}
.fly-hist__top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 4px;
}
.fly-hist__score {
  font-weight: 800;
  color: var(--primary);
  font-variant-numeric: tabular-nums;
}
.fly-hist__alive {
  font-size: 12px;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}
.fly-hist__times {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12px;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
.fly-hist__empty {
  color: var(--muted);
  font-size: 13px;
  text-align: center;
  padding: 16px 0;
}
</style>
