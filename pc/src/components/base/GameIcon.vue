<!--
@doc
name: GameIcon
path: src/components/base/GameIcon.vue
category: base
purpose: 按 type 渲染手绘风图标（内联 SVG，暖色配色）：游戏 climb/fly、留言板 message、用户管理 users，便于扩展
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
    <template v-else-if="type === 'fly'">
      <!-- 像素鸟：可爱小鸟 + 绿管道，呼应玩法 -->
      <g opacity="0.92">
        <rect x="150" y="4" width="38" height="66" rx="6" fill="var(--accent)" />
        <rect x="142" y="62" width="54" height="14" rx="4" fill="#4a7565" />
        <rect x="150" y="140" width="38" height="58" rx="6" fill="var(--accent)" />
        <rect x="142" y="134" width="54" height="14" rx="4" fill="#4a7565" />
      </g>
      <ellipse cx="86" cy="104" rx="46" ry="40" fill="var(--primary)" />
      <ellipse cx="82" cy="120" rx="33" ry="22" fill="#f7d9a8" opacity="0.92" />
      <path d="M56 102 q-26 4 -30 28 q22 4 36 -14Z" fill="var(--accent)" opacity="0.95" />
      <circle cx="106" cy="90" r="13" fill="#fff" />
      <circle cx="110" cy="91" r="6" fill="#2b2b2b" />
      <path d="M124 92 l28 8 -28 12Z" fill="#e0a23b" />
      <path d="M78 64 q4 -16 18 -18" stroke="var(--primary)" stroke-width="5" fill="none" stroke-linecap="round" />
    </template>
    <!-- 后续新游戏/功能：在此追加 v-else-if="type === 'xxx'" 分支 -->
  </svg>
</template>

<style scoped>
.game-icon {
  display: block;
}
</style>
