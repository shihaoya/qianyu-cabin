<!--
@doc
name: AppHeader
path: src/components/base/AppHeader.vue
category: base
purpose: 移动端次级页顶部条（毛玻璃吸顶）：返回首页 + 品牌
appliesTo: 移动
props: 无
events: 无
example: <AppHeader />
-->
<script setup>
import { RouterLink } from 'vue-router'
import CabinLogo from './CabinLogo.vue'
</script>

<template>
  <header class="m-header">
    <RouterLink to="/" class="m-header__back" aria-label="返回首页">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
        <path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </RouterLink>
    <div class="m-header__brand">
      <CabinLogo :size="26" />
      <span class="m-header__name">千羽的小屋</span>
    </div>
  </header>
</template>

<style scoped>
.m-header {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  background: rgba(247, 241, 227, 0.82);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border-bottom: 1px solid rgba(120, 90, 50, 0.08);
}
.m-header__back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  margin-left: -8px;
  border-radius: 10px;
  color: var(--text);
  text-decoration: none;
}
.m-header__back:active {
  background: rgba(120, 90, 50, 0.08);
}
.m-header__brand {
  display: flex;
  align-items: center;
  gap: 8px;
}
.m-header__name {
  font-family: var(--font-display);
  font-size: 20px;
  color: var(--text);
}
</style>
