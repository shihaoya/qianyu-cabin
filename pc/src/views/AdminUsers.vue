<script setup>
import { ref, onMounted } from 'vue'
import { listUsers, updateRole } from '../api/admin.js'
import AppHeader from '../components/base/AppHeader.vue'
import BaseCard from '../components/base/BaseCard.vue'

const users = ref([])
const total = ref(0)
const savingId = ref(null)
const error = ref('')

async function load() {
  const data = await listUsers({ page: 1, pageSize: 50 })
  users.value = data.list || []
  total.value = data.total || 0
}

async function onChange(role, user) {
  if (role === user.role) return
  savingId.value = user.id
  error.value = ''
  try {
    await updateRole(user.id, role)
    user.role = role
  } catch (e) {
    error.value = e.message || '更新失败'
  } finally {
    savingId.value = null
  }
}

onMounted(load)
</script>

<template>
  <div class="page">
    <AppHeader />
    <main class="page__main">
      <section class="qy-rise">
        <h1 class="au-title">用户管理</h1>
        <p class="au-sub">共 {{ total }} 位用户 · 仅开发者可见</p>
        <p v-if="error" class="au-error">{{ error }}</p>
        <div class="au-list">
          <BaseCard v-for="u in users" :key="u.id" class="au-item">
            <div class="au-item__main">
              <span class="au-item__name">{{ u.nickname }}</span>
              <span class="au-item__meta">注册于 {{ new Date(u.createdAt).toLocaleDateString() }}</span>
            </div>
            <select
              class="au-item__role"
              :value="u.role"
              :disabled="savingId === u.id"
              @change="onChange($event.target.value, u)"
            >
              <option value="user">普通用户</option>
              <option value="admin">开发者</option>
            </select>
          </BaseCard>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.page__main {
  max-width: 880px;
  margin: 0 auto;
  padding: 28px 20px 48px;
}
.au-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 28px;
  color: var(--text);
}
.au-sub {
  margin: 4px 0 20px;
  color: var(--muted);
  font-size: 14px;
}
.au-error {
  margin: 0 0 14px;
  color: #d9534f;
  font-size: 13px;
}
.au-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.au-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.au-item__main {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.au-item__name {
  font-weight: 600;
  color: var(--text);
}
.au-item__meta {
  color: var(--muted);
  font-size: 12px;
}
.au-item__role {
  font: inherit;
  padding: 8px 10px;
  border: 1px solid var(--primary-soft);
  border-radius: 10px;
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
}
.au-item__role:focus {
  outline: none;
  border-color: var(--primary);
}
</style>
