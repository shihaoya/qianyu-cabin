<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { listPrizes, drawRaffle } from '../api/raffles.js'
import { listBenefitTypes, listFans, adjustFanCardsBatch, listReasons } from '../api/benefits.js'
import { fetchFileObjectURL } from '../api/files.js'
import { prizeIconText, QUICK_DRAW_COUNTS, MAX_BATCH_COUNT } from '@cabin/raffle.js'
import mascotUrl from '@cabin/assets/qycj.png'
import AppHeader from '../components/base/AppHeader.vue'
import BaseButton from '../components/base/BaseButton.vue'
import BaseModal from '../components/base/BaseModal.vue'
import BaseInput from '../components/base/BaseInput.vue'

// ---------- 奖池 ----------
const prizes = ref([])
const loading = ref(false)
const error = ref('')

// 当前可用奖池（与后端 availableWhere 规则一致：启用 + 权重>0 + 库存充足）
const availablePrizes = computed(() =>
  prizes.value.filter((p) => p.enabled && p.weight > 0 && (p.stock === -1 || p.stock > 0)),
)

// ---------- 抽奖参数 ----------
const QUICK_COUNTS = QUICK_DRAW_COUNTS
const drawMode = ref('1') // '1'|'5'|'10'|'20'|'50'|'batch'
const customCount = ref(100)
const selectedFan = ref(null) // { id, nickname }
const drawing = ref(false) // 正在旋转闪烁中（可停止）
const drawingRequest = ref(false) // 正在请求后端
const drawError = ref('')
const currentResults = ref([]) // 累积的抽奖结果列表
// 结果区分页显示（防止一次渲染过多导致卡顿）
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

// ---------- 中央闪烁礼物 ----------
const flashing = ref(false)
const flashPrize = ref(null) // 当前闪烁显示的奖品
let flashTimer = null

function startFlash() {
  stopFlash()
  flashing.value = true
  // 闪烁时随机显示可用奖池里的奖品
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

// ---------- 彩带庆祝 ----------
const confettiPieces = ref([])
const confettiSeed = ref(0)
let confettiTimer = null

const CONFETTI_COLORS = ['#e0a23b', '#c9743b', '#5b8c7b', '#e8c47f', '#f7d9a8', '#ffd700', '#ff6b6b']

function randomIn(min, max) {
  return min + Math.random() * (max - min)
}

function buildConfetti() {
  const seed = confettiSeed.value
  confettiPieces.value = Array.from({ length: 40 }, (_, i) => ({
    id: `${seed}-${i}`,
    left: randomIn(0, 100),
    delay: randomIn(0, 0.5),
    duration: randomIn(1.8, 3),
    size: randomIn(6, 12),
    round: (i + seed) % 3 === 0,
    color: CONFETTI_COLORS[(i + seed) % CONFETTI_COLORS.length],
  }))
}

function startConfetti() {
  stopConfetti()
  confettiSeed.value += 1
  buildConfetti()
  confettiTimer = setTimeout(() => {
    confettiPieces.value = []
  }, 3400)
}

function stopConfetti() {
  if (confettiTimer) {
    clearTimeout(confettiTimer)
    confettiTimer = null
  }
  confettiPieces.value = []
}

// ---------- 图片 ObjectURL 缓存 ----------
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
  } catch {
    // 图片拉取失败不阻塞
  }
}

onBeforeUnmount(() => {
  stopFlash()
  stopConfetti()
  revoked.forEach((u) => URL.revokeObjectURL(u))
})

