<!--
@doc
name: BaseButton
path: src/components/base/BaseButton.vue
category: base
purpose: 统一按钮样式与交互（移动端默认更大触控区）
appliesTo: 通用
props: type:'primary'|'default'|'text'=default; loading:Boolean=false; disabled:Boolean=false; size:'md'|'lg'='md'
events: click
example: <BaseButton type="primary" size="lg" :loading="submitting" @click="onSubmit">登录</BaseButton>
-->
<script setup>
defineProps({
  type: { type: String, default: 'default' },
  loading: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  size: { type: String, default: 'md' },
})
</script>

<template>
  <button
    class="base-btn"
    :class="[`base-btn--${type}`, `base-btn--${size}`, { 'is-loading': loading, 'is-disabled': disabled }]"
    :disabled="disabled || loading"
  >
    <span v-if="loading" class="base-btn__spinner" />
    <slot />
  </button>
</template>

<style scoped>
.base-btn {
  font: inherit;
  border: none;
  border-radius: var(--radius);
  padding: 12px 20px;
  min-height: 44px;
  cursor: pointer;
  transition: filter 0.15s ease, transform 0.05s ease;
  background: var(--primary-soft);
  color: var(--text);
}
.base-btn--lg {
  padding: 14px 24px;
  font-size: 16px;
}
.base-btn--primary {
  background: var(--primary);
  color: #fff;
}
.base-btn--text {
  background: transparent;
  color: var(--primary);
  padding: 8px 10px;
  min-height: 0;
}
.base-btn.is-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.base-btn:not(.is-disabled):hover {
  filter: brightness(0.96);
}
.base-btn:not(.is-disabled):active {
  transform: translateY(1px);
}
.base-btn__spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  margin-right: 6px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
  vertical-align: -2px;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
