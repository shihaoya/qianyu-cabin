// 通用分页 composable：管理页码、列表数据、总数、加载状态
// 用法：const pager = usePagination(fetchFn, { pageSize: 10 })
//       await pager.load(1) / pager.next() / pager.prev()
import { ref, computed } from 'vue'

export function usePagination(fetchFn, { pageSize = 10, initialPage = 1 } = {}) {
  const list = ref([])
  const total = ref(0)
  const page = ref(initialPage)
  const loading = ref(false)
  const error = ref('')

  async function load(p = page.value, ...extraArgs) {
    loading.value = true
    error.value = ''
    try {
      const data = await fetchFn({ page: p, pageSize, ...extraArgs[0] })
      list.value = data.list || []
      total.value = data.total || 0
      page.value = data.page || p
      return data
    } catch (e) {
      error.value = e.message || '加载失败'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function next(...args) {
    if (page.value >= totalPages.value) return
    await load(page.value + 1, ...args)
  }

  async function prev(...args) {
    if (page.value <= 1) return
    await load(page.value - 1, ...args)
  }

  async function reload(...args) {
    await load(1, ...args)
  }

  const totalPages = computed(() => Math.ceil(total.value / pageSize))

  return {
    list,
    total,
    page,
    loading,
    error,
    totalPages,
    load,
    next,
    prev,
    reload,
  }
}
