<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import {
  listPrizes,
  createPrize,
  updatePrize,
  deletePrize,
  listRaffleRecords,
} from '../api/raffles.js'
import { fetchFileObjectURL } from '../api/files.js'
import { PRIZE_FALLBACK_EMOJI } from '@cabin/raffle.js'
import AppHeader from '../components/base/AppHeader.vue'
import BaseButton from '../components/base/BaseButton.vue'
import BaseInput from '../components/base/BaseInput.vue'
import BaseModal from '../components/base/BaseModal.vue'
import BaseUpload from '../components/base/BaseUpload.vue'
import { confirm } from '../composables/useConfirm.js'

// ---------- 礼品列表 ----------
const prizes = ref([])
const loading = ref(false)
const error = ref('')
// 展示尺寸档位：small / medium / large
const POOL_SIZES = ['small', 'medium', 'large']
const POOL_SIZE_LABELS = { small: '小', medium: '中', large: '大' }
const poolSize = ref('small')
// 奖池搜索关键字
const prizeKeyword = ref('')

const filteredPrizes = computed(() => {
  const kw = prizeKeyword.value.trim().toLowerCase()
  if (!kw) return prizes.value
  return prizes.value.filter((p) => (p.name || '').toLowerCase().includes(kw))
})

// ---------- 新增 / 编辑礼品 ----------
// editor: { id?, name, imageFileId, weight, stock }
const editor = ref(null)
const saving = ref(false)
const saveError = ref('')

// ---------- 删除确认 ----------
const deleting = ref(false)

// ---------- 抽奖记录 ----------
const showRecords = ref(false)
const records = ref([])
const recordsTotal = ref(0)
const recordsPage = ref(1)
const recordsLoading = ref(false)
const recordsError = ref('')
const RECORDS_PAGE_SIZE = 20

// ---------- 图片 ObjectURL 缓存（组件销毁时统一 revoke） ----------
const imageUrls = ref(new Map())
const revoked = []

