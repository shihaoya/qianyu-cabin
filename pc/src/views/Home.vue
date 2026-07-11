<script setup>
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import BaseCard from '../components/base/BaseCard.vue'
import GameArea from '../components/GameArea.vue'
import CabinScene from '../components/base/CabinScene.vue'
import AppHeader from '../components/base/AppHeader.vue'
import BaseButton from '../components/base/BaseButton.vue'
import EntryCard from '../components/base/EntryCard.vue'

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
    <AppHeader />

    <main class="home__main">
      <section class="hero qy-rise" style="animation-delay:.06s">
        <div class="hero__text">
          <p class="hero__eyebrow">欢迎光临 · cozy little cabin</p>
          <h1 class="hero__title">千羽的小屋</h1>
          <p class="hero__sub">
            一间手作的小木屋，藏着游戏、闲聊和慢慢长出的故事。<br />
            进来坐坐吧～
          </p>
          <div class="hero__actions">
            <BaseButton
              v-if="!auth.isLoggedIn"
              type="primary"
              @click="router.push('/login')"
            >
              登录小屋
            </BaseButton>
            <span v-else class="hero__welcome">很高兴见到你，{{ auth.user?.nickname }}</span>
          </div>
        </div>
        <div class="hero__art">
          <CabinScene />
        </div>
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
          <EntryCard
            v-if="auth.isAdmin"
            icon="users"
            title="用户管理"
            desc="查看与设置成员角色"
            :to="{ name: 'admin-users' }"
          />
        </div>
      </section>

      <section class="block qy-rise" style="animation-delay:.18s">
        <BaseCard>
          <div class="about">
            <h2 class="block__title">关于小屋</h2>
            <p class="about__text">
              千羽的专属角落。没有繁琐的界面，只有奶油色的墙、陶土色的窗，和一盏总亮着的小灯。希望你能在这里放松一会儿。
            </p>
          </div>
        </BaseCard>
      </section>
    </main>

    <footer class="home__footer">千羽的小屋 · 用心慢慢搭起来的</footer>
  </div>
</template>

<style scoped>
.home {
  padding-bottom: 48px;
}
.home__main {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

.hero {
  position: relative;
  display: grid;
  grid-template-columns: 1.1fr .9fr;
  align-items: center;
  gap: 28px;
  margin-top: 28px;
  padding: 38px 40px;
  border-radius: calc(var(--radius) + 6px);
  background: var(--grad-hero);
  box-shadow: var(--shadow);
  overflow: hidden;
}
.hero::after {
  content: "";
  position: absolute;
  right: -40px;
  top: -40px;
  width: 200px;
  height: 200px;
  background: radial-gradient(circle, rgba(201, 116, 59, .18) 2px, transparent 3px) 0 0 / 22px 22px;
  opacity: .55;
  pointer-events: none;
}
.hero__eyebrow {
  margin: 0 0 8px;
  font-size: 13px;
  letter-spacing: 1px;
  color: var(--primary);
}
.hero__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 52px;
  line-height: 1.1;
  color: var(--text);
}
.hero__sub {
  margin: 14px 0 22px;
  color: var(--muted);
  font-size: 15px;
  line-height: 1.8;
}
.hero__actions {
  display: flex;
  align-items: center;
  gap: 12px;
}
.hero__welcome {
  color: var(--accent);
  font-weight: 600;
}
.hero__art {
  display: flex;
  justify-content: center;
  width: 260px;
  margin-left: auto;
}

.block {
  margin-top: 36px;
}
.block__head {
  margin-bottom: 14px;
}
.block__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 26px;
  color: var(--text);
}
.block__sub {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 14px;
}
.block__hint {
  margin: 14px 2px 0;
  color: var(--muted);
  font-size: 13px;
}
.interact {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.about__text {
  margin: 10px 0 0;
  color: var(--text);
  line-height: 1.9;
  font-size: 15px;
}

.home__footer {
  margin-top: 48px;
  text-align: center;
  color: var(--muted);
  font-size: 13px;
}

@media (max-width: 720px) {
  .hero {
    grid-template-columns: 1fr;
    text-align: center;
    padding: 28px 22px;
  }
  .hero__art {
    order: -1;
    margin: 0 auto;
  }
  .hero__actions {
    justify-content: center;
  }
  .hero__title {
    font-size: 40px;
  }
}
</style>
