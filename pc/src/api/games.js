import api from './request.js'

export function getCatalog() {
  return api.get('/games')
}

export function getSave(gameKey) {
  return api.get(`/games/${gameKey}/save`)
}

export function saveGame(gameKey, { state, score, platform }) {
  return api.put(`/games/${gameKey}/save`, { state, score, platform })
}

export function clearSave(gameKey) {
  return api.delete(`/games/${gameKey}/save`)
}

export function getHistory(gameKey, { page = 1, pageSize = 20 } = {}) {
  return api.get(`/games/${gameKey}/records`, { params: { page, pageSize } })
}

export function submitRecord(gameKey, { result, platform }) {
  return api.post(`/games/${gameKey}/records`, { result, platform })
}

export function getLeaderboard(gameKey, { page = 1, pageSize = 20 } = {}) {
  return api.get(`/games/${gameKey}/leaderboard`, { params: { page, pageSize } })
}
