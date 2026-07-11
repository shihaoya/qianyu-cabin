<script setup>
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import BaseCard from '../components/base/BaseCard.vue'
import GameArea from '../components/GameArea.vue'
import CabinLogo from '../components/base/CabinLogo.vue'
import BaseButton from '../components/base/BaseButton.vue'
import BottomNav from '../components/BottomNav.vue'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const games = [
  { id: 'climb', name: '千羽爬树', icon: 'climb' },
]

function onPlay(game) {
  if (!auth.isLoggedIn) {
    router.push('/login')
    return
  }
  window.alert(`${game.name} 功能开发中~`)
}
</script>

<template>
  <div class="home">
    <header class="home__header">
      <div class="home__brand">
        <CabinLogo :size="30" />
        <span>千羽的小屋</span>
      </div>
      <BaseButton v-if="!auth.isLoggedIn" type="primary" @click="router.push('/login')">
        登录
      </BaseButton>
      <span v-else class="home__nick">{{ auth.user?.nickname }}</span>
    </header>

    <main class="home__main">
      <BaseCard title="游戏区">
        <GameArea :games="games" @select="onPlay" />
      </BaseCard>
    </main>

    <BottomNav :active="route.name" />
  </div>
</template>

<style scoped>
.home {
  padding: 0 16px 80px;
}
.home__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 0;
}
.home__brand {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  color: var(--text);
}
.home__nick {
  color: var(--muted);
}
.home__main {
  margin-top: 12px;
}
</style>
