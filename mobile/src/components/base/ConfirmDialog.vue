<script setup>
import { useConfirm } from '../../composables/useConfirm.js'

const { isOpen, mode, title, message, confirmText, cancelText, onOk, onCancel } = useConfirm()
</script>

<template>
  <transition name="cd-fade">
    <div v-if="isOpen" class="cd-mask" @click.self="onCancel">
      <div class="cd-box" role="dialog" aria-modal="true">
        <h3 class="cd-title">{{ title }}</h3>
        <p v-if="message" class="cd-msg">{{ message }}</p>
        <div class="cd-actions">
          <button v-if="mode === 'confirm'" type="button" class="cd-btn cd-cancel" @click="onCancel">
            {{ cancelText }}
          </button>
          <button type="button" class="cd-btn cd-ok" @click="onOk">{{ confirmText }}</button>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.cd-mask {
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
.cd-box {
  width: min(88vw, 320px);
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: 0 20px 50px rgba(90, 60, 30, 0.3);
  padding: 22px 20px 16px;
  text-align: center;
}
.cd-title {
  margin: 0 0 8px;
  font-family: var(--font-display);
  font-size: 17px;
  color: var(--text);
}
.cd-msg {
  margin: 0 0 18px;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
}
.cd-actions {
  display: flex;
  gap: 12px;
}
.cd-btn {
  flex: 1;
  padding: 10px 0;
  border-radius: var(--radius);
  border: 1px solid transparent;
  font: inherit;
  font-size: 14px;
  cursor: pointer;
  transition: filter 0.15s ease, background 0.15s ease;
}
.cd-cancel {
  background: var(--bg);
  border-color: var(--primary-soft);
  color: var(--text);
}
.cd-ok {
  background: var(--primary);
  color: #fff;
}
.cd-ok:hover {
  filter: brightness(1.05);
}
.cd-cancel:hover {
  filter: brightness(0.97);
}
.cd-btn:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}
.cd-fade-enter-active,
.cd-fade-leave-active {
  transition: opacity 0.18s ease;
}
.cd-fade-enter-from,
.cd-fade-leave-to {
  opacity: 0;
}
</style>
