import { ref } from 'vue'

// 全局单例的确认/提示弹窗状态，组件与调用方共享同一份
const isOpen = ref(false)
const mode = ref('confirm') // 'confirm' | 'alert'
const title = ref('提示')
const message = ref('')
const confirmText = ref('确定')
const cancelText = ref('取消')
let resolver = null

function open(options = {}, m) {
  mode.value = m
  title.value = options.title || '提示'
  message.value = options.message || options.text || ''
  confirmText.value = options.confirmText || (m === 'alert' ? '知道了' : '确定')
  cancelText.value = options.cancelText || '取消'
  isOpen.value = true
  return new Promise((resolve) => {
    resolver = resolve
  })
}

function close(val) {
  isOpen.value = false
  const r = resolver
  resolver = null
  if (r) r(val)
}

// 命名导出，调用方直接 import { confirm } / { alert }
export function confirm(options) {
  return open(options, 'confirm')
}

export function alert(options) {
  return open(options, 'alert')
}

// 组件用：取响应式状态与按钮回调
export function useConfirm() {
  function onOk() {
    close(true)
  }
  function onCancel() {
    close(false)
  }
  return { isOpen, mode, title, message, confirmText, cancelText, onOk, onCancel }
}
