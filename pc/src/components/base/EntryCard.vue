<!--
@doc
name: EntryCard
path: src/components/base/EntryCard.vue
category: base
purpose: 通用入口卡片：圆形手绘图标 + 标题 + 描述 + 箭头。有 to 时渲染 RouterLink，否则渲染 button 并 emit select。游戏区与互动区共用，保证风格一致
appliesTo: 通用
props: to([String,Object], 可选), icon(String, 必填), iconSize(Number=30), title(String, 必填), desc(String=''), arrow(Boolean=true)
events: select
example: <EntryCard icon="message" title="留言板" desc="写句话给小屋" :to="{ name: 'guestbook' }" />
-->
<script setup>
import { RouterLink } from 'vue-router'
import GameIcon from './GameIcon.vue'

const props = defineProps({
  to: { type: [String, Object], default: null },
  icon: { type: String, required: true },
  iconSize: { type: Number, default: 30 },
  title: { type: String, required: true },
  desc: { type: String, default: '' },
  arrow: { type: Boolean, default: true },
})
const emit = defineEmits(['select'])

function handleClick() {
  if (!props.to) emit('select')
}
</script>

<template>
  <component
    :is="to ? RouterLink : 'button'"
    :to="to || undefined"
    :type="to ? undefined : 'button'"
    class="entry-card"
    @click="handleClick"
  >
    <span class="entry-card__icon"><GameIcon :type="icon" :size="iconSize" /></span>
    <span class="entry-card__body">
      <span class="entry-card__title">{{ title }}</span>
      <span v-if="desc" class="entry-card__desc">{{ desc }}</span>
    </span>
    <span v-if="arrow" class="entry-card__arrow" aria-hidden="true">›</span>
  </component>
</template>

<style scoped>
.entry-card {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  padding: 14px 18px;
  background: var(--surface);
  border: 1px solid transparent;
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  text-decoration: none;
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
}
.entry-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 6px 16px rgba(91, 140, 123, 0.18);
  border-color: var(--primary);
}
.entry-card:active {
  transform: translateY(1px);
  box-shadow: var(--shadow);
}
.entry-card:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}
.entry-card__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  flex-shrink: 0;
  border-radius: 50%;
  background: rgba(91, 140, 123, 0.14);
}
.entry-card__body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}
.entry-card__title {
  font-size: 16px;
  font-weight: 600;
}
.entry-card__desc {
  font-size: 13px;
  color: var(--muted);
  line-height: 1.5;
}
.entry-card__arrow {
  font-size: 24px;
  color: var(--muted);
  line-height: 1;
  flex-shrink: 0;
}
</style>
