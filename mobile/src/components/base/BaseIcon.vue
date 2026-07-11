<!--
@doc
name: BaseIcon
path: src/components/base/BaseIcon.vue
category: base
purpose: 通用内联 SVG 图标：name 调用内置 feather 风图标，或 paths 传入自定义 path 直接绘制
appliesTo: mobile
props: name(String), paths(String|Array), size(Number=24), color(String='currentColor'), strokeWidth(Number=1.8), viewBox(String='0 0 24 24'), fill(String='none')
events: 无
example: <BaseIcon name="home" /> / <BaseIcon :paths="['M3 9l9-7 9 7']" :size="32" color="var(--primary)" />
-->
<script setup>
import { computed } from 'vue'
import { ICONS } from './icons.js'

const props = defineProps({
  name: { type: String, default: '' },
  paths: { type: [String, Array], default: () => [] },
  size: { type: [Number, String], default: 24 },
  color: { type: String, default: 'currentColor' },
  strokeWidth: { type: [Number, String], default: 1.8 },
  viewBox: { type: String, default: '0 0 24 24' },
  fill: { type: String, default: 'none' },
})

const renderPaths = computed(() => {
  if (props.paths && (Array.isArray(props.paths) ? props.paths.length : String(props.paths).trim())) {
    return Array.isArray(props.paths)
      ? props.paths
      : String(props.paths).split('\n').map((s) => s.trim()).filter(Boolean)
  }
  return ICONS[props.name] || []
})
</script>

<template>
  <svg
    :width="size"
    :height="size"
    :viewBox="viewBox"
    :fill="fill"
    :stroke="color"
    :stroke-width="strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path v-for="(d, i) in renderPaths" :key="i" :d="d" />
  </svg>
</template>

<style scoped>
svg {
  display: inline-block;
  vertical-align: middle;
}
</style>
