<!--
@doc
name: BottomNav
path: src/components/BottomNav.vue
category: business
purpose: 移动端底部 Tab 导航栏
appliesTo: 移动
props: active:String=''
events: 无
example: <BottomNav :active="route.name" />
-->
<script setup>
import { useRouter } from 'vue-router'

defineProps({ active: { type: String, default: '' } })
const router = useRouter()
const tabs = [{ name: 'home', label: '首页', to: '/' }]
</script>

<template>
  <nav class="bottom-nav">
    <button
      v-for="t in tabs"
      :key="t.name"
      class="bottom-nav__item"
      :class="{ 'is-active': active === t.name }"
      @click="router.push(t.to)"
    >
      {{ t.label }}
    </button>
  </nav>
</template>

<style scoped>
.bottom-nav {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  background: var(--surface);
  box-shadow: 0 -4px 16px rgba(120, 90, 50, 0.1);
  padding-bottom: env(safe-area-inset-bottom);
}
.bottom-nav__item {
  flex: 1;
  border: none;
  background: transparent;
  padding: 12px 0;
  font: inherit;
  color: var(--muted);
  cursor: pointer;
}
.bottom-nav__item.is-active {
  color: var(--primary);
  font-weight: 600;
}
</style>
