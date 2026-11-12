<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { listPrizes, drawRaffle } from '../api/raffles.js'
import { listFans } from '../api/benefits.js'
import { fetchFileObjectURL } from '../api/files.js'
import AppHeader from '../components/base/AppHeader.vue'
import BaseButton from '../components/base/BaseButton.vue'
import BaseModal from '../components/base/BaseModal.vue'

// ---------- 奖池 ----------
const prizes = ref([])
const loading = ref(false)
const error = ref('')

// 当前可用奖池（与后端 availableWhere 规则一致：启用 + 权重>0 + 库存充足）
const availablePrizes = computed(() =>
  prizes.value.filter((p) => p.enabled && p.weight > 0 && (p.stock === -1 || p.stock > 0)),
)
const totalAvailableWeight = computed(() =>
  availablePrizes.value.reduce((sum, p) => sum + p.weight, 0),
)

// ---------- 抽奖参数 ----------
const count = ref(1)
const skipAnimation = ref(false)
const drawing = ref(false)
const drawError = ref('')
const results = ref([]) // 最近抽取的奖品记录，倒序展示

// ---------- 指定粉丝 ----------
const showFanPicker = ref(false)
const fanKeyword = ref('')
const fanOptions = ref([])
const fanLoading = ref(false)
const selectedFan = ref(null) // { id, nickname }

// ---------- 动画 ----------
// 滚动高亮：在可用奖池里快速轮播，最后停在抽中的礼品上
const highlightId = ref(null)
let timer = null
function stopTimer() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
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
  stopTimer()
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

function probabilityText(p) {
  if (!totalAvailableWeight.value) return '0%'
  return `${((p.weight / totalAvailableWeight.value) * 100).toFixed(1)}%`
}

function stockText(p) {
  return p.stock === -1 ? '∞' : String(p.stock)
}

// ---------- 粉丝选择 ----------
async function searchFans() {
  fanLoading.value = true
  try {
    const data = await listFans({ page: 1, pageSize: 50, keyword: fanKeyword.value })
    fanOptions.value = data.list || []
  } catch {
    fanOptions.value = []
  } finally {
    fanLoading.value = false
  }
}

function openFanPicker() {
  showFanPicker.value = true
  fanKeyword.value = ''
  fanOptions.value = []
  searchFans()
}

function pickFan(fan) {
  selectedFan.value = { id: fan.id, nickname: fan.nickname }
  showFanPicker.value = false
}

function clearFan() {
  selectedFan.value = null
}

// ---------- 抽奖 ----------
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// 滚动动画：在可用奖池里轮播高亮，约 1.2s 后停在 targetId
async function runAnimation(targetId) {
  if (!availablePrizes.value.length) return
  const pool = availablePrizes.value
  const rounds = 18 + Math.floor(Math.random() * 6)
  for (let i = 0; i < rounds; i += 1) {
    highlightId.value = pool[i % pool.length].id
    await sleep(50 + i * 8)
  }
  highlightId.value = targetId
  await sleep(300)
}

async function doDraw() {
  if (drawing.value) return
  const n = Number(count.value)
  if (!Number.isInteger(n) || n < 1 || n > 100) {
    drawError.value = '抽奖次数必须为 1~100 的整数'
    return
  }
  if (!availablePrizes.value.length) {
    drawError.value = '当前没有可抽取的礼品，请先到「抽奖管理」里添加'
    return
  }

  drawing.value = true
  drawError.value = ''
  stopTimer()
  try {
    const data = await drawRaffle({ count: n, fanId: selectedFan.value ? selectedFan.value.id : null })
    const records = data.records || []

    if (skipAnimation.value) {
      // 跳过动画：直接展示全部结果
      highlightId.value = records.length ? records[records.length - 1].prizeId : null
    } else {
      // 有动画：连抽时逐次滚动，每次停在对应结果上
      for (const record of records) {
        await runAnimation(record.prizeId)
      }
    }

    // 新结果插到最前面，方便立即看到
    results.value = [...records.reverse(), ...results.value].slice(0, 100)
    await loadPrizes()
  } catch (e) {
    drawError.value = e.message || '抽奖失败'
  } finally {
    drawing.value = false
    stopTimer()
  }
}

