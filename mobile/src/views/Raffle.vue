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
        <h1 class="rl-title">
          抽奖
        </h1>
        <p class="rl-sub">
          当前奖池共 {{ availablePrizes.length }} 种礼品
        </p>
        <p
          v-if="error"
          class="rl-error"
        >
          {{ error }}
        </p>

        <!-- 抽奖设置 -->
        <div class="rl-panel">
          <div class="rl-row">
            <label class="rl-field">
              <span class="rl-label">连抽次数</span>
              <input
                v-model="count"
                type="number"
                min="1"
                max="100"
                step="1"
                class="rl-input"
              >
            </label>
            <label class="rl-check">
              <input
                v-model="skipAnimation"
                type="checkbox"
              >
              <span>跳过动画（快速连抽）</span>
            </label>
          </div>
          <div class="rl-row">
            <span class="rl-label">中奖粉丝</span>
            <template v-if="selectedFan">
              <span class="rl-fan">{{ selectedFan.nickname }}</span>
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
          <div class="rl-actions">
            <BaseButton
              type="primary"
              size="lg"
              :disabled="drawing || !availablePrizes.length"
              @click="doDraw"
            >
              {{ drawing ? '抽奖中…' : skipAnimation ? `立即抽 ${Number(count) || 1} 次` : '开始抽奖' }}
            </BaseButton>
          </div>
          <p
            v-if="drawError"
            class="rl-error"
          >
            {{ drawError }}
          </p>
        </div>

        <!-- 奖池展示 -->
        <p
          v-if="loading"
          class="rl-empty"
        >
          正在加载…
        </p>
        <p
          v-else-if="!availablePrizes.length"
          class="rl-empty"
        >
          奖池为空：请先到「抽奖管理」添加礼品，或把已停用的礼品重新启用。
        </p>
        <ul
          v-else
          class="rl-pool"
        >
          <li
            v-for="prize in availablePrizes"
            :key="prize.id"
            class="rl-prize"
            :class="{ 'is-highlight': highlightId === prize.id }"
          >
            <div class="rl-prize__image">
              <img
                v-if="prize.imageFileId && imageUrls.get(prize.imageFileId)"
                :src="imageUrls.get(prize.imageFileId)"
                :alt="prize.name"
              >
              <span v-else>🎁</span>
            </div>
            <p class="rl-prize__name">
              {{ prize.name }}
            </p>
            <p class="rl-prize__meta">
              {{ probabilityText(prize) }} · 剩 {{ stockText(prize) }}
            </p>
          </li>
        </ul>

        <!-- 抽奖结果 -->
        <div
          v-if="results.length"
          class="rl-results"
        >
          <h2 class="rl-results__title">
            抽奖结果
          </h2>
          <ul class="rl-results__list">
            <li
              v-for="(record, i) in results"
              :key="record.id"
              class="rl-result"
            >
              <span class="rl-result__idx">{{ results.length - i }}</span>
              <span class="rl-result__prize">{{ record.prizeName }}</span>
              <span class="rl-result__fan">{{ record.fanNickname || '未指定粉丝' }}</span>
              <span class="rl-result__time">{{ fmtTime(record.createdAt) }}</span>
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
        <div class="rl-picker">
          <div class="rl-picker__search">
            <input
              v-model="fanKeyword"
              class="rl-input rl-input--flex"
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
            class="rl-empty"
          >
            正在加载…
          </p>
          <p
            v-else-if="!fanOptions.length"
            class="rl-empty"
          >
            没有找到粉丝，去「福利管理」新增一位吧。
          </p>
          <ul
            v-else
            class="rl-picker__list"
          >
            <li
              v-for="fan in fanOptions"
              :key="fan.id"
            >
              <button
                type="button"
                class="rl-picker__item"
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
.rl-title {
  font-family: var(--font-display);
  font-size: 24px;
  color: var(--text);
  margin: 0 0 4px;
}
.rl-sub {
  margin: 0 0 12px;
  color: var(--muted);
  font-size: 13px;
}
.rl-error {
  margin: 0 0 10px;
  color: #d9534f;
  font-size: 14px;
}
.rl-panel {
  padding: 14px;
  border: 1px solid var(--primary-soft);
  border-radius: var(--radius);
  background: var(--surface);
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}
.rl-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.rl-field {
  display: flex;
  align-items: center;
  gap: 8px;
}
.rl-label {
  font-size: 13px;
  color: var(--muted);
  flex-shrink: 0;
}
.rl-input {
  padding: 6px 10px;
  border: 1px solid var(--primary-soft);
  border-radius: 8px;
  font-size: 14px;
  color: var(--text);
  background: #fff;
  width: 90px;
}
.rl-input--flex {
  flex: 1;
  width: auto;
  min-width: 0;
}
.rl-check {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: var(--text);
  cursor: pointer;
}
.rl-fan {
  font-size: 14px;
  color: var(--text);
  padding: 4px 12px;
  border-radius: 999px;
  background: var(--primary-soft);
}
.rl-actions {
  display: flex;
  justify-content: center;
}
.rl-empty {
  padding: 28px 0;
  text-align: center;
  color: var(--muted);
  font-size: 14px;
}
.rl-pool {
  margin: 0 0 18px;
  padding: 0;
  list-style: none;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 10px;
}
.rl-prize {
  padding: 12px 8px;
  border: 2px solid var(--primary-soft);
  border-radius: var(--radius);
  background: var(--surface);
  text-align: center;
  transition: border-color 0.15s ease, transform 0.15s ease;
}
.rl-prize.is-highlight {
  border-color: var(--primary);
  transform: scale(1.04);
  box-shadow: 0 4px 16px rgba(201, 116, 59, 0.25);
}
.rl-prize__image {
  width: 48px;
  height: 48px;
  margin: 0 auto 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  border-radius: 10px;
  background: var(--primary-soft);
  overflow: hidden;
}
.rl-prize__image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.rl-prize__name {
  margin: 0;
  font-size: 13px;
  color: var(--text);
}
.rl-prize__meta {
  margin: 4px 0 0;
  font-size: 11px;
  color: var(--muted);
}
.rl-results__title {
  font-size: 15px;
  color: var(--text);
  margin: 0 0 8px;
}
.rl-results__list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 320px;
  overflow-y: auto;
}
.rl-result {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid var(--primary-soft);
  border-radius: var(--radius);
  font-size: 13px;
}
.rl-result__idx {
  width: 28px;
  text-align: right;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
.rl-result__prize {
  flex: 1;
  min-width: 0;
  color: var(--text);
}
.rl-result__fan {
  color: var(--muted);
  flex-shrink: 0;
}
.rl-result__time {
  color: var(--muted);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}
.rl-picker__search {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}
.rl-picker__list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 50vh;
  overflow-y: auto;
}
.rl-picker__item {
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
.rl-picker__item:active {
  border-color: var(--primary);
}
</style>
