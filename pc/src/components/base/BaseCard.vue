<!--
@doc
name: BaseCard
path: src/components/base/BaseCard.vue
category: base
purpose: 卡片容器，统一圆角/阴影/内边距
appliesTo: 通用
props: title:String=''; hoverable:Boolean=false
events: 无
example: <BaseCard title="游戏区"><GameArea /></BaseCard>
-->
<script setup>
defineProps({
  title: { type: String, default: '' },
  hoverable: { type: Boolean, default: false },
})
</script>

<template>
  <section class="base-card" :class="{ 'is-hoverable': hoverable }">
    <h3 v-if="title" class="base-card__title">{{ title }}</h3>
    <slot />
  </section>
</template>

<style scoped>
.base-card {
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 20px;
}
.base-card.is-hoverable:hover {
  transform: translateY(-2px);
  transition: transform 0.15s ease;
}
.base-card__title {
  margin: 0 0 12px;
  color: var(--text);
  font-size: 18px;
}
</style>
