import { ref } from 'vue'
import * as gamesApi from '../api/games.js'

// 平台标识：移动端固定为 'mobile'（属展示项，非安全）
const PLATFORM = 'mobile'

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

export function submitGameRecord(gameKey, result) {
  return gamesApi.submitRecord(gameKey, { result, platform: PLATFORM })
}
