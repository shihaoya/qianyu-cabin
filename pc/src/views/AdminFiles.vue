<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { listFiles, deleteFile, fetchFileObjectURL } from '../api/files.js'
import AppHeader from '../components/base/AppHeader.vue'
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

// ---------- 上传弹窗 ----------
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
          <div class="af-actions">
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
              上传文件
            </BaseButton>
          </div>
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
          还没有文件。点上面「上传文件」把第一个文件放进文件库吧。
        </p>

        <table
          v-else
          class="af-table"
        >
          <thead>
            <tr>
              <th class="af-th af-th--preview">
                预览
              </th>
              <th class="af-th">
                文件名
              </th>
              <th class="af-th">
                大小
              </th>
              <th class="af-th">
                分类
              </th>
              <th class="af-th">
                引用
              </th>
              <th class="af-th">
                上传时间
              </th>
              <th class="af-th af-th--ops">
                操作
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="file in files"
              :key="file.id"
              class="af-tr"
            >
              <td class="af-td af-td--preview">
                <div class="af-thumb">
                  <img
                    v-if="isImage(file) && imageUrls.get(file.id)"
                    :src="imageUrls.get(file.id)"
                    :alt="file.name"
                  >
                  <span v-else>📄</span>
                </div>
              </td>
              <td class="af-td">
                <div
                  class="af-name"
                  :title="file.name"
                >
                  {{ file.name }}
                </div>
                <div class="af-mime">
                  {{ file.mimeType }}
                </div>
              </td>
              <td class="af-td af-td--num">
                {{ fmtSize(file.size) }}
              </td>
              <td class="af-td">
                <span class="af-cat">{{ file.category }}</span>
              </td>
              <td class="af-td">
                <span
                  v-if="(file.refs || []).length"
                  class="af-ref"
                  :title="refText(file)"
                >{{ refText(file) }}</span>
                <span
                  v-else
                  class="af-ref af-ref--none"
                >未引用</span>
              </td>
              <td class="af-td af-td--time">
                {{ fmtTime(file.createdAt) }}
              </td>
              <td class="af-td af-td--ops">
                <BaseButton
                  type="text"
                  class="af-delete"
                  :disabled="deletingId === file.id"
                  @click="removeFile(file)"
                >
                  删除
                </BaseButton>
              </td>
            </tr>
          </tbody>
        </table>

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

    <!-- 上传文件：成功后刷新第一页 -->
    <BaseModal
      v-if="showUpload"
      title="上传文件"
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
.page {
  min-height: 100vh;
  background: var(--bg);
  display: flex;
  flex-direction: column;
}
.page__main {
  flex: 1;
  width: 100%;
  max-width: 960px;
  margin: 0 auto;
  padding: 28px 20px 48px;
  box-sizing: border-box;
}
.af-title {
  margin: 0 0 6px;
  font-family: var(--font-display);
  font-size: 30px;
  color: var(--text);
}
.af-sub {
  margin: 0 0 16px;
  color: var(--muted);
  font-size: 14px;
}
.af-error {
  margin: 0 0 10px;
  color: #d9534f;
  font-size: 14px;
}
.af-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.af-search {
  flex: 1;
  min-width: 220px;
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
.af-actions {
  display: flex;
  gap: 8px;
}
.af-empty {
  padding: 32px 0;
  text-align: center;
  color: var(--muted);
  font-size: 14px;
}
.af-table {
  width: 100%;
  border-collapse: collapse;
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  overflow: hidden;
}
.af-th {
  text-align: left;
  padding: 10px 12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
  border-bottom: 1px solid rgba(201, 116, 59, 0.12);
  background: rgba(253, 246, 232, 0.6);
  white-space: nowrap;
}
.af-th--preview {
  width: 72px;
}
.af-th--ops {
  width: 80px;
}
.af-td {
  padding: 10px 12px;
  font-size: 13px;
  color: var(--text);
  border-bottom: 1px solid rgba(201, 116, 59, 0.08);
  vertical-align: middle;
}
.af-tr:last-child .af-td {
  border-bottom: none;
}
.af-td--preview {
  width: 72px;
}
.af-thumb {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: rgba(201, 116, 59, 0.08);
  font-size: 20px;
  overflow: hidden;
}
.af-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.af-name {
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
}
.af-mime {
  font-size: 11px;
  color: var(--muted);
  margin-top: 2px;
}
.af-td--num {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.af-cat {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--primary-soft);
  color: var(--primary);
  font-size: 12px;
  white-space: nowrap;
}
.af-ref {
  font-size: 12px;
  color: var(--primary);
  white-space: nowrap;
}
.af-ref--none {
  color: var(--muted);
}
.af-td--time {
  font-variant-numeric: tabular-nums;
  color: var(--muted);
  white-space: nowrap;
}
.af-td--ops {
  text-align: right;
}
.af-delete {
  color: #d9534f;
}
.af-delete:hover {
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
