<script setup>
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import GameArea from '../components/GameArea.vue'
import CabinLogo from '../components/base/CabinLogo.vue'
import CabinScene from '../components/base/CabinScene.vue'
import BaseButton from '../components/base/BaseButton.vue'
import EntryCard from '../components/base/EntryCard.vue'
import { alert } from '../composables/useConfirm.js'

const router = useRouter()
const auth = useAuthStore()

const games = [
  { id: 'climb', name: '千羽爬树', icon: 'climb' },
]

async function onPlay(game) {
  if (!auth.isLoggedIn) {
    router.push('/login')
    return
  }
  await alert({ title: '提示', message: `${game.name} 功能开发中~` })
}
</script>

<template>
  <div class="home">
    <header class="home__header qy-rise">
      <div class="home__brand">
        <CabinLogo :size="28" />
        <span class="home__brand-name">千羽的小屋</span>
      </div>
      <BaseButton v-if="!auth.isLoggedIn" type="primary" @click="router.push('/login')">
        登录
      </BaseButton>
      <span v-else class="home__nick">{{ auth.user?.nickname }}</span>
    </header>

    <main class="home__main">
      <section class="hero qy-rise" style="animation-delay:.06s">
        <div class="hero__art"><CabinScene /></div>
        <h1 class="hero__title">千羽的小屋</h1>
        <p class="hero__sub">一间手作的小木屋，藏着游戏和慢慢长出的故事。</p>
      </section>

      <section class="block qy-rise" style="animation-delay:.12s">
        <div class="block__head">
          <h2 class="block__title">游戏区</h2>
          <p class="block__sub">挑一个，进去坐坐</p>
        </div>
        <GameArea :games="games" @select="onPlay" />
        <p class="block__hint">更多小游戏正在搬进小屋…</p>
      </section>

      <section class="block qy-rise" style="animation-delay:.15s">
        <div class="block__head">
          <h2 class="block__title">互动区</h2>
          <p class="block__sub">来聊聊天，留个言</p>
        </div>
        <div class="interact">
          <EntryCard
            icon="message"
            title="留言板"
            desc="写句话给小屋，也能匿名留下"
            :to="{ name: 'guestbook' }"
          />
        </div>
      </section>

      <section v-if="auth.isAdmin" class="block qy-rise" style="animation-delay:.16s">
        <div class="block__head">
          <h2 class="block__title">管理区</h2>
          <p class="block__sub">只有你能看到的小屋后台</p>
        </div>
        <div class="interact">
          <EntryCard
            icon="users"
            title="用户管理"
            desc="查看与设置成员角色"
            :to="{ name: 'admin-users' }"
          />
        </div>
      </section>

      <section class="block qy-rise" style="animation-delay:.18s">
        <div class="about">
          <h2 class="block__title">关于小屋</h2>
          <p class="about__text">
            千羽的专属角落，奶油色的墙、陶土色的窗，和一盏总亮着的小灯。坐会儿吧～
          </p>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.home {
  padding: 0 16px 32px;
}
.home__header {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 -16px;
  padding: 14px 16px;
  background: rgba(247, 241, 227, 0.82);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border-bottom: 1px solid rgba(120, 90, 50, 0.08);
}
.home__brand {
  display: flex;
  align-items: center;
  gap: 8px;
}
.home__brand-name {
  font-family: var(--font-display);
  font-size: 20px;
  color: var(--text);
}
.home__nick {
  color: var(--muted);
  font-size: 14px;
}

.hero {
  margin-top: 16px;
  text-align: center;
  padding: 26px 20px;
  border-radius: calc(var(--radius) + 4px);
  background: var(--grad-hero);
  box-shadow: var(--shadow);
}
.hero__art {
  width: 180px;
  margin: 0 auto 8px;
}
.hero__art :deep(svg) {
  width: 100%;
  height: auto;
}
.hero__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 34px;
  color: var(--text);
}
.hero__sub {
  margin: 10px 0 0;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.7;
}

.block {
  margin-top: 26px;
}
.block__head {
  margin-bottom: 12px;
}
.block__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 22px;
  color: var(--text);
}
.block__sub {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 13px;
}
.block__hint {
  margin: 12px 2px 0;
  color: var(--muted);
  font-size: 12px;
}
.about {
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 18px;
}
.about__text {
  margin: 8px 0 0;
  color: var(--text);
  font-size: 14px;
  line-height: 1.9;
}

.interact {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
