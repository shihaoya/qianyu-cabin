import api from './request.js'

// 抽奖礼品
export function listPrizes() {
  return api.get('/raffles/prizes')
}

export function createPrize(data) {
  return api.post('/raffles/prizes', data)
}

export function updatePrize(id, data) {
  return api.patch(`/raffles/prizes/${id}`, data)
}

export function deletePrize(id) {
  return api.delete(`/raffles/prizes/${id}`)
}

// 抽奖：count 次连抽，可选 fanId 指定抽奖粉丝（粉丝是福利管理里的档案，不是用户账号）
export function drawRaffle({ count = 1, fanId = null } = {}) {
  return api.post('/raffles/draw', { count, fanId })
}

// 抽奖记录：可按 prizeId / fanId / keyword（粉丝昵称模糊） / drawnBy 过滤
export function listRaffleRecords({ page = 1, pageSize = 20, prizeId = null, fanId = null, keyword = '', drawnBy = '' } = {}) {
  return api.get('/raffles/records', { params: { page, pageSize, prizeId, fanId, keyword, drawnBy } })
}

// 粉丝自助抽奖：通过绑定的站内账号反查粉丝档案
export function selfDraw({ count = 1 } = {}) {
  return api.post('/raffles/self-draw', { count })
}

// 粉丝自助抽奖的历史记录（只含自己抽的）
export function listSelfDrawRecords({ page = 1, pageSize = 20 } = {}) {
  return api.get('/raffles/self-draw-records', { params: { page, pageSize } })
}