async function ensureImageUrl(fileId) {
  if (!fileId || imageUrls.value.has(fileId)) return
  const url = await fetchFileObjectURL(fileId)
  revoked.push(url)
  const next = new Map(imageUrls.value)
  next.set(fileId, url)
  imageUrls.value = next
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

// 当前可用奖池的总权重，用于实时显示中奖率
const totalAvailableWeight = computed(() =>
  prizes.value
    .filter((p) => p.enabled && p.weight > 0 && (p.stock === -1 || p.stock > 0))
    .reduce((sum, p) => sum + p.weight, 0),
)

function probabilityText(p) {
  if (!p.enabled) return '停用'
  if (p.weight <= 0) return '0%'
  if (p.stock === 0) return '0%'
  if (!totalAvailableWeight.value) return '0%'
  return `${((p.weight / totalAvailableWeight.value) * 100).toFixed(1)}%`
}

function stockText(p) {
  return p.stock === -1 ? '∞' : String(p.stock)
}

function openCreate() {
  saveError.value = ''
  editor.value = { name: '', imageFileId: null, weight: 1, stock: -1, isSystem: false }
}

function openEdit(prize) {
  saveError.value = ''
  editor.value = {
    id: prize.id,
    name: prize.name,
    imageFileId: prize.imageFileId,
    weight: prize.weight,
    stock: prize.stock,
    enabled: prize.enabled,
    isSystem: prize.benefitTypeId != null,
  }
}

async function savePrize() {
  if (!editor.value || saving.value) return
  const e = editor.value
  // 系统自带礼品的名称由福利类型维护，不在此处校验/提交
  if (!e.isSystem && !e.name.trim()) {
    saveError.value = '礼品名称不能为空'
    return
  }
  const weight = Number(e.weight)
  if (!Number.isInteger(weight) || weight < 0) {
    saveError.value = '中奖权重必须为不小于 0 的整数'
    return
  }
  const stock = Number(e.stock)
  if (!Number.isInteger(stock) || stock < -1) {
    saveError.value = '剩余数量必须为 -1（无限制）或 0 以上的整数'
    return
  }
  saving.value = true
  saveError.value = ''
  try {
    // 系统自带礼品：名称由福利类型维护，只提交其余字段
    const payload = e.isSystem
      ? { imageFileId: e.imageFileId, weight, stock }
      : { name: e.name.trim(), imageFileId: e.imageFileId, weight, stock }
    if (e.id) await updatePrize(e.id, payload)
    else await createPrize(payload)
    editor.value = null
    await loadPrizes()
  } catch (err) {
    saveError.value = err.message || '保存失败'
  } finally {
    saving.value = false
  }
}

async function toggleEnabled(prize) {
  error.value = ''
  try {
    await updatePrize(prize.id, { enabled: !prize.enabled })
    await loadPrizes()
  } catch (e) {
    error.value = e.message || '操作失败'
  }
}

async function removePrize(prize) {
  const ok = await confirm({
    title: '删除礼品',
    message: `确定删除「${prize.name}」吗？已产生的抽奖记录会保留，但该礼品不再出现在奖池里。`,
  })
  if (!ok) return
  deleting.value = true
  error.value = ''
  try {
    await deletePrize(prize.id)
    await loadPrizes()
  } catch (e) {
    error.value = e.message || '删除失败'
  } finally {
    deleting.value = false
  }
}

// ---------- 抽奖记录 ----------
async function loadRecords(page = 1) {
  recordsLoading.value = true
  recordsError.value = ''
  try {
    const data = await listRaffleRecords({ page, pageSize: RECORDS_PAGE_SIZE })
    records.value = data.list || []
    recordsTotal.value = data.total || 0
    recordsPage.value = data.page || 1
  } catch (e) {
    recordsError.value = e.message || '加载失败'
  } finally {
    recordsLoading.value = false
  }
}

function openRecords() {
  showRecords.value = true
  records.value = []
  loadRecords(1)
}

function fmtTime(value) {
  if (!value) return ''
  const d = new Date(value)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const recordsTotalPages = computed(() => Math.ceil(recordsTotal.value / RECORDS_PAGE_SIZE))

onMounted(loadPrizes)
</script>

<template>
  <div class="page">
    <AppHeader />
    <main class="page__main">
      <section class="qy-rise">
        <h1 class="rp-title">
          抽奖管理
        </h1>
        <p class="rp-sub">
          维护奖池里的礼品、权重与库存 · 仅管理员与开发管理员可见
        </p>
        <p
          v-if="error"
          class="rp-error"
        >
          {{ error }}
        </p>

        <div class="rp-toolbar">
          <p class="rp-tip">
            中奖率 = 该礼品权重 ÷ 所有「可用」礼品权重之和；权重为 0、库存为 0 或停用的礼品不会被抽中。<br>
            福利类型默认带入奖池，只能启停，抽到后自动给抽奖粉丝计入对应类型的卡。
          </p>
          <div class="rp-actions">
            <BaseButton
              type="default"
              @click="openRecords"
            >
              抽奖记录
            </BaseButton>
            <BaseButton
              type="primary"
              @click="openCreate"
            >
              新增礼品
            </BaseButton>
          </div>
        </div>

        <!-- 礼品格子（展示全部，可切换格子大小） -->
        <div class="rp-pool-head">
          <input
            v-model="prizeKeyword"
            class="rp-search"
            placeholder="搜索礼品名称…"
          >
          <div
            v-if="!loading && prizes.length"
            class="rp-size-switch"
          >
            <button
              v-for="size in POOL_SIZES"
              :key="size"
              type="button"
              class="rp-size-switch__btn"
              :class="{ 'is-active': poolSize === size }"
              @click="poolSize = size"
            >
              {{ POOL_SIZE_LABELS[size] }}
            </button>
          </div>
        </div>
        <p
          v-if="loading"
          class="rp-empty"
        >
          正在加载…
        </p>
        <p
          v-else-if="!prizes.length"
          class="rp-empty"
        >
          还没有礼品，点上面「新增礼品」创建第一个吧。福利类型默认带入奖池，由系统自动生成，可在此启停。
        </p>

        <ul
          v-else
          class="rp-list"
          :class="`is-${poolSize}`"
        >
          <li
            v-for="prize in filteredPrizes"
            :key="prize.id"
            class="rp-item"
            :class="{ 'is-disabled': !prize.enabled }"
          >
            <span
              v-if="prize.enabled"
              class="rp-item__chance"
            >{{ probabilityText(prize) }}</span>
            <span class="rp-item__stock">剩 {{ stockText(prize) }}</span>
            <div class="rp-item__image">
              <img
                v-if="prize.imageFileId && imageUrls.get(prize.imageFileId)"
                :src="imageUrls.get(prize.imageFileId)"
                :alt="prize.name"
              >
              <span v-else>{{ PRIZE_FALLBACK_EMOJI }}</span>
            </div>
            <p class="rp-item__name">
              {{ prize.name }}
              <span
                v-if="!prize.enabled"
                class="rp-badge rp-badge--off"
              >已停用</span>
              <span
                v-else-if="prize.stock === 0"
                class="rp-badge rp-badge--empty"
              >已抽完</span>
            </p>
            <p class="rp-item__meta">
              权重 {{ prize.weight }}
            </p>
            <div class="rp-item__ops">
              <button
                type="button"
                class="rp-icon-btn"
                :title="prize.enabled ? '停用' : '启用'"
                @click="toggleEnabled(prize)"
              >
                {{ prize.enabled ? '⏸' : '▶' }}
              </button>
              <button
                type="button"
                class="rp-icon-btn"
                title="编辑"
                @click="openEdit(prize)"
              >
                ✏️
              </button>
              <button
                v-if="prize.benefitTypeId == null"
                type="button"
                class="rp-icon-btn"
                title="删除"
                :disabled="deleting"
                @click="removePrize(prize)"
              >
                🗑️
              </button>
            </div>
          </li>
        </ul>
      </section>

      <!-- 新增 / 编辑礼品 -->
      <BaseModal
        v-if="editor"
        :title="editor?.id ? '编辑礼品' : '新增礼品'"
        @close="editor = null"
      >
        <div
          v-if="editor"
          class="rp-form"
        >
          <label class="rp-field">
            <span class="rp-label">礼品名称</span>
            <BaseInput
              v-model="editor.name"
              maxlength="30"
              placeholder="如：奶茶一杯"
              :disabled="editor.isSystem"
            />
            <span
              v-if="editor.isSystem"
              class="rp-hint"
            >（系统自带，名称不可修改）</span>
          </label>
          <label class="rp-field">
            <span class="rp-label">图片（非必填）</span>
            <BaseUpload
              v-model="editor.imageFileId"
              category="raffle-prize"
              accept="image/*"
            />
          </label>
          <label class="rp-field">
            <span class="rp-label">中奖权重（整数，越大越容易中）</span>
            <BaseInput
              v-model="editor.weight"
              type="number"
              min="0"
              step="1"
              placeholder="1"
            />
          </label>
          <label class="rp-field">
            <span class="rp-label">剩余数量（-1 表示无限制）</span>
            <BaseInput
              v-model="editor.stock"
              type="number"
              min="-1"
              step="1"
              placeholder="-1"
            />
          </label>
          <p
            v-if="editor.id"
            class="rp-hint"
          >
            当前实时中奖率：{{ probabilityText(prizes.find((p) => p.id === editor.id) || { ...editor, enabled: true }) }}
          </p>
          <p
            v-if="editor.isSystem"
            class="rp-hint"
          >
            系统自带礼品的名称由福利类型维护；改名请在「福利管理」里操作，此处可修改图片、权重、库存。
          </p>
          <p
            v-if="saveError"
            class="rp-error"
          >
            {{ saveError }}
          </p>
        </div>
        <template #footer>
          <BaseButton
            type="default"
            @click="editor = null"
          >
            取消
          </BaseButton>
          <BaseButton
            type="primary"
            :disabled="saving"
            @click="savePrize"
          >
            {{ saving ? '保存中…' : '保存' }}
          </BaseButton>
        </template>
      </BaseModal>

      <!-- 抽奖记录 -->
      <BaseModal
        v-if="showRecords"
        title="抽奖记录"
        @close="showRecords = false"
      >
        <p
          v-if="recordsError"
          class="rp-error"
        >
          {{ recordsError }}
        </p>
        <p
          v-else-if="recordsLoading"
          class="rp-empty"
        >
          正在加载…
        </p>
        <p
          v-else-if="!records.length"
          class="rp-empty"
        >
          还没有抽奖记录。
        </p>
        <template v-else>
          <ul class="rp-records">
            <li
              v-for="record in records"
              :key="record.id"
              class="rp-record"
            >
              <span class="rp-record__prize">{{ record.prizeName }}</span>
              <span class="rp-record__fan">{{ record.fanNickname || '未指定粉丝' }}</span>
              <span class="rp-record__time">{{ fmtTime(record.createdAt) }}</span>
            </li>
          </ul>
          <div
            v-if="recordsTotalPages > 1"
            class="rp-pager"
          >
            <BaseButton
              type="text"
              :disabled="recordsPage <= 1"
              @click="loadRecords(recordsPage - 1)"
            >
              上一页
            </BaseButton>
            <span class="rp-pager__info">{{ recordsPage }} / {{ recordsTotalPages }}</span>
            <BaseButton
              type="text"
              :disabled="recordsPage >= recordsTotalPages"
              @click="loadRecords(recordsPage + 1)"
            >
              下一页
            </BaseButton>
          </div>
        </template>
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
.rp-title {
  margin: 0 0 6px;
  font-family: var(--font-display);
  font-size: 30px;
  color: var(--text);
}
.rp-sub {
  margin: 0 0 16px;
  color: var(--muted);
  font-size: 14px;
}
.rp-error {
  margin: 0 0 10px;
  color: #d9534f;
  font-size: 14px;
}
.rp-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.rp-tip {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
  flex: 1;
  min-width: 220px;
}
.rp-actions {
  display: flex;
  gap: 8px;
}
.rp-empty {
  padding: 32px 0;
  text-align: center;
  color: var(--muted);
  font-size: 14px;
}
/* 尺寸切换：独占一行、右对齐，避免压住第一排格子 */
.rp-pool-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: -4px 0 10px;
  min-height: 30px;
}
.rp-search {
  flex: 1;
  min-width: 0;
  max-width: 220px;
  padding: 5px 12px;
  border: 1px solid var(--primary-soft);
  border-radius: 999px;
  font-size: 13px;
  color: var(--text);
  background: var(--surface);
  outline: none;
  transition: border-color 0.15s ease;
}
.rp-search:focus {
  border-color: var(--primary);
}
.rp-pool-head .rp-size-switch {
  margin-left: auto;
  flex-shrink: 0;
}
.rp-size-switch {
  display: inline-flex;
  border: 1px solid var(--primary-soft);
  border-radius: 999px;
  overflow: hidden;
  background: var(--surface);
}
.rp-size-switch__btn {
  padding: 4px 14px;
  border: none;
  background: transparent;
  font-size: 13px;
  color: var(--muted);
  cursor: pointer;
}
.rp-size-switch__btn + .rp-size-switch__btn {
  border-left: 1px solid var(--primary-soft);
}
.rp-size-switch__btn.is-active {
  background: var(--primary-soft);
  color: var(--primary);
  font-weight: 600;
}
.rp-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 14px;
}
/* 格子尺寸档位：小 / 中 / 大，网格列数与卡片内距联动调整 */
.rp-list.is-small {
  grid-template-columns: repeat(auto-fill, minmax(128px, 1fr));
  gap: 8px;
}
.rp-list.is-small .rp-item {
  padding: 10px 8px 6px;
  gap: 4px;
}
.rp-list.is-small .rp-item__image {
  width: 40px;
  height: 40px;
  font-size: 20px;
}
.rp-list.is-small .rp-item__chance {
  top: 8px;
  left: -22px;
  font-size: 9px;
  padding: 1px 24px;
}
.rp-list.is-small .rp-item__stock {
  top: 5px;
  right: 5px;
  font-size: 10px;
  padding: 1px 6px;
}
.rp-list.is-small .rp-item__name {
  font-size: 12px;
}
.rp-list.is-small .rp-item__meta {
  font-size: 10px;
}
.rp-list.is-small .rp-icon-btn {
  width: 26px;
  height: 26px;
  font-size: 12px;
}
.rp-list.is-large {
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}
.rp-list.is-large .rp-item {
  padding: 20px 16px 12px;
  gap: 10px;
}
.rp-list.is-large .rp-item__image {
  width: 80px;
  height: 80px;
  font-size: 38px;
}
.rp-list.is-large .rp-item__chance {
  font-size: 11px;
  padding: 2px 7px;
}
.rp-list.is-large .rp-item__name {
  font-size: 16px;
}
.rp-list.is-large .rp-item__meta {
  font-size: 13px;
}
.rp-list.is-large .rp-icon-btn {
  width: 36px;
  height: 36px;
  font-size: 17px;
}
/* 纵向卡片：图上、名称独立行、meta 提示、icon 按钮底部一行（V5 圆角渐变） */
.rp-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  padding: 16px 14px 10px;
  background: linear-gradient(145deg, #fffdf8 0%, #fdf6e8 100%);
  border: 1px solid rgba(201, 116, 59, 0.15);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  text-align: center;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  position: relative;
  overflow: hidden;
}
.rp-item:hover {
  transform: translateY(-3px) scale(1.01);
  box-shadow: 0 12px 32px rgba(201, 116, 59, 0.18);
}
.rp-item.is-disabled {
  opacity: 0.55;
}
/* 卡片左上角缎带式概率角标 */
.rp-item__chance {
  position: absolute;
  top: 12px;
  left: -30px;
  transform: rotate(-45deg);
  font-size: 10px;
  padding: 2px 32px;
  background: var(--primary);
  color: #fff;
  font-weight: 600;
  line-height: 1.4;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  box-shadow: 0 2px 6px rgba(201, 116, 59, 0.3);
}
.rp-item__image {
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--primary-soft), #f5e6c8);
  overflow: hidden;
  flex-shrink: 0;
}
.rp-item__image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.rp-item__name {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  flex-wrap: wrap;
}
.rp-item__meta {
  margin: 0;
  font-size: 12px;
  color: var(--muted);
}
/* 卡片右上角剩余数量 tag */
.rp-item__stock {
  position: absolute;
  top: 6px;
  right: 6px;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--primary-soft);
  color: var(--primary);
  font-weight: 500;
  line-height: 1.4;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.rp-badge {
  font-size: 11px;
  padding: 1px 8px;
  border-radius: 999px;
  font-weight: 500;
}
.rp-badge--off {
  background: rgba(0, 0, 0, 0.08);
  color: var(--muted);
}
.rp-badge--empty {
  background: rgba(217, 83, 79, 0.12);
  color: #d9534f;
}
.rp-item__ops {
  display: flex;
  justify-content: center;
  gap: 2px;
  border-top: 1px solid rgba(201, 116, 59, 0.12);
  padding-top: 8px;
  margin-top: 2px;
  width: 100%;
}
.rp-icon-btn {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
  font-size: 15px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease;
}
.rp-icon-btn:hover {
  background: var(--primary-soft);
}
.rp-icon-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.rp-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.rp-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.rp-label {
  font-size: 13px;
  color: var(--muted);
}
.rp-hint {
  margin: 0;
  font-size: 13px;
  color: var(--muted);
}
.rp-records {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 50vh;
  overflow-y: auto;
}
.rp-record {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: var(--bg);
  border-radius: var(--radius);
  font-size: 13px;
}
.rp-record__prize {
  flex: 1;
  min-width: 0;
  color: var(--text);
}
.rp-record__fan {
  color: var(--muted);
}
.rp-record__time {
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
.rp-pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 12px;
}
.rp-pager__info {
  color: var(--muted);
  font-size: 13px;
}
</style>
