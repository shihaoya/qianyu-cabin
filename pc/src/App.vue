<script setup>
import { onMounted } from 'vue'
import { useAuthStore } from './stores/auth.js'
import ConfirmDialog from './components/base/ConfirmDialog.vue'

const auth = useAuthStore()

// 用户信息由路由守卫统一拉取（见 stores/auth.js 的 ensureUser()），
// 这里只兜底处理 token 失效的情况。
onMounted(async () => {
  if (auth.token) {
    try {
      await auth.ensureUser()
    } catch {
      auth.logout()
    }
  }
})
</script>

<template>
  <router-view />
  <ConfirmDialog />
</template>
