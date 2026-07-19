import { ref } from 'vue'

// 每个「弹框实例」拥有完全独立的状态，互不干扰。
// 全局单例只是其中一个实例；飞鸟游戏会创建自己的实例挂在旋转后的 DOM 子树内，
// 从而随游戏一起横过来，且不影响其它页面/游戏的弹框（彻底隔离，无共享全局状态）。
function createConfirmScope() {
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

  return {
    isOpen,
    mode,
    title,
    message,
    confirmText,
    cancelText,
    open,
    close,
    confirm: (options) => open(options, 'confirm'),
    alert: (options) => open(options, 'alert'),
  }
}

// 全局默认实例：普通页面/游戏（如爬树）直接 import { confirm, alert } 使用
const globalScope = createConfirmScope()

export function confirm(options) {
  return globalScope.confirm(options)
}
export function alert(options) {
  return globalScope.alert(options)
}

// 组件用：传入某个 scope 渲染对应的弹框。不传（或传 null）则渲染全局实例。
export function useConfirm(scope) {
  const s = scope || globalScope
  function onOk() {
    s.close(true)
  }
  function onCancel() {
    s.close(false)
  }
  return {
    scope: s,
    isOpen: s.isOpen,
    mode: s.mode,
    title: s.title,
    message: s.message,
    confirmText: s.confirmText,
    cancelText: s.cancelText,
    onOk,
    onCancel,
  }
}

// 供需要「独立、随自身 DOM 旋转」的页面（如飞鸟游戏）创建专属实例
export { createConfirmScope }
