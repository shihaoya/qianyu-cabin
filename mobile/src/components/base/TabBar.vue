<script setup>
import { useRoute, RouterLink } from 'vue-router'

const route = useRoute()
const tabs = [
  { name: 'home', label: '主页', to: '/' },
  { name: 'profile', label: '我的', to: '/profile' },
]
</script>

<template>
  <nav class="tabbar">
    <RouterLink
      v-for="t in tabs"
      :key="t.name"
      :to="t.to"
      class="tabbar__item"
      :class="{ 'is-active': route.name === t.name }"
    >
      <svg v-if="t.name === 'home'" class="tabbar__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M3 11.5 12 4l9 7.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M5.5 10v9.5h13V10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      <svg v-else class="tabbar__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="8" r="3.6" stroke="currentColor" stroke-width="2" />
        <path d="M5 20c0-3.6 3.1-5.5 7-5.5s7 1.9 7 5.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      </svg>
      <span class="tabbar__label">{{ t.label }}</span>
    </RouterLink>
  </nav>
</template>

<style scoped>
.tabbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 30;
  display: flex;
  background: rgba(255, 253, 248, 0.92);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-top: 1px solid rgba(120, 90, 50, 0.12);
  padding-bottom: env(safe-area-inset-bottom, 0);
}
.tabbar__item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 8px 0 6px;
  text-decoration: none;
  color: var(--muted);
  font-size: 12px;
  transition: color 0.15s ease;
}
.tabbar__item.is-active {
  color: var(--primary);
}
.tabbar__icon {
  width: 24px;
  height: 24px;
}
</style>
