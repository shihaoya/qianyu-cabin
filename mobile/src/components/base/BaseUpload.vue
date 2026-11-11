<!--
@doc
name: BaseUpload
path: src/components/base/BaseUpload.vue
category: base
purpose: 文件上传（选择/拖拽/进度/预览），上传后通过 v-model 绑定文件 id，业务方用 id 关联文件
appliesTo: 通用
props: modelValue:Number|Array=null — 文件 id（multiple 时为 id 数组）; multiple:Boolean=false — 是否多文件; category:String='general' — 业务分类（小写字母/数字/-/_）; accept:String='' — 限定类型（如 "image/*"），空则按服务端白名单; maxSize:Number=10485760 — 单文件大小上限（字节）; disabled:Boolean=false — 禁用
events: update:modelValue — 上传成功/移除后同步最新 id（单文件为 Number，多文件为数组）
example: <BaseUpload v-model="form.avatarFileId" category="avatar" accept="image/*" />
-->
<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import { fetchFileObjectURL, getFilesByIds, uploadFiles } from '../../api/files.js'

const props = defineProps({
  modelValue: { type: [Number, Array], default: null },
  multiple: { type: Boolean, default: false },
  category: { type: String, default: 'general' },
  accept: { type: String, default: '' },
  maxSize: { type: Number, default: 10 * 1024 * 1024 },
  disabled: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue'])

// 已传文件展示列表：{ id, name, size, objectUrl }，objectUrl 由带 token 的 blob 换取
const items = ref([])
const uploading = ref(false)
const progress = ref(0)
const error = ref('')
const inputRef = ref(null)
const dragOver = ref(false)
let revoked = []

function fmtSize(n) {
  if (n < 1024) return `${n}B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`
  return `${(n / 1024 / 1024).toFixed(1)}MB`
}

function syncModel() {
  const ids = items.value.map((it) => it.id)
  emit('update:modelValue', props.multiple ? ids : ids[0] ?? null)
}

async function loadByIds(ids) {
  if (!ids.length) {
    items.value = []
    return
  }
  const files = await getFilesByIds(ids)
  const next = []
  for (const f of files) {
    const objectUrl = await fetchFileObjectURL(f.id).catch(() => null)
    if (objectUrl) revoked.push(objectUrl)
    next.push({ id: f.id, name: f.name, size: f.size, objectUrl })
  }
  items.value = next
}

// 外部（如编辑回显）直接改 id 时重新拉取；上传/移除内部已同步的不重复拉
watch(
  () => props.modelValue,
  (v) => {
    const ids = props.multiple ? (v ?? []) : v ? [v] : []
    if (ids.join(',') !== items.value.map((it) => it.id).join(',')) loadByIds(ids)
  },
  { immediate: true, deep: true }
)

onBeforeUnmount(() => {
  revoked.forEach((u) => URL.revokeObjectURL(u))
  revoked = []
})

function pick() {
  if (!props.disabled && !uploading.value) inputRef.value?.click()
}

function validate(file) {
  if (file.size > props.maxSize) {
    error.value = `「${file.name}」超过大小限制（${fmtSize(props.maxSize)}）`
    return false
  }
  return true
}

async function onSelect(e) {
  error.value = ''
  const files = [...(e.target.files ?? [])].filter(validate)
  e.target.value = ''
  if (!files.length) return
  await doUpload(props.multiple ? files : files.slice(0, 1))
}

async function onDrop(e) {
  dragOver.value = false
  if (props.disabled || uploading.value) return
  error.value = ''
  const files = [...(e.dataTransfer?.files ?? [])].filter(validate)
  if (!files.length) return
  await doUpload(props.multiple ? files : files.slice(0, 1))
}

async function doUpload(files) {
  uploading.value = true
  progress.value = 0
  try {
    const res = await uploadFiles(files, {
      category: props.category,
      onUploadProgress: (e) => {
        if (e.total) progress.value = Math.round((e.loaded / e.total) * 100)
      },
    })
    const list = Array.isArray(res) ? res : [res]
    const added = []
    for (const f of list) {
      const objectUrl = await fetchFileObjectURL(f.id).catch(() => null)
      if (objectUrl) revoked.push(objectUrl)
      added.push({ id: f.id, name: f.name, size: f.size, objectUrl })
    }
    items.value = props.multiple ? [...items.value, ...added] : added.slice(0, 1)
    syncModel()
  } catch (err) {
    error.value = err?.message || '上传失败，请稍后再试'
  } finally {
    uploading.value = false
  }
}

function removeAt(i) {
  const [it] = items.value.splice(i, 1)
  if (it?.objectUrl) {
    URL.revokeObjectURL(it.objectUrl)
    revoked = revoked.filter((u) => u !== it.objectUrl)
  }
  syncModel()
}
</script>

<template>
  <div class="base-upload">
    <div
      class="base-upload__drop"
      :class="{ 'is-dragover': dragOver, 'is-disabled': disabled || uploading }"
      @click="pick"
      @dragover.prevent="dragOver = true"
      @dragleave.prevent="dragOver = false"
      @drop.prevent="onDrop"
    >
      <template v-if="uploading">
        <div class="base-upload__bar">
          <div
            class="base-upload__bar-inner"
            :style="{ width: progress + '%' }"
          />
        </div>
        <span class="base-upload__hint">上传中 {{ progress }}%</span>
      </template>
      <template v-else>
        <span class="base-upload__icon">＋</span>
        <span class="base-upload__hint">点击或拖拽文件到此处上传</span>
      </template>
      <input
        ref="inputRef"
        type="file"
        class="base-upload__input"
        :accept="accept"
        :multiple="multiple"
        :disabled="disabled"
        @change="onSelect"
      >
    </div>

    <ul
      v-if="items.length"
      class="base-upload__list"
    >
      <li
        v-for="(it, i) in items"
        :key="it.id"
        class="base-upload__item"
      >
        <img
          v-if="it.objectUrl && /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(it.name)"
          :src="it.objectUrl"
          :alt="it.name"
          class="base-upload__thumb"
        >
        <span
          v-else
          class="base-upload__file"
        >📄</span>
        <span class="base-upload__name">{{ it.name }}</span>
        <span class="base-upload__size">{{ fmtSize(it.size) }}</span>
        <button
          v-if="!disabled"
          type="button"
          class="base-upload__remove"
          @click.stop="removeAt(i)"
        >
          ×
        </button>
      </li>
    </ul>
    <p
      v-if="error"
      class="base-upload__error"
    >
      {{ error }}
    </p>
  </div>
</template>

<style scoped>
.base-upload__drop {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 22px 16px;
  border: 1px dashed var(--primary-soft);
  border-radius: var(--radius);
  background: var(--surface);
  cursor: pointer;
  transition: border-color 0.15s ease;
}
.base-upload__drop.is-dragover {
  border-color: var(--primary);
}
.base-upload__drop.is-disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.base-upload__input {
  display: none;
}
.base-upload__icon {
  font-size: 22px;
  color: var(--muted);
}
.base-upload__hint {
  color: var(--muted);
  font-size: 13px;
}
.base-upload__bar {
  width: 80%;
  height: 6px;
  border-radius: 3px;
  background: var(--primary-soft);
  overflow: hidden;
}
.base-upload__bar-inner {
  height: 100%;
  background: var(--primary);
  transition: width 0.2s ease;
}
.base-upload__list {
  margin: 10px 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.base-upload__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border: 1px solid var(--primary-soft);
  border-radius: var(--radius);
  background: var(--surface);
}
.base-upload__thumb {
  width: 32px;
  height: 32px;
  object-fit: cover;
  border-radius: 4px;
}
.base-upload__file {
  font-size: 20px;
}
.base-upload__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text);
  font-size: 13px;
}
.base-upload__size {
  color: var(--muted);
  font-size: 12px;
}
.base-upload__remove {
  border: none;
  background: none;
  color: var(--muted);
  font-size: 16px;
  cursor: pointer;
  padding: 0 4px;
}
.base-upload__remove:hover {
  color: #d9534f;
}
.base-upload__error {
  margin: 6px 0 0;
  color: #d9534f;
  font-size: 13px;
}
</style>
