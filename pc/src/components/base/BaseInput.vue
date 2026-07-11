<!--
@doc
name: BaseInput
path: src/components/base/BaseInput.vue
category: base
purpose: 带标签/错误态的文本输入
appliesTo: 通用
props: modelValue:String=''; label:String=''; error:String=''; type:String='text'
events: update:modelValue
example: <BaseInput v-model="nick" label="昵称" :error="errMsg" />
-->
<script setup>
defineProps({
  modelValue: { type: String, default: '' },
  label: { type: String, default: '' },
  error: { type: String, default: '' },
  type: { type: String, default: 'text' },
})
defineEmits(['update:modelValue'])
</script>

<template>
  <label class="base-input">
    <span v-if="label" class="base-input__label">{{ label }}</span>
    <input
      class="base-input__field"
      :class="{ 'has-error': error }"
      :type="type"
      :value="modelValue"
      @input="$emit('update:modelValue', $event.target.value)"
    />
    <span v-if="error" class="base-input__error">{{ error }}</span>
  </label>
</template>

<style scoped>
.base-input {
  display: block;
}
.base-input__label {
  display: block;
  margin-bottom: 6px;
  color: var(--muted);
  font-size: 14px;
}
.base-input__field {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  border: 1px solid var(--primary-soft);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--text);
  font: inherit;
}
.base-input__field.has-error {
  border-color: #d9534f;
}
.base-input__error {
  display: block;
  margin-top: 4px;
  color: #d9534f;
  font-size: 13px;
}
</style>