async function loadPrizes() {
  loading.value = true
  error.value = ''
  try {
    const data = await listPrizes()
    prizes.value = data.list || []
    for (const p of prizes.value) {
      if (p.imageFileId) ensureImageUrl(p.imageFileId)
    }
  } catch (e) {
    error.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

// ---------- 抽奖 ----------
async function startDraw() {
  if (drawing.value || drawingRequest.value) return
  if (!availablePrizes.value.length) {
    drawError.value = '当前没有可抽取的礼品'
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

  let n
  if (drawMode.value === 'batch') {
    n = Number(customCount.value)
    if (!Number.isInteger(n) || n < 1 || n > MAX_BATCH_COUNT) {
      drawError.value = `自定义次数必须为 1~${MAX_BATCH_COUNT} 的整数`
      drawingRequest.value = false
      return
    }
  } else {
    n = Number(drawMode.value)
  }

  try {
    // 粉丝在发放弹窗里才选择，抽奖记录不绑定 fanId
    const data = await drawRaffle({ count: n })
    const records = data.records || []
    const newResults = records.map((r) => {
      const prize = prizes.value.find((p) => p.id === r.prizeId)
      return { ...prize, recordId: r.id, fanNickname: r.fanNickname }
    }).filter(Boolean)
    currentResults.value = [...currentResults.value, ...newResults]
    resultsPage.value = 1 // 新结果回到第一页
    startConfetti()
    await loadPrizes()
  } catch (e) {
    drawError.value = e.message || '抽奖失败'
  } finally {
    drawingRequest.value = false
  }
}

// ---------- 发福利 ----------
const benefitTypes = ref([])
const reasons = ref([])
const showGrantModal = ref(false)
const grantRows = ref([])
const grantReason = ref('')
const grantAdjusting = ref(false)
const grantError = ref('')

const batchReasons = computed(() =>
  reasons.value.filter((r) => (r.type || 'common') === 'common' || (r.type || 'common') === 'add'),
)

async function loadBenefitData() {
  try {
    const [typesData, reasonsData] = await Promise.all([listBenefitTypes(), listReasons()])
    benefitTypes.value = typesData.list || []
    reasons.value = reasonsData.list || []
  } catch {
    // 静默失败，打开弹窗时再加载
  }
}

function openGrantModal() {
  if (!currentResults.value.length) return
  grantError.value = ''
  grantReason.value = ''
  const typeCount = new Map()
  for (const r of currentResults.value) {
    if (r.benefitTypeId) {
      typeCount.set(r.benefitTypeId, (typeCount.get(r.benefitTypeId) || 0) + 1)
    }
  }
  grantRows.value = benefitTypes.value
    .filter(t => typeCount.has(t.id))
    .map(t => ({
      typeId: t.id,
      typeName: t.name,
      count: typeCount.get(t.id),
      delta: String(typeCount.get(t.id)),
    }))
  showGrantModal.value = true
  // 预加载粉丝列表，避免弹窗内等待
  if (!fanOptions.value.length) loadFans()
}

function pickGrantReason(text) {
  grantReason.value = grantReason.value === text ? '' : text
}

const grantActiveRows = computed(() =>
  grantRows.value.filter((r) => Number(r.delta) !== 0 && r.delta !== ''),
)

async function submitGrant() {
  if (!selectedFan.value || grantAdjusting.value) return
  const note = grantReason.value.trim()
  if (!note) {
    grantError.value = '请填写备注'
    return
  }
  if (!grantActiveRows.value.length) {
    grantError.value = '请至少填写一种福利的发放数量'
    return
  }

  grantAdjusting.value = true
  grantError.value = ''
  try {
    await adjustFanCardsBatch(selectedFan.value.id, {
      reason: note,
      items: grantActiveRows.value.map((r) => ({ typeId: r.typeId, delta: Number(r.delta) })),
    })
    showGrantModal.value = false
  } catch (e) {
    grantError.value = e.message || '发放失败'
  } finally {
    grantAdjusting.value = false
  }
}

// ---------- 粉丝选择 ----------
const showFanPicker = ref(false)
const fanKeyword = ref('')
const fanOptions = ref([])
const fanLoading = ref(false)

async function loadFans() {
  fanLoading.value = true
  try {
    let page = 1
    let collected = []
    for (;;) {
      const data = await listFans({ page, pageSize: 50 })
      collected = collected.concat(data.list || [])
      if (collected.length >= (data.total || 0)) break
      if (!(data.list || []).length) break
      page += 1
    }
    fanOptions.value = collected
  } catch {
    fanOptions.value = []
  } finally {
    fanLoading.value = false
  }
}

const filteredFans = computed(() => {
  const kw = fanKeyword.value.trim().toLowerCase()
  if (!kw) return fanOptions.value
  return fanOptions.value.filter(f =>
    (f.nickname || '').toLowerCase().includes(kw) ||
    (f.douyinAccount || '').toLowerCase().includes(kw) ||
    (f.systemAccount || '').toLowerCase().includes(kw),
  )
})

function openFanPicker() {
  showFanPicker.value = true
  fanKeyword.value = ''
  if (!fanOptions.value.length) loadFans()
}

function pickFan(fan) {
  selectedFan.value = { id: fan.id, nickname: fan.nickname }
  showFanPicker.value = false
}

function clearFan() {
  selectedFan.value = null
}

onMounted(async () => {
  await loadPrizes()
  await loadBenefitData()
})
</script>

<template>
  <div class="page">
    <AppHeader />
    <main class="page__main">
      <!-- 串灯装饰 -->
      <div class="lights">
        <span
          v-for="n in 10"
          :key="n"
          class="bulb"
          :style="{ animationDelay: `${n * 0.22}s` }"
        />
      </div>

      <section class="qy-rise">
        <header class="hero">
          <p class="hero__eyebrow">
            ✦ 千羽的小屋 · 直播抽奖 ✦
          </p>
          <p
            v-if="error"
            class="rl-error"
          >
            {{ error }}
          </p>
        </header>

        <!-- 中央抽奖区 -->
        <div class="draw-stage">
          <div class="draw-stage__glow" />
          <div
            class="gift-box"
            :class="{ 'is-flashing': flashing, 'is-revealed': currentResults.length && !flashing }"
          >
            <div class="gift-box__inner">
              <img
                v-if="flashing && flashPrize?.imageFileId && imageUrls.get(flashPrize.imageFileId)"
                :src="imageUrls.get(flashPrize.imageFileId)"
                :alt="flashPrize.name"
                class="gift-box__img"
              >
              <img
                v-else-if="!flashing && currentResults[currentResults.length - 1]?.imageFileId && imageUrls.get(currentResults[currentResults.length - 1].imageFileId)"
                :src="imageUrls.get(currentResults[currentResults.length - 1].imageFileId)"
                :alt="currentResults[currentResults.length - 1].name"
                class="gift-box__img"
              >
              <span
                v-else
                class="gift-box__emoji"
              >{{ flashing ? prizeIconText(flashPrize?.name) : prizeIconText(currentResults[currentResults.length - 1]?.name) }}</span>
              <span class="gift-box__name">{{ flashing ? (flashPrize?.name || '???') : (currentResults[currentResults.length - 1]?.name || '???') }}</span>
            </div>
          </div>
        </div>

        <!-- 操作区 -->
        <div class="controls">
          <!-- 快捷抽数选择 + 批量输入 -->
          <div class="count-quick">
            <button
              v-for="n in QUICK_COUNTS"
              :key="n"
              type="button"
              class="count-chip"
              :class="{ 'is-active': drawMode === String(n) }"
              :disabled="drawing || drawingRequest"
              @click="drawMode = String(n)"
            >
              {{ n }}抽
            </button>
            <button
              type="button"
              class="count-chip"
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
              class="count-custom"
              min="1"
              :max="MAX_BATCH_COUNT"
              :disabled="drawing || drawingRequest"
            >
            <span
              v-if="drawMode === 'batch'"
              class="count-unit"
            >次</span>
          </div>

          <div class="btn-group">
            <BaseButton
              type="primary"
              :disabled="drawing || drawingRequest || !availablePrizes.length"
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
        </div>

        <p
          v-if="drawError"
          class="rl-error"
        >
          {{ drawError }}
        </p>

        <!-- 抽奖结果（带角色趴趴效果） -->
        <div
          v-if="currentResults.length"
          class="result-panel"
        >
          <!-- 角色趴在卡片上 -->
          <div class="result-panel__mascot">
            <img
              :src="mascotUrl"
              alt="千羽"
            >
          </div>
          <div class="result-panel__card">
            <div class="result-panel__header">
              <h3>🎉 抽奖结果</h3>
              <span class="result-panel__count">共 {{ currentResults.length }} 个</span>
              <BaseButton
                type="primary"
                size="sm"
                @click="openGrantModal"
              >
                发放给粉丝
              </BaseButton>
            </div>
            <div class="result-scroll">
              <div class="result-grid">
                <div
                  v-for="r in displayedResults"
                  :key="r.recordId || r._idx"
                  class="result-cell"
                  :style="{ animationDelay: `${(r._idx % RESULTS_PAGE_SIZE) * 0.03}s` }"
                >
                  <img
                    v-if="r.imageFileId && imageUrls.get(r.imageFileId)"
                    :src="imageUrls.get(r.imageFileId)"
                    :alt="r.name"
                    class="result-cell__img"
                  >
                  <span
                    v-else
                    class="result-cell__char"
                  >{{ prizeIconText(r.name) }}</span>
                  <span class="result-cell__name">{{ r.name }}</span>
                </div>
              </div>
              <!-- 结果过多时分页显示 -->
              <div
                v-if="currentResults.length > RESULTS_PAGE_SIZE"
                class="result-pager"
              >
                <button
                  type="button"
                  :disabled="resultsPage <= 1"
                  @click="resultsPage--"
                >
                  上一页
                </button>
                <span>{{ resultsPage }} / {{ resultsTotalPages }}</span>
                <button
                  type="button"
                  :disabled="resultsPage >= resultsTotalPages"
                  @click="resultsPage++"
                >
                  下一页
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 发放给粉丝弹窗（底部弹层） -->
      <BaseModal
        v-if="showGrantModal"
        title="发放给粉丝"
        sheet
        :z-index="1000"
        @close="showGrantModal = false"
      >
        <p
          v-if="grantError"
          class="rl-error"
        >
          {{ grantError }}
        </p>

        <!-- 粉丝选择 -->
        <div class="fan-select">
          <span class="fan-select__label">发放给</span>
          <template v-if="selectedFan">
            <span class="fan-select__name">{{ selectedFan.nickname }}</span>
          </template>
          <button
            v-else
            type="button"
            class="fan-select__pick"
            @click="openFanPicker"
          >
            选择粉丝
          </button>
          <button
            v-if="selectedFan"
            type="button"
            class="fan-select__clear"
            @click="clearFan"
          >
            清除
          </button>
        </div>

        <template v-if="selectedFan">
          <!-- 抽到的福利类型迷你卡片（双列） -->
          <div class="grant__cards">
            <div
              v-for="row in grantRows"
              :key="row.typeId"
              class="grant-card"
            >
              <div class="grant-card__icon">{{ prizeIconText(row.typeName) }}</div>
              <div class="grant-card__info">
                <div class="grant-card__name">{{ row.typeName }}</div>
                <div class="grant-card__count">×{{ row.count }}</div>
              </div>
              <input
                v-model="row.delta"
                type="number"
                class="grant-card__input"
                min="0"
              >
            </div>
          </div>

          <p
            v-if="!grantRows.length"
            class="grant__empty"
          >
            本次抽中的奖品没有关联福利类型
          </p>

          <BaseInput
            v-model="grantReason"
            label="备注（必填）"
            type="text"
            placeholder="如：直播抽奖中奖"
          />

          <div
            v-if="batchReasons.length"
            class="grant__chips"
          >
            <button
              v-for="r in batchReasons"
              :key="r.id"
              type="button"
              class="grant__chip"
              :class="{ 'is-active': grantReason === r.text }"
              @click="pickGrantReason(r.text)"
            >
              {{ r.text }}
            </button>
          </div>
        </template>

        <template v-else>
          <p class="fan-picker__hint">
            请先选择要发放的粉丝
          </p>
        </template>

        <template #footer>
          <BaseButton
            type="text"
            @click="showGrantModal = false"
          >
            取消
          </BaseButton>
          <BaseButton
            v-if="selectedFan"
            type="primary"
            :loading="grantAdjusting"
            :disabled="grantAdjusting || !grantActiveRows.length"
            @click="submitGrant"
          >
            确认发放
          </BaseButton>
        </template>
      </BaseModal>

      <!-- 粉丝选择弹窗（嵌套在发放弹窗里） -->
      <BaseModal
        v-if="showFanPicker"
        title="选择粉丝"
        sheet
        :z-index="1100"
        @close="showFanPicker = false"
      >
        <div class="fan-picker">
          <div class="fan-picker__search">
            <input
              v-model="fanKeyword"
              placeholder="搜索昵称 / 抖音号 / 系统内账号"
              @keyup.enter="loadFans"
            >
            <BaseButton
              type="default"
              @click="loadFans"
            >
              刷新
            </BaseButton>
          </div>
          <p
            v-if="fanLoading"
            class="fan-picker__empty"
          >
            正在加载...
          </p>
          <p
            v-else-if="!filteredFans.length"
            class="fan-picker__empty"
          >
            {{ fanKeyword ? '没有匹配的粉丝' : '还没有粉丝' }}
          </p>
          <div
            v-else
            class="fan-chips"
          >
            <button
              v-for="fan in filteredFans"
              :key="fan.id"
              type="button"
              class="fan-chip"
              :class="{ 'is-active': selectedFan?.id === fan.id }"
              @click="pickFan(fan)"
            >
              {{ fan.nickname }}
            </button>
          </div>
        </div>
      </BaseModal>

      <!-- 彩带庆祝层 -->
      <div
        class="confetti"
        aria-hidden="true"
      >
        <span
          v-for="p in confettiPieces"
          :key="p.id"
          class="confetti-piece"
          :class="{ 'is-round': p.round }"
          :style="{
            left: `${p.left}%`,
            width: `${p.size}px`,
            height: `${p.round ? p.size : p.size * 0.55}px`,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }"
        />
      </div>
    </main>
  </div>
</template>

<style scoped>
.page__main {
  position: relative;
  padding: 18px 16px 90px;
  overflow: hidden;
}

/* 串灯 */
.lights {
  display: flex;
  justify-content: space-between;
  padding: 0 6px;
  margin-bottom: 16px;
}

.bulb {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #e8c47f;
  box-shadow: 0 0 6px rgba(232, 196, 127, .8);
  animation: blink 2.5s ease-in-out infinite;
}

@keyframes blink {
  0%, 100% { opacity: .4; }
  50% { opacity: 1; }
}

/* 头部 */
.hero {
  text-align: center;
  margin-bottom: 24px;
}

.hero__eyebrow {
  font-size: 10px;
  letter-spacing: 3px;
  color: var(--primary);
  margin-bottom: 6px;
}

.hero__title {
  font-family: var(--font-display);
  font-size: 28px;
  color: var(--text);
  margin-bottom: 4px;
}

.hero__sub {
  font-size: 12px;
  color: var(--muted);
}

.rl-error {
  margin-top: 10px;
  color: #d9534f;
  font-size: 13px;
}

/* 中央抽奖区 */
.draw-stage {
  position: relative;
  height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
}

.draw-stage__glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 50% 50%, rgba(224, 162, 59, .12), transparent 60%);
  pointer-events: none;
}

