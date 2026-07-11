<script setup>
import { useRouter } from 'vue-router'
import BaseButton from '../components/base/BaseButton.vue'
import TabBar from '../components/base/TabBar.vue'

const router = useRouter()
</script>

<template>
  <div class="notfound">
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
    <TabBar />
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
  min-height: 100vh;
  padding: 20px 20px 84px;
}
.notfound__card {
  text-align: center;
  background: var(--surface);
  border-radius: calc(var(--radius) + 6px);
  box-shadow: var(--shadow);
  padding: 44px 32px;
  max-width: 360px;
  width: 100%;
}
.notfound__code {
  margin: 0;
  font-family: var(--font-display);
  font-size: 76px;
  line-height: 1;
  color: var(--primary);
}
.notfound__title {
  margin: 12px 0 8px;
  font-family: var(--font-display);
  font-size: 24px;
  color: var(--text);
}
.notfound__sub {
  margin: 0 0 22px;
  color: var(--muted);
  font-size: 14px;
}
</style>