function fmtTime(value) {
  if (!value) return ''
  const d = new Date(value)
  const pad = (x) => String(x).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

onMounted(loadPrizes)
</script>

<template>
  <div class="page">
    <AppHeader />
    <main class="page__main">
      <section class="qy-rise">
        <h1 class="rf-title">
          抽奖
        </h1>
        <p class="rf-sub">
          当前奖池共 {{ availablePrizes.length }} 种礼品 · 仅管理员与开发管理员可用
        </p>
        <p
          v-if="error"
          class="rf-error"
        >
          {{ error }}
        </p>

        <!-- 抽奖设置 -->
        <div class="rf-panel">
          <div class="rf-row">
            <label class="rf-field">
              <span class="rf-label">连抽次数</span>
              <input
                v-model="count"
                type="number"
                min="1"
                max="100"
                step="1"
                class="rf-input rf-input--narrow"
              >
            </label>
            <label class="rf-check">
              <input
                v-model="skipAnimation"
                type="checkbox"
              >
              <span>跳过动画（快速连抽）</span>
            </label>
          </div>
          <div class="rf-row rf-row--fan">
            <span class="rf-label">中奖粉丝</span>
            <template v-if="selectedFan">
              <span class="rf-fan">{{ selectedFan.nickname }}</span>
              <BaseButton
                type="text"
                @click="clearFan"
              >
                清除
              </BaseButton>
            </template>
            <BaseButton
              v-else
              type="default"
              @click="openFanPicker"
            >
              选择粉丝（可选）
            </BaseButton>
          </div>
          <div class="rf-actions">
            <BaseButton
              type="primary"
              :disabled="drawing || !availablePrizes.length"
              @click="doDraw"
            >
              {{ drawing ? '抽奖中…' : skipAnimation ? `立即抽 ${Number(count) || 1} 次` : '开始抽奖' }}
            </BaseButton>
          </div>
          <p
            v-if="drawError"
            class="rf-error"
          >
            {{ drawError }}
          </p>
        </div>

        <!-- 奖池展示 -->
        <p
          v-if="loading"
          class="rf-empty"
        >
          正在加载…
        </p>
        <p
          v-else-if="!availablePrizes.length"
          class="rf-empty"
        >
          奖池为空：请先到「抽奖管理」添加礼品，或把已停用的礼品重新启用。
        </p>
        <ul
          v-else
          class="rf-pool"
        >
          <li
            v-for="prize in availablePrizes"
            :key="prize.id"
            class="rf-prize"
            :class="{ 'is-highlight': highlightId === prize.id }"
          >
            <div class="rf-prize__image">
              <img
                v-if="prize.imageFileId && imageUrls.get(prize.imageFileId)"
                :src="imageUrls.get(prize.imageFileId)"
                :alt="prize.name"
              >
              <span v-else>🎁</span>
            </div>
            <p class="rf-prize__name">
              {{ prize.name }}
            </p>
            <p class="rf-prize__meta">
              {{ probabilityText(prize) }} · 剩 {{ stockText(prize) }}
            </p>
          </li>
        </ul>

        <!-- 抽奖结果 -->
        <div
          v-if="results.length"
          class="rf-results"
        >
          <h2 class="rf-results__title">
            抽奖结果
          </h2>
          <ul class="rf-results__list">
            <li
              v-for="(record, i) in results"
              :key="record.id"
              class="rf-result"
            >
              <span class="rf-result__idx">{{ results.length - i }}</span>
              <span class="rf-result__prize">{{ record.prizeName }}</span>
              <span class="rf-result__fan">{{ record.fanNickname || '未指定粉丝' }}</span>
              <span class="rf-result__time">{{ fmtTime(record.createdAt) }}</span>
            </li>
          </ul>
        </div>
      </section>

      <!-- 粉丝选择弹窗 -->
      <BaseModal
        v-if="showFanPicker"
        title="选择中奖粉丝"
        @close="showFanPicker = false"
      >
        <div class="rf-picker">
          <div class="rf-picker__search">
            <input
              v-model="fanKeyword"
              class="rf-input"
              placeholder="搜索昵称 / 抖音号 / 系统内账号"
              @keyup.enter="searchFans"
            >
            <BaseButton
              type="default"
              @click="searchFans"
            >
              搜索
            </BaseButton>
          </div>
          <p
            v-if="fanLoading"
            class="rf-empty"
          >
            正在加载…
          </p>
          <p
            v-else-if="!fanOptions.length"
            class="rf-empty"
          >
            没有找到粉丝，去「福利管理」新增一位吧。
          </p>
          <ul
            v-else
            class="rf-picker__list"
          >
            <li
              v-for="fan in fanOptions"
              :key="fan.id"
            >
              <button
                type="button"
                class="rf-picker__item"
                @click="pickFan(fan)"
              >
                {{ fan.nickname }}
              </button>
            </li>
          </ul>
        </div>
      </BaseModal>
    </main>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  background: var(--bg);
  display: flex;
  flex-direction: column;
}
.page__main {
  flex: 1;
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
  padding: 28px 20px 48px;
  box-sizing: border-box;
}
.rf-title {
  margin: 0 0 6px;
  font-family: var(--font-display);
  font-size: 30px;
  color: var(--text);
}
.rf-sub {
  margin: 0 0 16px;
  color: var(--muted);
  font-size: 14px;
}
.rf-error {
  margin: 0 0 10px;
  color: #d9534f;
  font-size: 14px;
}
.rf-panel {
  padding: 32px 36px;
  background: var(--surface);
  border-radius: calc(var(--radius) + 6px);
  box-shadow: var(--shadow);
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-bottom: 24px;
}
.rf-row {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}
.rf-row--fan {
  gap: 10px;
}
.rf-field {
  display: flex;
  align-items: center;
  gap: 8px;
}
.rf-label {
  font-size: 13px;
  color: var(--muted);
  flex-shrink: 0;
}
.rf-input {
  padding: 6px 10px;
  border: 1px solid var(--primary-soft);
  border-radius: 8px;
  font-size: 14px;
  color: var(--text);
  background: #fff;
}
.rf-input--narrow {
  width: 90px;
}
.rf-check {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: var(--text);
  cursor: pointer;
}
.rf-fan {
  font-size: 14px;
  color: var(--text);
  padding: 4px 12px;
  border-radius: 999px;
  background: var(--primary-soft);
}
.rf-actions {
  display: flex;
  justify-content: center;
}
.rf-empty {
  padding: 28px 0;
  text-align: center;
  color: var(--muted);
  font-size: 14px;
}
.rf-pool {
  margin: 0 0 20px;
  padding: 0;
  list-style: none;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
}
.rf-prize {
  padding: 18px 12px;
  background: var(--surface);
  border: 2px solid transparent;
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  text-align: center;
  transition: border-color 0.15s ease, transform 0.15s ease;
}
.rf-prize.is-highlight {
  border-color: var(--primary);
  transform: scale(1.04);
  box-shadow: 0 4px 16px rgba(201, 116, 59, 0.25);
}
.rf-prize__image {
  width: 64px;
  height: 64px;
  margin: 0 auto 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  border-radius: 12px;
  background: var(--primary-soft);
  overflow: hidden;
}
.rf-prize__image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.rf-prize__name {
  margin: 0;
  font-size: 14px;
  color: var(--text);
}
.rf-prize__meta {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--muted);
}
.rf-results__title {
  font-family: var(--font-display);
  font-size: 20px;
  color: var(--text);
  margin: 0 0 12px;
}
.rf-results__list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 320px;
  overflow-y: auto;
}
.rf-result {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  font-size: 13px;
}
.rf-result__idx {
  width: 32px;
  text-align: right;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
.rf-result__prize {
  flex: 1;
  min-width: 0;
  color: var(--text);
}
.rf-result__fan {
  color: var(--muted);
}
.rf-result__time {
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
.rf-picker__search {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}
.rf-picker__search .rf-input {
  flex: 1;
}
.rf-picker__list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 50vh;
  overflow-y: auto;
}
.rf-picker__item {
  width: 100%;
  text-align: left;
  padding: 10px 14px;
  border: 1px solid var(--primary-soft);
  border-radius: var(--radius);
  background: var(--surface);
  font-size: 14px;
  color: var(--text);
  cursor: pointer;
}
.rf-picker__item:hover {
  border-color: var(--primary);
}
</style>
