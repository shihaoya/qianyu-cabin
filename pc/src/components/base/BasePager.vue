<!--
@doc
name: BasePager
path: src/components/base/BasePager.vue
category: base
purpose: 通用分页控制条：上一页/下一页 + 页码信息，配合 usePagination 使用
appliesTo: 通用
props: page(Number=1), totalPages(Number=1), disabled(Boolean=false)
events: prev:void, next:void
example: <BasePager :page="pager.page.value" :total-pages="pager.totalPages.value" @prev="pager.prev" @next="pager.next" />
-->
<script setup>
defineProps({
  page: { type: Number, default: 1 },
  totalPages: { type: Number, default: 1 },
  disabled: { type: Boolean, default: false },
})
defineEmits(['prev', 'next'])
</script>

<template>
  <div
    v-if="totalPages > 1"
    class="base-pager"
  >
    <button
      type="button"
      :disabled="page <= 1 || disabled"
      @click="$emit('prev')"
    >
      上一页
    </button>
    <span class="base-pager__info">{{ page }} / {{ totalPages }}</span>
    <button
      type="button"
      :disabled="page >= totalPages || disabled"
      @click="$emit('next')"
    >
      下一页
    </button>
  </div>
</template>

<style scoped>
.base-pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--primary-soft);
}

.base-pager button {
  padding: 4px 12px;
  border: 1px solid var(--primary-soft);
  border-radius: 999px;
  background: var(--surface);
  font-size: 12px;
  color: var(--muted);
  cursor: pointer;
  transition: all .15s;
}

.base-pager button:hover:not(:disabled) {
  border-color: var(--primary);
  color: var(--primary);
}

.base-pager button:disabled {
  opacity: .5;
  cursor: not-allowed;
}

.base-pager__info {
  font-size: 12px;
  color: var(--muted);
}
</style>
