<!--
@doc
name: GameIcon
path: src/components/base/GameIcon.vue
category: base
purpose: 按 type 渲染手绘风图标（内联 SVG，暖色配色）：游戏 climb、留言板 message、用户管理 users，便于扩展
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
    <template v-else-if="type === 'message'">
      <rect x="46" y="56" width="108" height="72" rx="20" fill="var(--accent)" opacity="0.85" />
      <path d="M72 128 l0 22 24 -18Z" fill="var(--accent)" opacity="0.85" />
      <path d="M68 88 h64 M68 104 h46" stroke="#fff" stroke-width="7" stroke-linecap="round" />
    </template>
    <template v-else-if="type === 'users'">
      <circle cx="130" cy="80" r="20" fill="var(--accent)" opacity="0.6" />
      <path d="M106 132 a24 20 0 0 1 48 0Z" fill="var(--accent)" opacity="0.6" />
      <circle cx="74" cy="90" r="24" fill="var(--primary)" />
      <path d="M50 142 a24 24 0 0 1 48 0Z" fill="var(--primary)" />
    </template>
    <!-- 后续新游戏/功能：在此追加 v-else-if="type === 'xxx'" 分支 -->
  </svg>
</template>

<style scoped>
.game-icon {
  display: block;
}
</style>
