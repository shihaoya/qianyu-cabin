<script setup>
import { useRouter } from 'vue-router'
import AppHeader from '../components/base/AppHeader.vue'
import BaseButton from '../components/base/BaseButton.vue'

const router = useRouter()
</script>

<template>
  <div class="notfound">
    <AppHeader />
    <main class="notfound__main">
      <div class="notfound__card">
        <p class="notfound__code">404</p>
        <h1 class="notfound__title">哎呀，页面走丢了</h1>
        <p class="notfound__sub">这条小路好像还没有铺好，回小屋坐坐吧～</p>
        <BaseButton type="primary" @click="router.push({ name: 'home' })">
          返回首页
        </BaseButton>
      </div>
    </main>
  </div>
</template>

<style scoped>
.notfound {
  min-height: 100vh;
}
.notfound__main {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - 64px);
  padding: 20px;
}
.notfound__card {
  text-align: center;
  background: var(--surface);
  border-radius: calc(var(--radius) + 6px);
  box-shadow: var(--shadow);
  padding: 56px 48px;
  max-width: 440px;
}
.notfound__code {
  margin: 0;
  font-family: var(--font-display);
  font-size: 88px;
  line-height: 1;
  color: var(--primary);
}
.notfound__title {
  margin: 12px 0 8px;
  font-family: var(--font-display);
  font-size: 28px;
  color: var(--text);
}
.notfound__sub {
  margin: 0 0 24px;
  color: var(--muted);
  font-size: 15px;
}
</style>
