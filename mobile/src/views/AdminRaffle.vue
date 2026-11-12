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

// ---------- 新增 / 编辑礼品 ----------
// editor: { id?, name, imageFileId, weight, stock }
const editor = ref(null)
const saving = ref(false)
const saveError = ref('')

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
  try {
    const url = await fetchFileObjectURL(fileId)
    revoked.push(url)
    const next = new Map(imageUrls.value)
    next.set(fileId, url)
    imageUrls.value = next
  } catch {
    // 图片拉取失败不阻塞列表
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
  return p.stock === -1 ? '无限制' : String(p.stock)
}

function openCreate() {
  saveError.value = ''
  editor.value = { name: '', imageFileId: null, weight: 1, stock: -1 }
}

function openEdit(prize) {
  saveError.value = ''
  editor.value = {
    id: prize.id,
    name: prize.name,
    imageFileId: prize.imageFileId,
    weight: prize.weight,
    stock: prize.stock,
  }
}

async function savePrize() {
  if (!editor.value || saving.value) return
  const e = editor.value
  if (!e.name.trim()) {
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
    const payload = { name: e.name.trim(), imageFileId: e.imageFileId, weight, stock }
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
  error.value = ''
  try {
    await deletePrize(prize.id)
    await loadPrizes()
  } catch (e) {
    error.value = e.message || '删除失败'
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
        <h1 class="ra-title">
          抽奖管理
        </h1>
        <p class="ra-sub">
          维护奖池里的礼品、权重与库存
        </p>
        <p
          v-if="error"
          class="ra-error"
        >
          {{ error }}
        </p>

        <div class="ra-toolbar">
          <p class="ra-tip">
            中奖率 = 该礼品权重 ÷ 所有「可用」礼品权重之和；权重为 0、库存为 0 或停用的礼品不会被抽中。
          </p>
        </div>
        <div class="ra-actions">
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

        <p
          v-if="loading"
          class="ra-empty"
        >
          正在加载…
        </p>
        <p
          v-else-if="!prizes.length"
          class="ra-empty"
        >
          还没有礼品，点上面「新增礼品」创建第一个吧。
        </p>

        <ul
          v-else
          class="ra-list"
        >
          <li
            v-for="prize in prizes"
            :key="prize.id"
            class="ra-item"
            :class="{ 'is-disabled': !prize.enabled }"
          >
            <div class="ra-item__image">
              <img
                v-if="prize.imageFileId && imageUrls.get(prize.imageFileId)"
                :src="imageUrls.get(prize.imageFileId)"
                :alt="prize.name"
              >
              <span v-else>🎁</span>
            </div>
            <div class="ra-item__info">
              <p class="ra-item__name">
                {{ prize.name }}
                <span
                  v-if="!prize.enabled"
                  class="ra-badge ra-badge--off"
                >已停用</span>
                <span
                  v-else-if="prize.stock === 0"
                  class="ra-badge ra-badge--empty"
                >已抽完</span>
              </p>
              <p class="ra-item__meta">
                权重 {{ prize.weight }} · 中奖率 {{ probabilityText(prize) }} · 剩余 {{ stockText(prize) }}
              </p>
            </div>
            <div class="ra-item__ops">
              <BaseButton
                type="text"
                @click="toggleEnabled(prize)"
              >
                {{ prize.enabled ? '停用' : '启用' }}
              </BaseButton>
              <BaseButton
                type="text"
                @click="openEdit(prize)"
              >
                编辑
              </BaseButton>
              <BaseButton
                type="text"
                @click="removePrize(prize)"
              >
                删除
              </BaseButton>
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
          class="ra-form"
        >
          <label class="ra-field">
            <span class="ra-label">礼品名称</span>
            <BaseInput
              v-model="editor.name"
              maxlength="30"
              placeholder="如：奶茶一杯"
            />
          </label>
          <label class="ra-field">
            <span class="ra-label">图片（非必填）</span>
            <BaseUpload
              v-model="editor.imageFileId"
              category="raffle-prize"
              accept="image/*"
            />
          </label>
          <label class="ra-field">
            <span class="ra-label">中奖权重（整数，越大越容易中）</span>
            <BaseInput
              v-model="editor.weight"
              type="number"
              min="0"
              step="1"
              placeholder="1"
            />
          </label>
          <label class="ra-field">
            <span class="ra-label">剩余数量（-1 表示无限制）</span>
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
            class="ra-error"
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
          class="ra-error"
        >
          {{ recordsError }}
        </p>
        <p
          v-else-if="recordsLoading"
          class="ra-empty"
        >
          正在加载…
        </p>
        <p
          v-else-if="!records.length"
          class="ra-empty"
        >
          还没有抽奖记录。
        </p>
        <template v-else>
          <ul class="ra-records">
            <li
              v-for="record in records"
              :key="record.id"
              class="ra-record"
            >
              <span class="ra-record__prize">{{ record.prizeName }}</span>
              <span class="ra-record__fan">{{ record.fanNickname || '未指定粉丝' }}</span>
              <span class="ra-record__time">{{ fmtTime(record.createdAt) }}</span>
            </li>
          </ul>
          <div
            v-if="recordsTotalPages > 1"
            class="ra-pager"
          >
            <BaseButton
              type="text"
              :disabled="recordsPage <= 1"
              @click="loadRecords(recordsPage - 1)"
            >
              上一页
            </BaseButton>
            <span class="ra-pager__info">{{ recordsPage }} / {{ recordsTotalPages }}</span>
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
.ra-title {
  font-family: var(--font-display);
  font-size: 24px;
  color: var(--text);
  margin: 0 0 4px;
}
.ra-sub {
  margin: 0 0 10px;
  color: var(--muted);
  font-size: 13px;
}
.ra-error {
  margin: 0 0 10px;
  color: #d9534f;
  font-size: 14px;
}
.ra-toolbar {
  margin-bottom: 8px;
}
.ra-tip {
  margin: 0;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.6;
}
.ra-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 14px;
}
.ra-empty {
  padding: 32px 0;
  text-align: center;
  color: var(--muted);
  font-size: 14px;
}
.ra-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.ra-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--primary-soft);
  border-radius: var(--radius);
  background: var(--surface);
}
.ra-item.is-disabled {
  opacity: 0.6;
}
.ra-item__image {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  border-radius: 8px;
  background: var(--primary-soft);
  overflow: hidden;
  flex-shrink: 0;
}
.ra-item__image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.ra-item__info {
  flex: 1;
  min-width: 0;
}
.ra-item__name {
  margin: 0;
  font-size: 15px;
  color: var(--text);
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.ra-item__meta {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--muted);
}
.ra-badge {
  font-size: 11px;
  padding: 1px 8px;
  border-radius: 999px;
}
.ra-badge--off {
  background: rgba(0, 0, 0, 0.08);
  color: var(--muted);
}
.ra-badge--empty {
  background: rgba(217, 83, 79, 0.12);
  color: #d9534f;
}
.ra-item__ops {
  display: flex;
  gap: 0;
  flex-shrink: 0;
}
.ra-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.ra-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ra-label {
  font-size: 13px;
  color: var(--muted);
}
.ra-records {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 50vh;
  overflow-y: auto;
}
.ra-record {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid var(--primary-soft);
  border-radius: var(--radius);
  font-size: 13px;
}
.ra-record__prize {
  flex: 1;
  min-width: 0;
  color: var(--text);
}
.ra-record__fan {
  color: var(--muted);
  flex-shrink: 0;
}
.ra-record__time {
  color: var(--muted);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}
.ra-pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 12px;
}
.ra-pager__info {
  color: var(--muted);
  font-size: 13px;
}
</style>
