<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { selfDraw, listSelfDrawRecords, listPrizes } from '../api/raffles.js'
import { getMyBenefits } from '../api/benefits.js'
import { fetchFileObjectURL } from '../api/files.js'
import { prizeIconText, QUICK_DRAW_COUNTS, MAX_BATCH_COUNT } from '@cabin/raffle.js'
import mascotUrl from '@cabin/assets/qycj.png'
import AppHeader from '../components/base/AppHeader.vue'
import BaseButton from '../components/base/BaseButton.vue'
import BasePager from '../components/base/BasePager.vue'
import { usePagination } from '../composables/usePagination.js'

// ---------- 粉丝档案与抽奖次数 ----------
const bound = ref(false)
const fanNickname = ref('')
const drawCount = ref(0)
const loading = ref(false)
const error = ref('')

// ---------- 自助抽奖（和直播抽奖一致的闪烁效果） ----------
const drawing = ref(false) // 正在闪烁中（可停止）
const drawingRequest = ref(false) // 正在请求后端
const drawError = ref('')
const flashing = ref(false)
const flashPrize = ref(null)
const currentResults = ref([]) // 累积的抽奖结果
const drawMode = ref('1')
const customCount = ref(10)

// ---------- 奖池（闪烁时随机展示用） ----------
const prizes = ref([])
const availablePrizes = computed(() =>
  prizes.value.filter((p) => p.enabled && p.weight > 0 && (p.stock === -1 || p.stock > 0)),
)

// 快捷抽数选项（根据剩余次数动态过滤）
const quickCounts = computed(() => QUICK_DRAW_COUNTS.filter((n) => n <= drawCount.value))

// 实际抽的次数（不能超过剩余次数）
const actualDrawCount = computed(() => {
  if (drawMode.value === 'batch') {
    const n = Number(customCount.value)
    return Number.isInteger(n) && n >= 1 ? Math.min(n, Math.min(drawCount.value, MAX_BATCH_COUNT)) : 0
  }
  return Math.min(Number(drawMode.value), drawCount.value)
})

// 结果区分页（防止一次渲染过多）
const RESULTS_PAGE_SIZE = 100
const resultsPage = ref(1)
const displayedResults = computed(() => {
  const start = (resultsPage.value - 1) * RESULTS_PAGE_SIZE
  const slice = currentResults.value.slice(start, start + RESULTS_PAGE_SIZE)
  return slice.map((r, i) => ({ ...r, _idx: start + i }))
})
const resultsTotalPages = computed(() =>
  Math.ceil(currentResults.value.length / RESULTS_PAGE_SIZE),
)

let flashTimer = null

function startFlash() {
  stopFlash()
  flashing.value = true
  // 闪烁时随机显示可用奖池里的奖品名
  flashTimer = setInterval(() => {
    const pool = availablePrizes.value
    if (!pool.length) {
      flashPrize.value = { name: '???', imageFileId: null }
      return
    }
    flashPrize.value = pool[Math.floor(Math.random() * pool.length)]
  }, 80)
}

function stopFlash() {
  if (flashTimer) {
    clearInterval(flashTimer)
    flashTimer = null
  }
  flashing.value = false
}

// ---------- 历史记录分页 ----------
const historyPager = usePagination(
  ({ page, pageSize }) => listSelfDrawRecords({ page, pageSize }),
  { pageSize: 10 },
)

// ---------- 图片 ----------
const imageUrls = ref(new Map())
const revoked = []

async function ensureImageUrl(fileId) {
  if (!fileId || imageUrls.value.has(fileId)) return
  try {
    const url = await fetchFileObjectURL(fileId)
    revoked.push(url)
    const next = new Map(imageUrls.value)
    next.set(fileId, url)
    imageUrls.value = next
  } catch { /* 静默 */ }
}

onMounted(async () => {
  await loadMyInfo()
  await loadPrizePool()
  await historyPager.load(1)
})

