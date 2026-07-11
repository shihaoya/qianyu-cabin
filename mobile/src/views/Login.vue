<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import BaseInput from '../components/base/BaseInput.vue'
import BaseButton from '../components/base/BaseButton.vue'
import CabinLogo from '../components/base/CabinLogo.vue'

const router = useRouter()
const auth = useAuthStore()

const mode = ref('login')
const nickname = ref('')
const password = ref('')
const error = ref('')
const submitting = ref(false)

function toggle() {
  mode.value = mode.value === 'login' ? 'register' : 'login'
  error.value = ''
}

async function onSubmit() {
  error.value = ''
  if (!nickname.value || !password.value) {
    error.value = '请填写昵称和密码'
    return
  }
  submitting.value = true
  try {
    if (mode.value === 'login') await auth.login(nickname.value, password.value)
    else await auth.register(nickname.value, password.value)
    router.push('/')
  } catch (e) {
    error.value = e.message || '操作失败'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="auth">
    <div class="auth__card">
      <CabinLogo :size="44" />
      <h1 class="auth__title">{{ mode === 'login' ? '登录' : '注册' }}</h1>
      <form class="auth__form" @submit.prevent="onSubmit">
        <BaseInput v-model="nickname" label="昵称" placeholder="请输入昵称" />
        <BaseInput v-model="password" label="密码" type="password" placeholder="至少 6 位" />
        <p v-if="error" class="auth__error">{{ error }}</p>
        <BaseButton type="primary" :loading="submitting" @click="onSubmit">
          {{ mode === 'login' ? '登录' : '注册并登录' }}
        </BaseButton>
      </form>
      <p class="auth__switch">
        {{ mode === 'login' ? '还没有账号？' : '已有账号？' }}
        <a href="#" @click.prevent="toggle">{{ mode === 'login' ? '去注册' : '去登录' }}</a>
      </p>
    </div>
  </div>
</template>

<style scoped>
.auth {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}
.auth__card {
  width: 340px;
  max-width: 90vw;
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}
.auth__title {
  margin: 0;
  color: var(--text);
}
.auth__form {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.auth__error {
  color: #d9534f;
  font-size: 13px;
  margin: 0;
}
.auth__switch {
  font-size: 14px;
  color: var(--muted);
}
.auth__switch a {
  color: var(--primary);
  text-decoration: none;
}
</style>
