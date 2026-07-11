<script setup>
import { ref, onMounted } from 'vue'
import { listUsers, updateRole } from '../api/admin.js'
import { useAuthStore } from '../stores/auth.js'
import AppHeader from '../components/base/AppHeader.vue'
import BaseCard from '../components/base/BaseCard.vue'
import BaseButton from '../components/base/BaseButton.vue'

const auth = useAuthStore()
const users = ref([])
const total = ref(0)
const error = ref('')

// 编辑弹窗状态
const editing = ref(null)
const draftRole = ref('')
const savingEdit = ref(false)

async function load() {
  const data = await listUsers({ page: 1, pageSize: 50 })
  users.value = data.list || []
  total.value = data.total || 0
}

function openEdit(user) {
  editing.value = user
  draftRole.value = user.role
}

async function saveEdit() {
  if (!editing.value) return
  const id = editing.value.id
  const role = draftRole.value
  if (role === editing.value.role) {
    editing.value = null
    return
  }
  savingEdit.value = true
  error.value = ''
  try {
    await updateRole(id, role)
    editing.value.role = role
    editing.value = null
  } catch (e) {
    error.value = e.message || '更新失败'
  } finally {
    savingEdit.value = false
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
              <span class="au-item__meta">
                注册于 {{ new Date(u.createdAt).toLocaleDateString() }} · {{ u.role === 'admin' ? '开发者' : '家庭成员' }}
              </span>
            </div>
            <BaseButton type="text" @click="openEdit(u)">编辑</BaseButton>
          </BaseCard>
        </div>
      </section>
    </main>

    <!-- 编辑用户弹窗：仅可调整角色，账号与密码不可修改 -->
    <transition name="au-fade">
      <div v-if="editing" class="au-mask" @click.self="editing = null">
        <div class="au-modal" role="dialog" aria-modal="true">
          <h3 class="au-modal__title">编辑用户</h3>

          <div class="au-field">
            <span class="au-field__label">账号（昵称）</span>
            <div class="au-field__readonly">{{ editing.nickname }}</div>
          </div>

          <div class="au-field">
            <span class="au-field__label">角色</span>
            <div class="au-roles">
              <label
                v-for="role in ['user', 'admin']"
                :key="role"
                class="au-role"
                :class="{ 'is-disabled': editing.id === auth.user.id && role === 'user' }"
              >
                <input
                  type="radio"
                  name="role"
                  :value="role"
                  v-model="draftRole"
                  :disabled="editing.id === auth.user.id && role === 'user'"
                />
                <span>{{ role === 'admin' ? '开发者' : '家庭成员' }}</span>
              </label>
            </div>
            <p class="au-field__hint">账号与密码不可修改，仅可调整角色</p>
          </div>

          <div class="au-modal__actions">
            <BaseButton type="text" @click="editing = null">取消</BaseButton>
            <BaseButton type="primary" :loading="savingEdit" :disabled="savingEdit" @click="saveEdit">
              保存
            </BaseButton>
          </div>
        </div>
      </div>
    </transition>
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

/* 编辑弹窗 */
.au-mask {
  position: fixed;
  inset: 0;
  background: rgba(60, 45, 30, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
  box-sizing: border-box;
}
.au-modal {
  width: min(92vw, 420px);
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: 0 20px 50px rgba(90, 60, 30, 0.3);
  padding: 22px 20px 16px;
}
.au-modal__title {
  margin: 0 0 16px;
  font-family: var(--font-display);
  font-size: 20px;
  color: var(--text);
}
.au-field {
  margin-bottom: 16px;
}
.au-field__label {
  display: block;
  color: var(--muted);
  font-size: 13px;
  margin-bottom: 6px;
}
.au-field__readonly {
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--bg);
  color: var(--text);
  font-weight: 600;
}
.au-roles {
  display: flex;
  gap: 10px;
}
.au-role {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  border: 1px solid var(--primary-soft);
  border-radius: 10px;
  cursor: pointer;
  color: var(--text);
  font-size: 14px;
}
.au-role.is-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.au-field__hint {
  margin: 8px 0 0;
  color: var(--muted);
  font-size: 12px;
}
.au-modal__actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 4px;
}
.au-fade-enter-active,
.au-fade-leave-active {
  transition: opacity 0.18s ease;
}
.au-fade-enter-from,
.au-fade-leave-to {
  opacity: 0;
}
</style>
