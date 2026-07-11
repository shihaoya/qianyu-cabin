<!--
@doc
name: CabinLogo
path: src/components/base/CabinLogo.vue
category: base
purpose: 小屋 logo / 站点标识 SVG
appliesTo: 通用
props: size:Number=32
events: 无
example: <CabinLogo :size="36" />
-->
<script setup>
defineProps({ size: { type: Number, default: 32 } })
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 48 48" fill="none" aria-hidden="true">
    <path d="M24 8 6 20h36L24 8Z" fill="var(--primary)" />
    <rect x="12" y="20" width="24" height="20" rx="2" fill="var(--primary-soft)" />
    <rect x="20" y="28" width="8" height="12" rx="1" fill="var(--primary)" />
    <circle cx="33" cy="27" r="2.4" fill="var(--accent)" />
  </svg>
</template>
