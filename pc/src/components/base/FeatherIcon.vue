<!--
@doc
name: FeatherIcon
path: src/components/base/FeatherIcon.vue
category: base
purpose: 羽毛内联 SVG 图标（不引图标库）
appliesTo: 通用
props: size:Number=20
events: 无
example: <FeatherIcon :size="28" />
-->
<script setup>
defineProps({ size: { type: Number, default: 20 } })
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M20.2 3.8c-3 0-8 1.5-11 5.5C6 13 5 17 5 19l3-1c2-3 4-6 8-8" />
    <path d="M5 19c2-4 5-7 9-9" />
    <path d="M19 5l-7 7" />
  </svg>
</template>
