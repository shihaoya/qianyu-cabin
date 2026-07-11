<script setup>
import { ref, onMounted } from 'vue'
import { listUsers, updateRole } from '../api/admin.js'
import { useAuthStore } from '../stores/auth.js'
import { roleLabel, ROLES, canAssignRole, canSetRole } from '../permissions.js'
import AppHeader from '../components/base/AppHeader.vue'
import BaseCard from '../components/base/BaseCard.vue'
import BaseButton from '../components/base/BaseButton.vue'

const auth = useAuthStore()

// 可选角色由自身层级派生：管理员只能设 user/admin，开发管理员可选全部
const roleOptions = ROLES.filter((r) => canAssignRole(auth.user, r))

const users = ref([])
const total = ref(0)
const error = ref('')

// 底部弹窗状态
const editing = ref(null)
const draftRole = ref('')
const savingEdit = ref(false)

async function load() {
  const data = await listUsers({ page: 1, pageSize: 50 })
  users.value = data.list || []
  total.value = data.total || 0
}

function openEdit(user) {
  // 不能改自己、不能动开发管理员账号：统一走 canSetRole 判定
  if (!canSetRole(auth.user, user, user.role)) return
  editing.value = user
  draftRole.value = user.role
}

async function saveEdit() {
  if (!editing.value) return
  const id = editing.value.id
  const role = draftRole.value
  // 改自己被后端禁止，前端也直接禁用，这里再兜底一次
  if (id === auth.user.id) return
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
        <p class="au-sub">共 {{ total }} 位用户 · 仅管理员（开发者）与开发管理员（站长）可见</p>
        <p v-if="error" class="au-error">{{ error }}</p>
        <div class="au-list">
          <BaseCard v-for="u in users" :key="u.id" class="au-item">
            <div class="au-item__main">
              <span class="au-item__name">{{ u.nickname }}</span>
              <span class="au-item__meta">
                注册于 {{ new Date(u.createdAt).toLocaleDateString() }} · {{ roleLabel(u.role) }}
              </span>
            </div>
            <BaseButton
              v-if="canSetRole(auth.user, u, u.role)"
              type="text"
              @click="openEdit(u)"
            >
              编辑
            </BaseButton>
            <span v-else class="au-item__locked">不可编辑</span>
          </BaseCard>
        </div>
      </section>
    </main>

    <!-- 编辑用户：底部弹出表单 -->
    <transition name="au-slide">
      <div v-if="editing" class="au-sheet-wrap">
        <div class="au-sheet-mask" @click="editing = null" />
        <div class="au-sheet" role="dialog" aria-modal="true">
          <div class="au-sheet__handle" />
          <h3 class="au-sheet__title">编辑用户</h3>

          <div class="au-field">
            <span class="au-field__label">账号（昵称）</span>
            <div class="au-field__readonly">{{ editing.nickname }}</div>
          </div>

          <div class="au-field">
            <span class="au-field__label">角色</span>
            <div class="au-roles">
              <label
                v-for="role in roleOptions"
                :key="role"
                class="au-role"
                :class="{ 'is-disabled': editing.id === auth.user.id }"
              >
                <input
                  type="radio"
                  name="role"
                  :value="role"
                  v-model="draftRole"
                  :disabled="editing.id === auth.user.id"
                />
                <span>{{ roleLabel(role) }}</span>
              </label>
            </div>
            <p class="au-field__hint">
              {{
                editing.id === auth.user.id
                  ? '不能修改自己的角色'
                  : '账号与密码不可修改，仅可调整角色'
              }}
            </p>
          </div>

          <div class="au-sheet__actions">
            <BaseButton type="text" @click="editing = null">取消</BaseButton>
            <BaseButton
              type="primary"
              :loading="savingEdit"
              :disabled="savingEdit || editing.id === auth.user.id"
              @click="saveEdit"
            >
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
  padding: 18px 16px 90px;
}
.au-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 26px;
  color: var(--text);
}
.au-sub {
  margin: 4px 0 18px;
  color: var(--muted);
  font-size: 13px;
}
.au-error {
  margin: 0 0 12px;
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
.au-item__locked {
  color: var(--muted);
  font-size: 13px;
}

/* 底部弹出表单 */
.au-sheet-wrap {
  position: fixed;
  inset: 0;
  z-index: 1000;
}
.au-sheet-mask {
  position: absolute;
  inset: 0;
  background: rgba(60, 45, 30, 0.45);
}
.au-sheet {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--surface);
  border-radius: 18px 18px 0 0;
  padding: 12px 18px calc(20px + env(safe-area-inset-bottom));
  box-shadow: 0 -12px 40px rgba(90, 60, 30, 0.28);
}
.au-sheet__handle {
  width: 38px;
  height: 4px;
  border-radius: 999px;
  background: var(--primary-soft);
  margin: 4px auto 14px;
}
.au-sheet__title {
  margin: 0 0 16px;
  font-family: var(--font-display);
  font-size: 19px;
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
  flex-direction: column;
  gap: 10px;
}
.au-role {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid var(--primary-soft);
  border-radius: 12px;
  cursor: pointer;
  color: var(--text);
  font-size: 15px;
}
.au-role.is-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.au-role input {
  width: 18px;
  height: 18px;
  accent-color: var(--primary);
}
.au-field__hint {
  margin: 10px 0 0;
  color: var(--muted);
  font-size: 12px;
}
.au-sheet__actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 8px;
}

/* 底部滑入动画 */
.au-slide-enter-active .au-sheet,
.au-slide-leave-active .au-sheet {
  transition: transform 0.25s ease;
}
.au-slide-enter-from .au-sheet,
.au-slide-leave-to .au-sheet {
  transform: translateY(100%);
}
.au-slide-enter-active .au-sheet-mask,
.au-slide-leave-active .au-sheet-mask {
  transition: opacity 0.25s ease;
}
.au-slide-enter-from .au-sheet-mask,
.au-slide-leave-to .au-sheet-mask {
  opacity: 0;
}
</style>
