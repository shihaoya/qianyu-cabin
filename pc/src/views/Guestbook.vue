<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth.js'
import { list as listMessages, create as createMessage, remove as removeMessage } from '../api/guestbook.js'
import AppHeader from '../components/base/AppHeader.vue'
import BaseButton from '../components/base/BaseButton.vue'
import BaseCard from '../components/base/BaseCard.vue'

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
  if (!window.confirm('确定删除这条留言吗？')) return
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
        <BaseCard v-for="m in messages" :key="m.id" class="gb-item">
          <div class="gb-item__head">
            <span class="gb-item__name">{{ m.isAnonymous ? '匿名' : (m.nickname || '匿名') }}</span>
            <span class="gb-item__time">{{ formatTime(m.createdAt) }}</span>
          </div>
          <p class="gb-item__content">{{ m.content }}</p>
          <div v-if="canDelete(m)" class="gb-item__foot">
            <button type="button" class="gb-del" @click="onDelete(m)">删除</button>
          </div>
        </BaseCard>
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
.gb-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 28px;
}
.gb-empty {
  text-align: center;
  color: var(--muted);
  font-size: 14px;
  padding: 24px 0;
}
.gb-item__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 6px;
}
.gb-item__name {
  font-weight: 600;
  color: var(--text);
}
.gb-item__time {
  color: var(--muted);
  font-size: 12px;
  white-space: nowrap;
}
.gb-item__content {
  margin: 0;
  color: var(--text);
  line-height: 1.8;
  white-space: pre-wrap;
  word-break: break-word;
}
.gb-item__foot {
  display: flex;
  justify-content: flex-end;
  margin-top: 10px;
}
.gb-del {
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
.gb-del:hover {
  color: #d9534f;
  background: rgba(217, 83, 79, 0.10);
}
.gb-del:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}
</style>