onBeforeUnmount(() => {
  stopFlash()
  revoked.forEach((u) => URL.revokeObjectURL(u))
})

async function loadMyInfo() {
  loading.value = true
  error.value = ''
  try {
    const data = await getMyBenefits()
    bound.value = data.bound
    fanNickname.value = data.nickname || ''
    const drawCard = (data.cards || []).find((c) => c.isDrawCount)
    drawCount.value = drawCard ? drawCard.amount : 0
  } catch (e) {
    error.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

// 加载奖池（闪烁时随机展示奖品名用）
async function loadPrizePool() {
  try {
    const data = await listPrizes()
    prizes.value = data.list || []
    // 预加载奖品图片，闪烁时能直接显示
    for (const p of prizes.value) {
      if (p.imageFileId) await ensureImageUrl(p.imageFileId)
    }
  } catch {
    // 静默失败，闪烁时用 '???'
  }
}

// 从奖池里补充奖品信息（主要是 imageFileId）
function enrichResult(record) {
  const prize = prizes.value.find((p) => p.id === record.prizeId)
  return { ...record, imageFileId: prize?.imageFileId || null }
}

// 和直播抽奖一致：点开始 → 闪烁 → 点停止 → 出结果
function startDraw() {
  if (drawing.value || drawingRequest.value) return
  if (drawCount.value < 1) {
    drawError.value = '没有剩余抽奖次数'
    return
  }
  drawing.value = true
  drawError.value = ''
  startFlash()
}

async function stopDraw() {
  if (!drawing.value || drawingRequest.value) return
  stopFlash()
  drawing.value = false
  drawingRequest.value = true

  try {
    const data = await selfDraw({ count: actualDrawCount.value })
    const newResults = (data.records || []).map(enrichResult)
    currentResults.value = [...currentResults.value, ...newResults]
    resultsPage.value = 1
    await loadMyInfo()
    await historyPager.reload()
  } catch (e) {
    drawError.value = e.message || '抽奖失败'
  } finally {
    drawingRequest.value = false
  }
}

function fmtTime(value) {
  if (!value) return ''
  const d = new Date(value)
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
</script>

<template>
  <div class="page">
    <AppHeader />
    <main class="page__main">
      <section class="qy-rise">
        <header class="md-header">
          <h1 class="md-header__title">
            我的抽奖
          </h1>
          <p class="md-header__sub">
            {{ bound ? `${fanNickname}，你还有 ${drawCount} 次机会` : '绑定粉丝档案后可参与抽奖' }}
          </p>
        </header>

        <!-- 未绑定提示 -->
        <div
          v-if="!loading && !bound"
          class="md-unbound"
        >
          <p>🎫 你还没有绑定粉丝档案</p>
          <p class="md-unbound__hint">
            联系主播在「福利管理」里把你的站内账号和粉丝档案关联起来
          </p>
        </div>

        <!-- 抽奖区（和直播抽奖一致的闪烁效果） -->
        <div
          v-if="bound"
          class="md-draw"
        >
          <div class="md-draw__count">
            <span class="md-draw__num">{{ drawCount }}</span>
            <span class="md-draw__label">剩余次数</span>
          </div>

          <!-- 中央闪烁礼物盒 -->
          <div class="md-draw-stage">
            <div class="md-draw-stage__glow" />
            <div
              class="md-gift-box"
              :class="{ 'is-flashing': flashing, 'is-revealed': currentResults.length && !flashing }"
            >
              <div class="md-gift-box__inner">
                <img
                  v-if="flashing && flashPrize?.imageFileId && imageUrls.get(flashPrize.imageFileId)"
                  :src="imageUrls.get(flashPrize.imageFileId)"
                  :alt="flashPrize.name"
                  class="md-gift-box__img"
                >
                <img
                  v-else-if="!flashing && currentResults[currentResults.length - 1]?.imageFileId && imageUrls.get(currentResults[currentResults.length - 1].imageFileId)"
                  :src="imageUrls.get(currentResults[currentResults.length - 1].imageFileId)"
                  :alt="currentResults[currentResults.length - 1].prizeName"
                  class="md-gift-box__img"
                >
                <span
                  v-else
                  class="md-gift-box__emoji"
                >{{ flashing ? prizeIconText(flashPrize?.name) : prizeIconText(currentResults[currentResults.length - 1]?.prizeName) }}</span>
                <span class="md-gift-box__name">{{ flashing ? (flashPrize?.name || '???') : (currentResults[currentResults.length - 1]?.prizeName || '???') }}</span>
              </div>
            </div>
          </div>

          <!-- 快捷抽数 -->
          <div class="md-count-quick">
            <button
              v-for="n in quickCounts"
              :key="n"
              type="button"
              class="md-count-chip"
              :class="{ 'is-active': drawMode === String(n) }"
              :disabled="drawing || drawingRequest"
              @click="drawMode = String(n)"
            >
              {{ n }}抽
            </button>
            <button
              v-if="drawCount > 50"
              type="button"
              class="md-count-chip"
              :class="{ 'is-active': drawMode === 'batch' }"
              :disabled="drawing || drawingRequest"
              @click="drawMode = 'batch'"
            >
              批量
            </button>
            <input
              v-if="drawMode === 'batch'"
              v-model="customCount"
              type="number"
              class="md-count-custom"
              min="1"
              :max="drawCount"
              :disabled="drawing || drawingRequest"
            >
            <span
              v-if="drawMode === 'batch'"
              class="md-count-unit"
            >次</span>
          </div>

          <div class="md-btn-group">
            <BaseButton
              type="primary"
              :disabled="drawing || drawingRequest || drawCount < 1"
              @click="startDraw"
            >
              {{ drawing ? '闪烁中...' : '开始' }}
            </BaseButton>
            <BaseButton
              type="default"
              :disabled="!drawing || drawingRequest"
              @click="stopDraw"
            >
              停止
            </BaseButton>
          </div>
          <p
            v-if="drawError"
            class="md-error"
          >
            {{ drawError }}
          </p>
        </div>

        <!-- 抽奖结果（和直播抽奖一致：皮套趴趴 + 结果网格） -->
        <div
          v-if="currentResults.length"
          class="md-result-panel"
        >
          <div class="md-result-panel__mascot">
            <img
              :src="mascotUrl"
              alt="千羽"
            >
          </div>
          <div class="md-result-panel__card">
            <div class="md-result-panel__header">
              <h3>🎉 抽奖结果</h3>
              <span class="md-result-panel__count">共 {{ currentResults.length }} 个</span>
            </div>
            <div class="md-result-scroll">
              <div class="md-result-grid">
                <div
                  v-for="r in displayedResults"
                  :key="r.id || r._idx"
                  class="md-result-cell"
                  :style="{ animationDelay: `${(r._idx % RESULTS_PAGE_SIZE) * 0.03}s` }"
                >
                  <img
                    v-if="r.imageFileId && imageUrls.get(r.imageFileId)"
                    :src="imageUrls.get(r.imageFileId)"
                    :alt="r.prizeName"
                    class="md-result-cell__img"
                  >
                  <span
                    v-else
                    class="md-result-cell__char"
                  >{{ prizeIconText(r.prizeName) }}</span>
                  <span class="md-result-cell__name">{{ r.prizeName }}</span>
                </div>
              </div>
              <BasePager
                v-if="currentResults.length > RESULTS_PAGE_SIZE"
                :page="resultsPage"
                :total-pages="resultsTotalPages"
                @prev="resultsPage--"
                @next="resultsPage++"
              />
            </div>
          </div>
        </div>

        <!-- 历史记录 -->
        <div
          v-if="historyPager.list.value.length"
          class="md-history"
        >
          <h3>📋 我的抽奖历史</h3>
          <div class="md-history__list">
            <div
              v-for="r in historyPager.list.value"
              :key="r.id"
              class="md-history__item"
            >
              <span class="md-history__prize">{{ r.prizeName }}</span>
              <span class="md-history__time">{{ fmtTime(r.createdAt) }}</span>
            </div>
          </div>
          <BasePager
            :page="historyPager.page.value"
            :total-pages="historyPager.totalPages.value"
            :disabled="historyPager.loading.value"
            @prev="historyPager.prev"
            @next="historyPager.next"
          />
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.page__main {
  width: 80%;
  max-width: 100%;
  margin: 0 auto;
  padding: 24px 20px 48px;
  overflow-x: hidden;
}

.md-header {
  text-align: center;
  margin-bottom: 28px;
}

.md-header__title {
  font-family: var(--font-display);
  font-size: 28px;
  color: var(--text);
  margin: 0 0 8px;
}

.md-header__sub {
  font-size: 14px;
  color: var(--muted);
  margin: 0;
}

.md-unbound {
  text-align: center;
  padding: 40px 20px;
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}

.md-unbound p {
  margin: 0 0 8px;
  font-size: 16px;
  color: var(--text);
}

.md-unbound__hint {
  font-size: 13px;
  color: var(--muted);
}

.md-draw {
  text-align: center;
  margin-bottom: 24px;
}

.md-draw__count {
  margin-bottom: 16px;
}

.md-draw__num {
  display: block;
  font-family: var(--font-display);
  font-size: 64px;
  font-weight: 700;
  color: var(--primary);
  line-height: 1;
}

.md-draw__label {
  font-size: 14px;
  color: var(--muted);
}

/* 快捷抽数 */
.md-count-quick {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  margin-bottom: 16px;
}

.md-count-chip {
  padding: 6px 14px;
  border: 1px solid var(--primary-soft);
  border-radius: 999px;
  background: var(--surface);
  font-size: 13px;
  color: var(--muted);
  cursor: pointer;
  transition: all .15s;
}

.md-count-chip:hover:not(:disabled) {
  border-color: var(--primary);
  color: var(--primary);
}

.md-count-chip.is-active {
  background: var(--primary);
  border-color: var(--primary);
  color: #fff;
  font-weight: 600;
}

.md-count-chip:disabled {
  opacity: .5;
  cursor: not-allowed;
}

.md-count-custom {
  width: 64px;
  padding: 6px 10px;
  border: 2px solid var(--primary-soft);
  border-radius: 999px;
  font-size: 13px;
  text-align: center;
  color: var(--text);
  background: #fff;
  outline: none;
}

.md-count-custom:focus {
  border-color: var(--primary);
}

.md-count-custom:disabled {
  opacity: .5;
}

.md-count-unit {
  font-size: 13px;
  color: var(--muted);
}

/* 按钮组 */
.md-btn-group {
  display: flex;
  gap: 14px;
  justify-content: center;
}

.md-error {
  margin-top: 12px;
  color: #d9534f;
  font-size: 14px;
}

/* 中央闪烁礼物盒（和直播抽奖一致） */
.md-draw-stage {
  position: relative;
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24px;
}

.md-draw-stage__glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 50% 50%, rgba(224, 162, 59, .12), transparent 60%);
  pointer-events: none;
}

.md-gift-box {
  width: 140px;
  height: 140px;
  background: linear-gradient(135deg, var(--primary-soft), #e8c47f);
  border: 3px solid var(--primary);
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 2;
  transition: all .15s;
}

.md-gift-box.is-flashing {
  animation: md-flash .3s ease-in-out infinite;
}

@keyframes md-flash {
  0%, 100% {
    background: linear-gradient(135deg, var(--primary-soft), #e8c47f);
    box-shadow: 0 4px 20px rgba(201, 116, 59, .2);
  }
  50% {
    background: linear-gradient(135deg, #e8c47f, var(--primary));
    box-shadow: 0 8px 32px rgba(201, 116, 59, .4);
    transform: scale(1.05);
  }
}

.md-gift-box.is-revealed {
  animation: md-reveal .5s cubic-bezier(.34, 1.56, .64, 1);
  background: linear-gradient(135deg, #ffd700, #e8c47f);
  border-color: #ffd700;
}

@keyframes md-reveal {
  0% { transform: scale(.5); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

.md-gift-box__inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  height: 100%;
}

.md-gift-box__img {
  width: 56px;
  height: 56px;
  object-fit: contain;
  flex-shrink: 0;
}

.md-gift-box__emoji {
  font-size: 48px;
  line-height: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.md-gift-box__name {
  font-family: var(--font-display);
  font-size: 16px;
  color: var(--text);
  line-height: 1.3;
  max-width: 90%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 抽奖结果面板（皮套趴趴 + 结果网格） */
.md-result-panel {
  position: relative;
  margin-top: 40px;
  margin-bottom: 24px;
}

.md-result-panel__mascot {
  position: absolute;
  top: -100px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 3;
  pointer-events: none;
  filter: drop-shadow(0 0 6px rgba(0,0,0,.2));
}

.md-result-panel__mascot img {
  width: 140px;
  height: auto;
  display: block;
}

.md-result-panel__card {
  background: var(--surface);
  border: 2px solid var(--primary-soft);
  border-radius: 20px;
  padding: 24px;
  padding-top: 32px;
  box-shadow: 0 8px 32px rgba(120, 90, 50, .12);
  position: relative;
  z-index: 2;
  margin-top: 120px;
  min-height: 60vh;
  display: flex;
  flex-direction: column;
}

.md-result-panel__header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.md-result-panel__header h3 {
  font-size: 24px;
  color: var(--text);
  margin: 0;
  flex: 1;
}

.md-result-panel__count {
  font-size: 14px;
  color: var(--muted);
  background: var(--primary-soft);
  padding: 6px 16px;
  border-radius: 999px;
}

/* 结果网格占满剩余空间 */
.md-result-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 4px;
}

.md-result-scroll::-webkit-scrollbar {
  width: 4px;
}

.md-result-scroll::-webkit-scrollbar-thumb {
  background: var(--primary-soft);
  border-radius: 2px;
}

.md-result-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
  gap: 12px;
}

.md-result-cell {
  position: relative;
  aspect-ratio: 1;
  background: var(--primary-soft);
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  animation: md-pop-in .4s cubic-bezier(.34, 1.56, .64, 1);
}

@keyframes md-pop-in {
  0% { transform: scale(0); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

.md-result-cell__img {
  width: 48px;
  height: 48px;
  object-fit: contain;
}

/* 无图时用名称首字做图标，深底白字和格子背景区分 */
.md-result-cell__char {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--primary);
  color: #fff;
  font-family: var(--font-display);
  font-size: 20px;
  line-height: 1;
}

.md-result-cell__name {
  font-size: 18px;
  color: var(--text);
  font-weight: 600;
}

.md-result {
  margin-bottom: 24px;
  padding: 18px;
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  text-align: center;
}

.md-result h3 {
  margin: 0 0 14px;
  font-size: 16px;
  color: var(--text);
}

.md-result__grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
}

.md-result__cell {
  width: 80px;
  padding: 12px 8px;
  background: var(--primary-soft);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  animation: pop-in .4s cubic-bezier(.34, 1.56, .64, 1);
}

@keyframes pop-in {
  0% { transform: scale(0); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

.md-result__img {
  width: 36px;
  height: 36px;
  object-fit: contain;
}

.md-result__emoji {
  font-size: 32px;
}

.md-result__name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
}

.md-history h3 {
  font-size: 15px;
  color: var(--text);
  margin: 0 0 12px;
}

.md-history__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.md-history__item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  font-size: 13px;
}

.md-history__prize {
  flex: 1;
  color: var(--text);
  font-weight: 500;
}

.md-history__time {
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
</style>
