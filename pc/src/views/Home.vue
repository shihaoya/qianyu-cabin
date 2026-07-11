<script setup>
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import BaseCard from '../components/base/BaseCard.vue'
import GameArea from '../components/GameArea.vue'
import CabinLogo from '../components/base/CabinLogo.vue'
import BaseButton from '../components/base/BaseButton.vue'

const router = useRouter()
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
        <CabinLogo :size="34" />
        <span>千羽的小屋</span>
      </div>
      <div class="home__user">
        <template v-if="auth.isLoggedIn">
          <span class="home__nick">{{ auth.user?.nickname }}</span>
          <BaseButton type="text" @click="auth.logout()">退出</BaseButton>
        </template>
        <BaseButton v-else type="primary" @click="router.push('/login')">登录</BaseButton>
      </div>
    </header>

    <main class="home__main">
      <BaseCard title="游戏区">
        <GameArea :games="games" @select="onPlay" />
      </BaseCard>
    </main>
  </div>
</template>

<style scoped>
.home {
  max-width: 1080px;
  margin: 0 auto;
  padding: 0 20px 40px;
}
.home__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 0;
}
.home__brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 20px;
  font-weight: 700;
  color: var(--text);
}
.home__user {
  display: flex;
  align-items: center;
  gap: 10px;
}
.home__nick {
  color: var(--muted);
}
.home__main {
  margin-top: 20px;
}
</style>