.gift-box {
  width: 120px;
  height: 120px;
  background: linear-gradient(135deg, var(--primary-soft), #e8c47f);
  border: 3px solid var(--primary);
  border-radius: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 2;
  transition: all .15s;
}

.gift-box.is-flashing {
  animation: flash .3s ease-in-out infinite;
}

@keyframes flash {
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

.gift-box.is-revealed {
  animation: reveal .5s cubic-bezier(.34, 1.56, .64, 1);
  background: linear-gradient(135deg, #ffd700, #e8c47f);
  border-color: #ffd700;
}

@keyframes reveal {
  0% { transform: scale(.5); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

.gift-box__inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  height: 100%;
}

.gift-box__img {
  width: 48px;
  height: 48px;
  object-fit: contain;
  flex-shrink: 0;
}

.gift-box__emoji {
  font-size: 40px;
  line-height: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.gift-box__name {
  font-family: var(--font-display);
  font-size: 14px;
  color: var(--text);
  line-height: 1.3;
  max-width: 90%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 操作区 */
.controls {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  margin-bottom: 16px;
}

.count-quick {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
}

.count-chip {
  padding: 7px 16px;
  border: 1px solid var(--primary-soft);
  border-radius: 999px;
  background: var(--surface);
  font-size: 13px;
  color: var(--muted);
  cursor: pointer;
  transition: all .15s;
}

.count-chip:hover:not(:disabled) {
  border-color: var(--primary);
  color: var(--primary);
}

.count-chip.is-active {
  background: var(--primary);
  border-color: var(--primary);
  color: #fff;
  font-weight: 600;
}

/* 激活态禁用按钮也要保持白字 */
.count-chip.is-active:disabled {
  opacity: .8;
  color: #fff;
}

/* 激活态 hover 也要保持白字，不能被 hover 颜色覆盖 */
.count-chip.is-active:hover:not(:disabled) {
  border-color: var(--primary);
  color: #fff;
}

.count-chip:disabled {
  opacity: .5;
  cursor: not-allowed;
}

.count-custom {
  width: 64px;
  padding: 7px 10px;
  border: 2px solid var(--primary-soft);
  border-radius: 999px;
  font-size: 13px;
  text-align: center;
  color: var(--text);
  background: #fff;
  outline: none;
  transition: border-color .15s;
}

.count-custom:focus {
  border-color: var(--primary);
}

.count-custom:disabled {
  opacity: .5;
  cursor: not-allowed;
}

.count-unit {
  font-size: 13px;
  color: var(--muted);
}

.btn-group {
  display: flex;
  gap: 14px;
}

/* 抽奖结果面板（角色趴趴） */
.result-panel {
  position: relative;
  margin-top: 100px;
}

.result-panel__mascot {
  position: absolute;
  top: -90px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 3;
  pointer-events: none;
  filter: drop-shadow(0 3px 6px rgba(0,0,0,.12));
}

.result-panel__mascot img {
  width: 120px;
  height: auto;
  display: block;
}

.result-panel__card {
  background: var(--surface);
  border: 2px solid var(--primary-soft);
  border-radius: 16px;
  padding: 16px;
  padding-top: 24px;
  box-shadow: 0 6px 24px rgba(120, 90, 50, .1);
  position: relative;
  z-index: 2;
}

.result-panel__header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.result-panel__header h3 {
  font-size: 18px;
  color: var(--text);
  margin: 0;
  flex: 1;
}

.result-panel__count {
  font-size: 11px;
  color: var(--muted);
  background: var(--primary-soft);
  padding: 3px 10px;
  border-radius: 999px;
}

.result-scroll {
  max-height: 160px;
  overflow-y: auto;
  padding-right: 4px;
}

.result-scroll::-webkit-scrollbar {
  width: 4px;
}

.result-scroll::-webkit-scrollbar-thumb {
  background: var(--primary-soft);
  border-radius: 2px;
}

.result-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(64px, 1fr));
  gap: 8px;
}

.result-cell {
  aspect-ratio: 1;
  background: var(--primary-soft);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  animation: pop-in .4s cubic-bezier(.34, 1.56, .64, 1);
}

@keyframes pop-in {
  0% { transform: scale(0); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

.result-cell__img {
  width: 20px;
  height: 20px;
  object-fit: contain;
}

/* 无图时用名称首字做图标，深底白字和格子背景区分 */
.result-cell__char {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--primary);
  color: #fff;
  font-family: var(--font-display);
  font-size: 11px;
  line-height: 1;
}

.result-cell__name {
  font-size: 8px;
  color: var(--text);
  font-weight: 600;
}

/* 粉丝选择（弹窗内） */
.fan-select {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: var(--primary-soft);
  border-radius: 10px;
  margin-bottom: 14px;
}

.fan-select__label {
  font-size: 12px;
  color: var(--muted);
}

.fan-select__name,
.fan-select__pick {
  font-size: 13px;
  font-weight: 600;
  padding: 0;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--primary);
}

.fan-select__name {
  cursor: default;
}

.fan-select__clear {
  margin-left: auto;
  font-size: 11px;
  color: var(--muted);
  background: none;
  border: none;
  cursor: pointer;
  text-decoration: underline;
}

/* 福利迷你卡片 */
.grant__cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 14px;
}

.grant-card {
  background: var(--primary-soft);
  border-radius: 10px;
  padding: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.grant-card__icon {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: var(--surface);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
}

.grant-card__info {
  flex: 1;
  min-width: 0;
}

.grant-card__name {
  font-size: 11px;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.grant-card__count {
  font-size: 9px;
  color: var(--muted);
}

.grant-card__input {
  width: 36px;
  padding: 5px 4px;
  border: 1px solid rgba(255, 255, 255, .6);
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  text-align: center;
  color: var(--text);
  background: #fff;
  outline: none;
  flex-shrink: 0;
}

.grant-card__input:focus {
  border-color: var(--primary);
}

.grant__empty {
  text-align: center;
  color: var(--muted);
  font-size: 13px;
  padding: 16px;
}

.grant__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}

.grant__chip {
  padding: 5px 12px;
  border: 1px solid var(--primary-soft);
  border-radius: 999px;
  background: var(--surface);
  font-size: 11px;
  color: var(--muted);
  cursor: pointer;
  transition: all .15s;
}

.grant__chip:hover {
  border-color: var(--primary);
  color: var(--primary);
}

.grant__chip.is-active {
  background: var(--primary);
  border-color: var(--primary);
  color: #fff;
}

/* 粉丝选择弹窗 */
.fan-picker {
  padding: 4px 0;
}

.fan-picker__hint {
  font-size: 13px;
  color: var(--muted);
  margin-bottom: 14px;
}

.fan-picker__search {
  display: flex;
  gap: 8px;
  margin-bottom: 14px;
}

.fan-picker__search input {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid var(--primary-soft);
  border-radius: 10px;
  font-size: 14px;
  color: var(--text);
  background: #fff;
  outline: none;
}

.fan-picker__search input:focus {
  border-color: var(--primary);
}

.fan-picker__empty {
  text-align: center;
  color: var(--muted);
  padding: 20px;
}

.fan-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-height: 280px;
  overflow-y: auto;
  padding: 4px 0;
}

.fan-chip {
  padding: 8px 14px;
  border: 1px solid var(--primary-soft);
  border-radius: 999px;
  background: var(--surface);
  font-size: 13px;
  color: var(--text);
  cursor: pointer;
  transition: all .12s;
  white-space: nowrap;
}

.fan-chip:hover {
  border-color: var(--primary);
  color: var(--primary);
  background: rgba(201, 116, 59, .06);
}

.fan-chip.is-active {
  background: var(--primary);
  border-color: var(--primary);
  color: #fff;
}

/* 彩带庆祝（z-index 低于弹窗 1000，避免遮住弹窗） */
.confetti {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 900;
  overflow: hidden;
}

.confetti-piece {
  position: absolute;
  top: -14px;
  border-radius: 1px;
  opacity: 0.95;
  animation: confetti-fall 2s linear forwards;
}

.confetti-piece.is-round {
  border-radius: 50%;
}

@keyframes confetti-fall {
  0% { transform: translate3d(0, -14px, 0) rotate(0deg); opacity: 0.95; }
  100% { transform: translate3d(10px, 105vh, 0) rotate(520deg); opacity: 0.85; }
}
</style>
