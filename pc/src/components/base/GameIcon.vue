<!--
@doc
name: GameIcon
path: src/components/base/GameIcon.vue
category: base
purpose: 按 type 渲染游戏图标（内联 SVG，便于扩展新游戏）
appliesTo: PC
props: type(String, 必填), size(Number=56)
events: 无
example: <GameIcon type="climb" :size="56" />
-->
<script setup>
defineProps({
  type: { type: String, required: true },
  size: { type: Number, default: 56 },
})
</script>

<template>
  <svg
    class="game-icon"
    :style="{ width: size + 'px', height: size + 'px' }"
    viewBox="0 0 200 200"
    fill="none"
    aria-hidden="true"
  >
    <template v-if="type === 'climb'">
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
    </template>
    <!-- 后续新游戏：在此追加 v-else-if="type === 'xxx'" 分支 -->
  </svg>
</template>

<style scoped>
.game-icon {
  display: block;
}
</style>
