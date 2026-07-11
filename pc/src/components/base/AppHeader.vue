<!--
@doc
name: AppHeader
path: src/components/base/AppHeader.vue
category: base
purpose: 全站顶部导航（毛玻璃吸顶）：品牌 + 导航（首页/留言板/用户管理[仅开发者]）+ 用户区
appliesTo: PC
props: 无
events: 无
example: <AppHeader />
-->
<script setup>
import { useRouter, useRoute, RouterLink } from 'vue-router'
import { useAuthStore } from '../../stores/auth.js'
import CabinLogo from './CabinLogo.vue'
import BaseButton from './BaseButton.vue'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const nav = [
  { name: 'home', label: '首页' },
  { name: 'guestbook', label: '留言板' },
]

function isActive(name) {
  return route.name === name
}
</script>

<template>
  <header class="app-header">
    <div class="app-header__bar">
      <RouterLink to="/" class="app-header__brand">
        <CabinLogo :size="32" />
        <span class="app-header__name">千羽的小屋</span>
      </RouterLink>

      <nav class="app-header__nav">
        <RouterLink
          v-for="item in nav"
          :key="item.name"
          :to="{ name: item.name }"
          class="app-header__link"
          :class="{ 'is-active': isActive(item.name) }"
        >
          {{ item.label }}
        </RouterLink>
        <RouterLink
          v-if="auth.isAdmin"
          :to="{ name: 'admin-users' }"
          class="app-header__link"
          :class="{ 'is-active': isActive('admin-users') }"
        >
          用户管理
        </RouterLink>
      </nav>

      <div class="app-header__user">
        <template v-if="auth.isLoggedIn">
          <span class="app-header__nick">你好，{{ auth.user?.nickname }}</span>
          <BaseButton type="text" @click="auth.logout()">退出</BaseButton>
        </template>
        <BaseButton v-else type="primary" @click="router.push('/login')">登录</BaseButton>
      </div>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  position: sticky;
  top: 0;
  z-index: 20;
  background: rgba(255, 253, 248, 0.78);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(120, 90, 50, 0.10);
}
.app-header__bar {
  display: flex;
  align-items: center;
  gap: 20px;
  height: 64px;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}
.app-header__brand {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: var(--text);
}
.app-header__name {
  font-family: var(--font-display);
  font-size: 22px;
  letter-spacing: .5px;
}
.app-header__nav {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: 8px;
  flex: 1;
}
.app-header__link {
  padding: 6px 12px;
  border-radius: 10px;
  color: var(--muted);
  text-decoration: none;
  font-size: 15px;
  transition: color 0.15s ease, background 0.15s ease;
}
.app-header__link:hover {
  color: var(--primary);
  background: rgba(201, 116, 59, 0.08);
}
.app-header__link.is-active {
  color: var(--primary);
  font-weight: 600;
}
.app-header__user {
  display: flex;
  align-items: center;
  gap: 10px;
}
.app-header__nick {
  color: var(--muted);
  font-size: 14px;
}
</style>
