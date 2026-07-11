<script setup>
import { onMounted } from 'vue'
import { useAuthStore } from './stores/auth.js'
import ConfirmDialog from './components/base/ConfirmDialog.vue'

const auth = useAuthStore()

onMounted(async () => {
  if (auth.token) {
    try {
      await auth.fetchMe()
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
