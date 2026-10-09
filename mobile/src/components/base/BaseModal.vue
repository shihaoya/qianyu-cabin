<!--
@doc
name: BaseModal
path: src/components/base/BaseModal.vue
category: base
purpose: 统一弹窗外壳：移动端默认底部弹层（sheet），也可切回居中弹窗；含标题区右上角关闭按钮、内容插槽与底部操作插槽，避免各页面重复写遮罩样式
appliesTo: 移动
props: title(String=''); width(String='480px'); sheet(Boolean=true)
events: close:void — 仅由右上角关闭按钮触发（点遮罩 / Esc 均不关闭）
example: <BaseModal title="编辑粉丝" @close="fanEditor = null"><BaseInput v-model="name" label="昵称" /><template #footer><BaseButton type="primary">保存</BaseButton></template></BaseModal>
-->
<script setup>
defineProps({
  title: { type: String, default: '' },
  width: { type: String, default: '480px' },
  sheet: { type: Boolean, default: true },
})
const emit = defineEmits(['close'])
</script>

<template>
  <!-- 遮罩本身不响应点击：避免误触关闭导致未保存内容丢失，只能点右上角 ✕ -->
  <div class="bm-wrap">
    <div
      class="bm-panel"
      :class="{ 'bm-panel--sheet': sheet }"
      :style="sheet ? null : { width: `min(92vw, ${width})` }"
      role="dialog"
      aria-modal="true"
    >
      <div
        v-if="sheet"
        class="bm-sheet__handle"
      />
      <div class="bm-head">
        <h3
          v-if="title"
          class="bm-title"
        >
          {{ title }}
        </h3>
        <button
          class="bm-close"
          type="button"
          title="关闭"
          aria-label="关闭"
          @click="emit('close')"
        >
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              stroke-width="2.2"
              stroke-linecap="round"
            />
          </svg>
        </button>
      </div>
      <div class="bm-body">
        <slot />
      </div>
      <div
        v-if="$slots.footer"
        class="bm-footer"
      >
        <slot name="footer" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.bm-wrap {
  position: fixed;
  inset: 0;
  background: rgba(60, 45, 30, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
  box-sizing: border-box;
}
.bm-panel {
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: 0 20px 50px rgba(90, 60, 30, 0.3);
  padding: 18px 16px 14px;
  max-height: 88vh;
  display: flex;
  flex-direction: column;
}
.bm-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}
.bm-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 19px;
  color: var(--text);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bm-close {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
}
.bm-close:active {
  background: rgba(201, 116, 59, 0.18);
  color: var(--primary);
}
.bm-close:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: -2px;
}
/* 内容区独立滚动，长列表（如持卡明细）不会把弹层撑出屏幕 */
.bm-body {
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}
.bm-footer {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 14px;
}

/* 默认形态：贴底滑出的弹层 */
.bm-panel--sheet {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  max-height: 86vh;
  border-radius: 18px 18px 0 0;
  padding: 10px 16px calc(18px + env(safe-area-inset-bottom));
  box-shadow: 0 -12px 40px rgba(90, 60, 30, 0.28);
}
.bm-sheet__handle {
  width: 38px;
  height: 4px;
  border-radius: 999px;
  background: var(--primary-soft);
  margin: 4px auto 14px;
}
</style>
