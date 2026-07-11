<!--
@doc
name: GameArea
path: src/components/GameArea.vue
category: business
purpose: 主页游戏区容器（千羽爬树入口）
appliesTo: PC
props: 无
events: select
example: <GameArea @select="onPlay" />
-->
<script setup>
defineEmits(['select'])
</script>

<template>
  <div
    class="game-area"
    role="button"
    tabindex="0"
    @click="$emit('select')"
    @keyup.enter="$emit('select')"
  >
    <svg class="game-area__art" viewBox="0 0 200 200" fill="none" aria-hidden="true">
      <rect x="92" y="90" width="16" height="90" rx="4" fill="var(--primary)" />
      <circle cx="100" cy="70" r="46" fill="var(--accent)" opacity="0.85" />
      <circle cx="70" cy="86" r="30" fill="var(--accent)" opacity="0.7" />
      <circle cx="132" cy="86" r="30" fill="var(--accent)" opacity="0.7" />
      <g transform="translate(118 52)">
        <ellipse cx="0" cy="0" rx="14" ry="10" fill="var(--primary)" />
        <circle cx="10" cy="-6" r="7" fill="var(--primary)" />
        <path d="M17 -6 l8 -2 -6 5Z" fill="var(--accent)" />
        <circle cx="12" cy="-7" r="1.6" fill="#fff" />
      </g>
    </svg>
    <p class="game-area__title">千羽爬树</p>
    <p class="game-area__hint">点击进入游戏</p>
  </div>
</template>

<style scoped>
.game-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  padding: 24px;
  border-radius: var(--radius);
  background: var(--bg);
  transition: transform 0.15s ease;
}
.game-area:hover {
  transform: translateY(-3px);
}
.game-area__art {
  width: 160px;
  height: 160px;
}
.game-area__title {
  margin: 8px 0 0;
  color: var(--text);
  font-size: 18px;
  font-weight: 600;
}
.game-area__hint {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
}
</style>
