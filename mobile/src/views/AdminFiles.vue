<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { listFiles, deleteFile, fetchFileObjectURL } from '../api/files.js'
import AppHeader from '../components/base/AppHeader.vue'
import BaseCard from '../components/base/BaseCard.vue'
import BaseButton from '../components/base/BaseButton.vue'
import BaseModal from '../components/base/BaseModal.vue'
import BaseUpload from '../components/base/BaseUpload.vue'
import { confirm } from '../composables/useConfirm.js'

// ---------- 文件列表（分页） ----------
const files = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const loading = ref(false)
const error = ref('')
const category = ref('')

// ---------- 上传弹窗（底部弹层） ----------
const showUpload = ref(false)

// ---------- 删除 ----------
const deletingId = ref(0)

// ---------- 图片 ObjectURL 缓存（组件销毁时统一 revoke） ----------
const imageUrls = ref(new Map())
const revoked = []

const IMAGE_RE = /\.(png|jpe?g|gif|webp|bmp|svg)$/i

function isImage(file) {
  return IMAGE_RE.test(file.name || '') || String(file.mimeType || '').startsWith('image/')
}

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

async function load(p = 1) {
  loading.value = true
  error.value = ''
  try {
    const data = await listFiles({ page: p, pageSize, category: category.value.trim() })
    files.value = data.list || []
    total.value = data.total || 0
    page.value = data.page || 1
    for (const f of files.value) {
      if (isImage(f)) ensureImageUrl(f.id)
    }
  } catch (e) {
    error.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

const totalPages = computed(() => Math.ceil(total.value / pageSize))

function fmtSize(n) {
  if (n == null) return ''
  if (n < 1024) return `${n}B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`
  return `${(n / 1024 / 1024).toFixed(1)}MB`
}

function fmtTime(value) {
  if (!value) return ''
  const d = new Date(value)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function refText(file) {
  const parts = (file.refs || []).map((r) => `${r.label} × ${r.count}`)
  return parts.join('、')
}

async function removeFile(file) {
  const used = (file.refs || []).length > 0
  const ok = await confirm({
    title: '删除文件',
    message: used
      ? `「${file.name}」正被引用（${refText(file)}）。删除后这些业务记录会失去该文件，仍要删除吗？`
      : `确定删除「${file.name}」吗？磁盘上的文件与记录会一并删除，且不可恢复。`,
    confirmText: '删除',
  })
  if (!ok) return
  deletingId.value = file.id
  error.value = ''
  try {
    await deleteFile(file.id)
    await load(files.value.length === 1 && page.value > 1 ? page.value - 1 : page.value)
  } catch (e) {
    error.value = e.message || '删除失败'
  } finally {
    deletingId.value = 0
  }
}

function onUploaded() {
  showUpload.value = false
  load(1)
}

onMounted(() => load(1))
</script>

<template>
  <div class="page">
    <AppHeader />
    <main class="page__main">
      <section class="qy-rise">
        <h1 class="af-title">
          文件管理
        </h1>
        <p class="af-sub">
          共 {{ total }} 个文件 · 仅开发管理员可见
        </p>
        <p
          v-if="error"
          class="af-error"
        >
          {{ error }}
        </p>

        <div class="af-toolbar">
          <input
            v-model="category"
            class="af-search"
            placeholder="按分类筛选，如 raffle-prize…"
            @keyup.enter="load(1)"
          >
          <BaseButton
            type="default"
            @click="load(1)"
          >
            查询
          </BaseButton>
          <BaseButton
            type="primary"
            @click="showUpload = true"
          >
            上传
          </BaseButton>
        </div>

        <p
          v-if="loading"
          class="af-empty"
        >
          正在加载…
        </p>
        <p
          v-else-if="!files.length"
          class="af-empty"
        >
          还没有文件。点上面「上传」把第一个文件放进文件库吧。
        </p>

        <div
          v-else
          class="af-list"
        >
          <BaseCard
            v-for="file in files"
            :key="file.id"
            class="af-item"
          >
            <div class="af-item__preview">
              <img
                v-if="isImage(file) && imageUrls.get(file.id)"
                :src="imageUrls.get(file.id)"
                :alt="file.name"
              >
              <span v-else>📄</span>
            </div>
            <div class="af-item__main">
              <span
                class="af-item__name"
                :title="file.name"
              >{{ file.name }}</span>
              <span class="af-item__meta">
                {{ fmtSize(file.size) }} · {{ file.category }} · {{ fmtTime(file.createdAt) }}
              </span>
              <span
                class="af-item__ref"
                :class="{ 'is-none': !(file.refs || []).length }"
              >
                {{ (file.refs || []).length ? refText(file) : '未引用' }}
              </span>
            </div>
            <div class="af-item__ops">
              <BaseButton
                type="text"
                class="af-item__delete"
                :disabled="deletingId === file.id"
                @click="removeFile(file)"
              >
                删除
              </BaseButton>
            </div>
          </BaseCard>
        </div>

        <div
          v-if="totalPages > 1"
          class="af-pager"
        >
          <BaseButton
            type="text"
            :disabled="page <= 1 || loading"
            @click="load(page - 1)"
          >
            上一页
          </BaseButton>
          <span class="af-pager__info">{{ page }} / {{ totalPages }}</span>
          <BaseButton
            type="text"
            :disabled="page >= totalPages || loading"
            @click="load(page + 1)"
          >
            下一页
          </BaseButton>
        </div>
      </section>
    </main>

    <!-- 上传文件：底部弹层，成功后刷新第一页 -->
    <BaseModal
      v-if="showUpload"
      title="上传文件"
      sheet
      @close="showUpload = false"
    >
      <BaseUpload
        category="general"
        @update:model-value="onUploaded"
      />
    </BaseModal>
  </div>
</template>

<style scoped>
.page__main {
  padding: 18px 16px 90px;
}
.af-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 26px;
  color: var(--text);
}
.af-sub {
  margin: 4px 0 16px;
  color: var(--muted);
  font-size: 13px;
}
.af-error {
  margin: 0 0 12px;
  color: #d9534f;
  font-size: 13px;
}
.af-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}
.af-search {
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
.af-search:focus {
  border-color: var(--primary);
}
.af-empty {
  padding: 32px 0;
  text-align: center;
  color: var(--muted);
  font-size: 14px;
}
.af-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.af-item {
  display: flex;
  align-items: center;
  gap: 12px;
}
.af-item__preview {
  width: 52px;
  height: 52px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: rgba(201, 116, 59, 0.08);
  font-size: 22px;
  overflow: hidden;
}
.af-item__preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.af-item__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.af-item__name {
  font-weight: 600;
  color: var(--text);
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.af-item__meta {
  color: var(--muted);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.af-item__ref {
  font-size: 12px;
  color: var(--primary);
}
.af-item__ref.is-none {
  color: var(--muted);
}
.af-item__ops {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}
.af-item__delete {
  color: #d9534f;
}
.af-item__delete:active {
  color: #c9302c;
}
.af-pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 16px;
}
.af-pager__info {
  color: var(--muted);
  font-size: 13px;
}
</style>
