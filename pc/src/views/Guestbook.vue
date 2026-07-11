<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth.js'
import { list as listMessages, create as createMessage, remove as removeMessage } from '../api/guestbook.js'
import AppHeader from '../components/base/AppHeader.vue'
import BaseButton from '../components/base/BaseButton.vue'
import { confirm, alert } from '../composables/useConfirm.js'

const auth = useAuthStore()
const messages = ref([])
const content = ref('')
const anonymous = ref(false)
const submitting = ref(false)
const error = ref('')

async function load() {
  const data = await listMessages()
  messages.value = data.list || []
}

function formatTime(t) {
  const d = new Date(t)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

const NOTE_COLORS = ['#c9743b', '#5b8c7b', '#d99a4e', '#b5673f', '#7a9b6e', '#cf8a5b', '#a9744f']

// 头像/色条底色：具名按昵称 hash 取暖色板；匿名用深暖灰（白字可读）
function noteColor(m) {
  if (m.isAnonymous || !m.nickname) return '#9c8e76'
  let h = 0
  for (const ch of m.nickname) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return NOTE_COLORS[h % NOTE_COLORS.length]
}

function displayName(m) {
  return m.isAnonymous || !m.nickname ? '匿名旅人' : m.nickname
}

// 头像首字：取昵称首个字符（中英文均可），匿名用「旅」
function avatarText(m) {
  if (m.isAnonymous || !m.nickname) return '旅'
  return [...m.nickname][0]
}

// 卡片正文最多展示 50 字，超出显示省略号，点「查看」弹框看全文
const PREVIEW_LEN = 50
function previewContent(m) {
  const text = m.content || ''
  if ([...text].length > PREVIEW_LEN) return [...text].slice(0, PREVIEW_LEN).join('') + '…'
  return text
}
function onView(m) {
  alert({ title: displayName(m), message: m.content })
}

// 复制留言内容，复制成功后在该卡片短暂显示「已复制」
const copiedId = ref(null)
let copyTimer = null
async function onCopy(m) {
  try {
    await navigator.clipboard.writeText(m.content)
  } catch {
    // 兜底：不支持 clipboard API 时用临时 textarea
    const ta = document.createElement('textarea')
    ta.value = m.content
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    try { document.execCommand('copy') } catch { /* ignore */ }
    document.body.removeChild(ta)
  }
  copiedId.value = m.id
  clearTimeout(copyTimer)
  copyTimer = setTimeout(() => { copiedId.value = null }, 1500)
}

// 中文相对时间，鼠标悬停仍可见完整时间（title）
function fromNow(t) {
  const d = new Date(t)
  const now = new Date()
  const diff = (now - d) / 1000
  if (diff < 60) return '刚刚'
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`
  const p = (n) => String(n).padStart(2, '0')
  const hm = `${p(d.getHours())}:${p(d.getMinutes())}`
  if (d.toDateString() === now.toDateString()) return `今天 ${hm}`
  const y = new Date(now)
  y.setDate(now.getDate() - 1)
  if (d.toDateString() === y.toDateString()) return `昨天 ${hm}`
  if (d.getFullYear() === now.getFullYear()) return `${d.getMonth() + 1}月${d.getDate()}日`
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

async function onSubmit() {
  error.value = ''
  if (!content.value.trim()) {
    error.value = '写点什么再发布吧~'
    return
  }
  submitting.value = true
  try {
    await createMessage({
      content: content.value,
      anonymous: auth.isLoggedIn ? anonymous.value : true,
    })
    content.value = ''
    anonymous.value = false
    await load()
  } catch (e) {
    error.value = e.message || '发布失败'
  } finally {
    submitting.value = false
  }
}

function canDelete(m) {
  return auth.isLoggedIn && (auth.isAdmin || m.userId === auth.user?.id)
}

async function onDelete(m) {
  const ok = await confirm({ title: '删除留言', message: '确定删除这条留言吗？', confirmText: '删除' })
  if (!ok) return
  try {
    await removeMessage(m.id)
    await load()
  } catch (e) {
    error.value = e.message || '删除失败'
  }
}

onMounted(load)
</script>

<template>
  <div class="page">
    <AppHeader />
    <main class="page__main">
      <section class="gb-form qy-rise">
        <h1 class="gb-title">留言板</h1>
        <p class="gb-sub">想说点什么都可以，也可以匿名～</p>
        <textarea
          v-model="content"
          class="gb-input"
          rows="5"
          maxlength="500"
          placeholder="写下你的留言…"
        />
        <div class="gb-count" :class="{ 'gb-count--full': content.length >= 500 }">
          {{ content.length }} / 500
        </div>
        <div class="gb-actions">
          <label v-if="auth.isLoggedIn" class="gb-anon">
            <input type="checkbox" v-model="anonymous" /> 匿名发布（不记录信息）
          </label>
          <span v-else class="gb-anon-hint">未登录，将以匿名发布（不记录信息）</span>
          <BaseButton type="primary" :loading="submitting" @click="onSubmit">发布留言</BaseButton>
        </div>
        <p v-if="error" class="gb-error">{{ error }}</p>
      </section>

      <section class="gb-list qy-rise" style="animation-delay:.06s">
        <p v-if="!messages.length" class="gb-empty">
          {{ auth.isLoggedIn ? '还没有留言，来当第一个吧～' : '登录后查看并管理你的留言～' }}
        </p>
        <article
          v-for="(m, i) in messages"
          :key="m.id"
          class="gb-note"
          :style="{ '--accent': noteColor(m), animationDelay: i * 0.04 + 's' }"
        >
          <header class="gb-note__head">
            <span class="gb-note__avatar" :style="{ background: noteColor(m) }">{{ avatarText(m) }}</span>
            <span class="gb-note__name">{{ displayName(m) }}</span>
          </header>
          <p class="gb-note__content">{{ previewContent(m) }}</p>
          <button
            v-if="[...m.content].length > PREVIEW_LEN"
            type="button"
            class="gb-act gb-act--more"
            @click="onView(m)"
          >查看</button>
          <div class="gb-note__foot">
            <span class="gb-note__time" :title="formatTime(m.createdAt)">{{ fromNow(m.createdAt) }}</span>
            <div class="gb-note__acts">
              <button type="button" class="gb-act" @click="onCopy(m)">
                {{ copiedId === m.id ? '已复制' : '复制' }}
              </button>
              <button v-if="canDelete(m)" type="button" class="gb-act gb-act--del" @click="onDelete(m)">删除</button>
            </div>
          </div>
        </article>
      </section>
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
  max-width: 1200px;
  margin: 0 auto;
  padding: 28px 20px 48px;
  box-sizing: border-box;
}
.gb-form {
  background: var(--surface);
  border-radius: calc(var(--radius) + 6px);
  box-shadow: var(--shadow);
  padding: 32px 36px;
}
.gb-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 34px;
  color: var(--text);
}
.gb-sub {
  margin: 6px 0 20px;
  color: var(--muted);
  font-size: 15px;
}
.gb-input {
  width: 100%;
  box-sizing: border-box;
  padding: 12px 14px;
  border: 1px solid var(--primary-soft);
  border-radius: var(--radius);
  background: var(--bg);
  color: var(--text);
  font: inherit;
  resize: vertical;
  line-height: 1.7;
}
.gb-input:focus {
  outline: none;
  border-color: var(--primary);
}
.gb-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 12px;
  flex-wrap: wrap;
}
.gb-anon {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--muted);
  font-size: 13px;
  cursor: pointer;
}
.gb-anon-hint {
  color: var(--muted);
  font-size: 13px;
}
.gb-error {
  margin: 10px 0 0;
  color: #d9534f;
  font-size: 13px;
}
.gb-count {
  margin-top: 6px;
  text-align: right;
  color: var(--muted);
  font-size: 12px;
}
.gb-count--full {
  color: var(--primary);
}
.gb-list {
  column-count: 3;
  column-gap: 20px;
  margin-top: 28px;
}
@media (max-width: 980px) {
  .gb-list { column-count: 2; }
}
@media (max-width: 620px) {
  .gb-list { column-count: 1; }
}
.gb-empty {
  text-align: center;
  color: var(--muted);
  font-size: 14px;
  padding: 24px 0;
}
.gb-note {
  break-inside: avoid;
  display: inline-block;
  width: 100%;
  margin-bottom: 20px;
  background: var(--surface);
  border-radius: var(--radius);
  border-left: 4px solid var(--accent, var(--primary));
  box-shadow: var(--shadow);
  padding: 18px 20px 14px;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
  animation: gb-fade 0.5s ease both;
}
.gb-note:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 28px rgba(120, 90, 50, 0.18);
}
.gb-note__head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.gb-note__avatar {
  flex: none;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: #fff;
  font-family: var(--font-display);
  font-size: 16px;
  line-height: 1;
}
.gb-note__name {
  font-family: var(--font-display);
  font-size: 15px;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.gb-note__content {
  margin: 0;
  color: var(--text);
  line-height: 1.85;
  white-space: pre-wrap;
  word-break: break-word;
}
.gb-note__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 14px;
  padding-top: 10px;
  border-top: 1px dashed var(--primary-soft);
}
.gb-note__time {
  color: var(--muted);
  font-size: 12px;
}
.gb-note__acts {
  display: flex;
  align-items: center;
  gap: 4px;
}
.gb-act {
  border: none;
  background: transparent;
  color: var(--muted);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  padding: 4px 10px;
  border-radius: 8px;
  transition: color 0.15s ease, background 0.15s ease;
}
.gb-act:hover {
  color: var(--primary);
  background: rgba(201, 116, 59, 0.10);
}
.gb-act--del:hover {
  color: #d9534f;
  background: rgba(217, 83, 79, 0.10);
}
.gb-act--more {
  display: block;
  margin-top: 12px;
  padding: 5px 14px;
  border: 1px solid var(--primary-soft);
  color: var(--primary);
  font-size: 13px;
}
.gb-act--more:hover {
  background: rgba(201, 116, 59, 0.10);
}
.gb-act:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}
@keyframes gb-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}
</style>
