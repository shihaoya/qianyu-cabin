import { ref } from 'vue'
import * as gamesApi from '../api/games.js'

// 平台标识：PC 端固定为 'pc'，移动端镜像文件改为 'mobile'（属展示项，非安全）
const PLATFORM = 'pc'

// 存档：加载 / 保存 / 清除（绑定当前登录用户，跨端通用）
export function useGameSave(gameKey) {
  const saveState = ref(null)
  async function load() {
    saveState.value = await gamesApi.getSave(gameKey)
    return saveState.value
  }
  async function save(state, score) {
    await gamesApi.saveGame(gameKey, { state, score, platform: PLATFORM })
  }
  async function clear() {
    await gamesApi.clearSave(gameKey)
    saveState.value = null
  }
  return { saveState, load, save, clear }
}

// 排行榜（游戏内展示，需登录）
export function useGameLeaderboard(gameKey) {
  const list = ref([])
  const total = ref(0)
  async function load(page = 1, pageSize = 20) {
    const data = await gamesApi.getLeaderboard(gameKey, { page, pageSize })
    list.value = data.list
    total.value = data.total
    return list.value
  }
  return { list, total, load }
}

// 我的历史
export function useGameHistory(gameKey) {
  const list = ref([])
  const total = ref(0)
  async function load(page = 1, pageSize = 20) {
    const data = await gamesApi.getHistory(gameKey, { page, pageSize })
    list.value = data.list
    total.value = data.total
    return list.value
  }
  return { list, total, load }
}

// 结束一局：上报结果（自动带平台、服务端算分并清存档）
export function submitGameRecord(gameKey, result) {
  return gamesApi.submitRecord(gameKey, { result, platform: PLATFORM })
}
