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

// 每张便签的倾斜角（度），按序号循环取，模拟随手贴的随机感
const NOTE_ANGLES = [-4, 3, -2.5, 4, -3.5, 2.5, -4.5, 3.5]
function noteAngle(i) {
  return NOTE_ANGLES[i % NOTE_ANGLES.length]
}

// 昵称便签的位置/角度（基于序号，刷新后稳定不跳变）
const NAME_LEFT = [16, 10, 22, 12, 18, 9, 15, 12]
const NAME_TOP = [-13, -10, -15, -11, -14, -9, -12, -16]
const NAME_ROT = [-3, -5, -2, -4, -6, -3, -5, -2]
// 卡片整体的上下错位，打破规整网格感
const CARD_SHIFT = [0, 8, 4, 10, 6, 0, 9, 5]
function nameLeft(i) { return NAME_LEFT[i % NAME_LEFT.length] }
function nameTop(i) { return NAME_TOP[i % NAME_TOP.length] }
function nameRot(i) { return NAME_ROT[i % NAME_ROT.length] }
function cardShift(i) { return CARD_SHIFT[i % CARD_SHIFT.length] }

// 用户名便签底色：具名按昵称 hash 取暖色板；匿名用深暖灰（白字可读）
function noteColor(m) {
  if (m.isAnonymous || !m.nickname) return '#9c8e76'
  let h = 0
  for (const ch of m.nickname) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return NOTE_COLORS[h % NOTE_COLORS.length]
}

function displayName(m) {
  return m.isAnonymous || !m.nickname ? '匿名旅人' : m.nickname
}

// 卡片宽度由内容长度决定（内容多→更宽），再叠加按序号的微抖动，避免"长内容配小框"
function contentLen(m) { return (m.content || '').length }
function cardWidth(m, i) {
  const base = 140 + Math.min(contentLen(m), 120) * 0.5
  const jitter = [0, 8, -6, 10, -4, 6, -8, 5][i % 8]
  return Math.max(130, Math.round(base + jitter))
}
// 内容越长，行内占比（flex-grow）越大，避免内容少却占大框
function cardGrow(m) {
  return +(0.7 + Math.min(contentLen(m), 200) / 200 * 0.8).toFixed(2)
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
          rows="3"
          maxlength="500"
          placeholder="写下你的留言…"
        />
        <div class="gb-count" :class="{ 'gb-count--full': content.length >= 500 }">
          {{ content.length }} / 500
        </div>
        <div class="gb-actions">
          <label v-if="auth.isLoggedIn" class="gb-anon">
            <input type="checkbox" v-model="anonymous" /> 匿名（不记录信息）
          </label>
          <span v-else class="gb-anon-hint">未登录，将匿名发布</span>
          <BaseButton type="primary" :loading="submitting" @click="onSubmit">发布</BaseButton>
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
          :style="{
            '--rot': noteAngle(i) + 'deg',
            '--name-rot': nameRot(i) + 'deg',
            marginTop: cardShift(i) + 'px',
            flex: cardGrow(m) + ' 1 ' + cardWidth(m, i) + 'px',
            animationDelay: i * 0.04 + 's',
          }"
        >
          <span class="gb-note__name" :style="{ background: noteColor(m), left: nameLeft(i) + 'px', top: nameTop(i) + 'px' }">{{ displayName(m) }}</span>
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
  padding: 18px 16px 90px;
}
.gb-form {
  background: var(--surface);
  border-radius: calc(var(--radius) + 4px);
  box-shadow: var(--shadow);
  padding: 20px 18px;
}
.gb-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 26px;
  color: var(--text);
}
.gb-sub {
  margin: 4px 0 14px;
  color: var(--muted);
  font-size: 13px;
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
  gap: 10px;
  margin-top: 12px;
  flex-wrap: wrap;
}
.gb-anon {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--muted);
  font-size: 13px;
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
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 28px 12px;
  margin-top: 22px;
}
.gb-empty {
  text-align: center;
  color: var(--muted);
  font-size: 14px;
  padding: 20px 0;
}
.gb-note {
  position: relative;
  --rot: -1.2deg;
  break-inside: avoid;
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 26px 18px 14px;
  transform: rotate(var(--rot));
  transition: transform 0.18s ease, box-shadow 0.18s ease;
  animation: gb-fade 0.5s ease both;
}
.gb-note:active {
  transform: rotate(0deg) translateY(-2px);
  box-shadow: 0 10px 24px rgba(120, 90, 50, 0.18);
}
.gb-note:active .gb-note__name {
  transform: rotate(0deg);
}
.gb-note__name {
  position: absolute;
  top: -13px;
  left: 16px;
  z-index: 2;
  font-family: var(--font-display);
  font-size: 13px;
  color: #fff;
  padding: 4px 12px;
  border-radius: 7px;
  transform: rotate(var(--name-rot, -3deg));
  box-shadow: 0 3px 9px rgba(120, 90, 50, 0.22);
  white-space: nowrap;
  max-width: calc(100% - 32px);
  overflow: hidden;
  text-overflow: ellipsis;
  transition: transform 0.18s ease;
}
.gb-note__name::before {
  content: "";
  position: absolute;
  top: -5px;
  left: 50%;
  width: 28px;
  height: 10px;
  transform: translateX(-50%) rotate(5deg);
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.75);
  border-radius: 2px;
}
.gb-note__content {
  margin: 0;
  color: var(--text);
  line-height: 1.8;
  font-size: 14px;
  white-space: pre-wrap;
  word-break: break-word;
}
.gb-note__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 12px;
}
.gb-note__time {
  color: var(--muted);
  font-size: 11px;
}
.gb-note__acts {
  display: flex;
  align-items: center;
  gap: 2px;
}
.gb-act {
  border: none;
  background: transparent;
  color: var(--muted);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 8px;
  transition: color 0.15s ease, background 0.15s ease;
}
.gb-act:active {
  color: var(--primary);
  background: rgba(201, 116, 59, 0.10);
}
.gb-act--del:active {
  color: #d9534f;
  background: rgba(217, 83, 79, 0.10);
}
.gb-act--more {
  display: block;
  margin-top: 10px;
  padding: 5px 14px;
  border: 1px solid var(--primary-soft);
  color: var(--primary);
  font-size: 12px;
}
.gb-act--more:active {
  background: rgba(201, 116, 59, 0.10);
}
@keyframes gb-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}
</style>
