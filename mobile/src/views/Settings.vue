<script setup>
import { reactive, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import { changePassword as apiChangePassword } from '../api/auth.js'
import { alert } from '../composables/useConfirm.js'
import BaseCard from '../components/base/BaseCard.vue'
import BaseInput from '../components/base/BaseInput.vue'
import BaseButton from '../components/base/BaseButton.vue'
import TabBar from '../components/base/TabBar.vue'

const router = useRouter()
const auth = useAuthStore()

const form = reactive({ currentPassword: '', newPassword: '', confirmPassword: '' })
const errors = reactive({ currentPassword: '', newPassword: '', confirmPassword: '' })
const submitting = ref(false)

onMounted(() => {
  if (!auth.isLoggedIn) router.replace('/login')
})

function validate() {
  errors.currentPassword = form.currentPassword ? '' : '请输入当前密码'
  errors.newPassword = !form.newPassword
    ? '请输入新密码'
    : form.newPassword.length < 6
      ? '新密码至少 6 位'
      : ''
  errors.confirmPassword =
    form.confirmPassword !== form.newPassword ? '两次输入的新密码不一致' : ''
  return !errors.currentPassword && !errors.newPassword && !errors.confirmPassword
}

async function onSubmit() {
  if (submitting.value) return
  if (!validate()) return
  submitting.value = true
  try {
    await apiChangePassword(form.currentPassword, form.newPassword)
    await alert({ title: '修改成功', message: '你的密码已经更新啦～' })
    form.currentPassword = ''
    form.newPassword = ''
    form.confirmPassword = ''
  } catch (e) {
    errors.currentPassword = e?.message || '修改失败，请稍后再试'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="settings">
    <main class="settings__main">
      <h1 class="settings__page-title">我的</h1>

      <BaseCard>
        <h2 class="settings__section-title">账号信息</h2>
        <div class="settings__row">
          <span class="settings__label">昵称</span>
          <span class="settings__value">{{ auth.user?.nickname }}</span>
        </div>
        <div class="settings__row">
          <span class="settings__label">角色</span>
          <span class="settings__value">{{ auth.user?.role === 'admin' ? '开发者' : '家庭成员' }}</span>
        </div>
      </BaseCard>

      <BaseCard>
        <h2 class="settings__section-title">修改密码</h2>
        <p class="settings__sub">记得用一个容易记住、又不好猜的密码哦</p>
        <form class="settings__form" @submit.prevent="onSubmit">
          <BaseInput
            v-model="form.currentPassword"
            type="password"
            label="当前密码"
            :error="errors.currentPassword"
          />
          <BaseInput
            v-model="form.newPassword"
            type="password"
            label="新密码"
            :error="errors.newPassword"
          />
          <BaseInput
            v-model="form.confirmPassword"
            type="password"
            label="确认新密码"
            :error="errors.confirmPassword"
          />
          <div class="settings__actions">
            <BaseButton type="primary" class="settings__submit" :loading="submitting" :disabled="submitting">
              保存修改
            </BaseButton>
            <BaseButton type="text" @click="router.push('/')">返回首页</BaseButton>
          </div>
        </form>
      </BaseCard>
    </main>
    <TabBar />
  </div>
</template>

<style scoped>
.settings__main {
  padding: 16px;
  padding-bottom: 84px;
  margin-top: 8px;
}
.settings__page-title {
  margin: 0 0 16px;
  font-family: var(--font-display);
  font-size: 24px;
  color: var(--text);
}
.settings__section-title {
  margin: 0 0 12px;
  font-family: var(--font-display);
  font-size: 18px;
  color: var(--text);
}
.settings__sub {
  margin: 0 0 16px;
  color: var(--muted);
  font-size: 13px;
}
.settings__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px 0;
  border-bottom: 1px solid rgba(120, 90, 50, 0.08);
}
.settings__row:last-child {
  border-bottom: none;
}
.settings__label {
  color: var(--muted);
  font-size: 14px;
}
.settings__value {
  color: var(--text);
  font-size: 15px;
  font-weight: 600;
}
.settings__main > .base-card {
  margin-bottom: 14px;
}
.settings__form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.settings__actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 4px;
}
.settings__submit {
  width: 100%;
}
</style>
