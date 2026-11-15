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
const keyword = ref('')

const filteredPrizes = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return prizes.value
  return prizes.value.filter((p) => (p.name || '').toLowerCase().includes(kw))
})

// ---------- 新增 / 编辑礼品 ----------
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
    // 静默失败
  }
}

onBeforeUnmount(() => {
  revoked.forEach((u) => URL.revokeObjectURL(u))
})

async function loadPrizes() {
  loading.value = true
  error.value = ''
  // 记录列表滚动位置，操作后恢复
  const listEl = document.querySelector('.rp-list')
  const scrollTop = listEl ? listEl.scrollTop : 0
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
    // 等 DOM 更新后恢复列表滚动位置
    requestAnimationFrame(() => {
      const el = document.querySelector('.rp-list')
      if (el) el.scrollTop = scrollTop
    })
  }
}

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
    message: `确定删除「${prize.name}」吗？已产生的抽奖记录会保留。`,
  })
  if (!ok) return
  deleting.value = true
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
async function openRecords() {
  showRecords.value = true
  recordsPage.value = 1
  await loadRecords(1)
}

async function loadRecords(page) {
  recordsLoading.value = true
  recordsError.value = ''
  try {
    const data = await listRaffleRecords({ page, pageSize: RECORDS_PAGE_SIZE })
    records.value = data.list || []
    recordsTotal.value = data.total || 0
    recordsPage.value = page
  } catch (e) {
    recordsError.value = e.message || '加载失败'
  } finally {
    recordsLoading.value = false
  }
}

function fmtTime(value) {
  if (!value) return ''
  const d = new Date(value)
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
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
          维护奖池里的礼品、权重与库存
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
              size="sm"
              @click="openRecords"
            >
              抽奖记录
            </BaseButton>
            <BaseButton
              type="primary"
              size="sm"
              @click="openCreate"
            >
              新增礼品
            </BaseButton>
          </div>
        </div>

        <!-- 搜索 -->
        <div class="rp-pool-head">
          <input
            v-model="keyword"
            class="rp-search"
            placeholder="搜索礼品名称…"
          >
        </div>

        <!-- 加载/空态 -->
        <p
          v-if="loading"
          class="rp-empty"
        >
          正在加载…
        </p>
        <p
          v-else-if="!filteredPrizes.length"
          class="rp-empty"
        >
          {{ keyword ? '没有匹配的礼品' : '还没有礼品' }}
        </p>

        <!-- 礼品网格（和 PC 一样的卡片） -->
        <ul
          v-else
          class="rp-list"
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
        <div class="rp-form">
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
            >系统自带，名称在福利类型里改</span>
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
            <span class="rp-label">中奖权重</span>
            <BaseInput
              v-model="editor.weight"
              type="number"
              min="0"
              step="1"
              placeholder="1"
            />
          </label>
          <label class="rp-field">
            <span class="rp-label">剩余数量（-1 无限）</span>
            <BaseInput
              v-model="editor.stock"
              type="number"
              min="-1"
              step="1"
              placeholder="-1"
            />
          </label>
          <p
            v-if="saveError"
            class="rp-error"
          >
            {{ saveError }}
          </p>
        </div>
        <template #footer>
          <BaseButton
            type="text"
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
              <span class="rp-record__fan">{{ record.fanNickname || '未指定' }}</span>
              <span class="rp-record__time">{{ fmtTime(record.createdAt) }}</span>
            </li>
          </ul>
          <div
            v-if="recordsTotalPages > 1"
            class="rp-pager"
          >
            <BaseButton
              type="text"
              size="sm"
              :disabled="recordsPage <= 1"
              @click="loadRecords(recordsPage - 1)"
            >
              上一页
            </BaseButton>
            <span class="rp-pager__info">{{ recordsPage }} / {{ recordsTotalPages }}</span>
            <BaseButton
              type="text"
              size="sm"
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
.page__main {
  padding: 16px 16px 90px;
}

.rp-title {
  font-family: var(--font-display);
  font-size: 26px;
  color: var(--text);
  margin: 0 0 6px;
}

.rp-sub {
  margin: 0 0 12px;
  color: var(--muted);
  font-size: 13px;
}

.rp-error {
  margin: 0 0 12px;
  color: #d9534f;
  font-size: 14px;
}

.rp-toolbar {
  margin-bottom: 12px;
}

.rp-tip {
  margin: 0 0 10px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.6;
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

/* 搜索 */
.rp-pool-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: -4px 0 10px;
}

.rp-search {
  flex: 1;
  min-width: 0;
  padding: 8px 14px;
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

/* 礼品网格（和 PC 一样的卡片，定高滚动） */
.rp-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 10px;
  padding-right: 4px;
  max-height: calc(100vh - 280px);
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.rp-list::-webkit-scrollbar {
  width: 4px;
}

.rp-list::-webkit-scrollbar-thumb {
  background: var(--primary-soft);
  border-radius: 2px;
}

/* 卡片样式（和 PC 一致） */
.rp-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 14px 12px 8px;
  background: linear-gradient(145deg, #fffdf8 0%, #fdf6e8 100%);
  border: 1px solid rgba(201, 116, 59, 0.15);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  text-align: center;
  position: relative;
  overflow: hidden;
  transition: transform 0.15s ease;
  flex-shrink: 0;
}

.rp-item:active {
  transform: scale(.98);
}

.rp-item.is-disabled {
  opacity: 0.55;
}

/* 左上角缎带式概率角标 */
.rp-item__chance {
  position: absolute;
  top: 10px;
  left: -24px;
  transform: rotate(-45deg);
  font-size: 9px;
  padding: 1px 26px;
  background: var(--primary);
  color: #fff;
  font-weight: 600;
  line-height: 1.4;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  box-shadow: 0 2px 6px rgba(201, 116, 59, 0.3);
}

.rp-item__image {
  width: 52px;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26px;
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
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  flex-wrap: wrap;
}

.rp-item__meta {
  margin: 0;
  font-size: 11px;
  color: var(--muted);
}

/* 右上角库存标签 */
.rp-item__stock {
  position: absolute;
  top: 5px;
  right: 5px;
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
  font-size: 10px;
  padding: 1px 6px;
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

/* 底部操作按钮 */
.rp-item__ops {
  display: flex;
  justify-content: center;
  gap: 2px;
  border-top: 1px solid rgba(201, 116, 59, 0.12);
  padding-top: 6px;
  margin-top: 2px;
  width: 100%;
}

.rp-icon-btn {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease;
}

.rp-icon-btn:active {
  background: var(--primary-soft);
}

.rp-icon-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* 表单 */
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
  font-size: 12px;
  color: var(--muted);
}

/* 记录列表 */
.rp-records {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rp-record {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--surface);
  border-radius: 10px;
  box-shadow: 0 1px 4px rgba(120, 90, 50, .06);
  font-size: 13px;
}

.rp-record__prize {
  flex: 1;
  font-weight: 600;
  color: var(--text);
}

.rp-record__fan {
  color: var(--muted);
  font-size: 12px;
}

.rp-record__time {
  color: var(--muted);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

/* 分页 */
.rp-pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 14px;
}

.rp-pager__info {
  font-size: 13px;
  color: var(--muted);
}
</style>
