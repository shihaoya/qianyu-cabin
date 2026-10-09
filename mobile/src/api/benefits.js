import api from './request.js'

// 福利类型
export function listBenefitTypes() {
  return api.get('/benefit-types')
}

export function createBenefitType(data) {
  return api.post('/benefit-types', data)
}

export function updateBenefitType(id, data) {
  return api.patch(`/benefit-types/${id}`, data)
}

export function deleteBenefitType(id) {
  return api.delete(`/benefit-types/${id}`)
}

// 我的福利：当前登录账号自己的卡（按 userId 反查粉丝档案）
export function getMyBenefits() {
  return api.get('/me/benefits')
}

// 常用理由（增减卡时一键带入）
export function listReasons() {
  return api.get('/benefit-reasons')
}

export function createReason(data) {
  return api.post('/benefit-reasons', data)
}

export function updateReason(id, data) {
  return api.patch(`/benefit-reasons/${id}`, data)
}

export function deleteReason(id) {
  return api.delete(`/benefit-reasons/${id}`)
}

// 粉丝
export function listFans(params = {}) {
  return api.get('/fans', { params })
}

export function createFan(data) {
  return api.post('/fans', data)
}

export function updateFan(id, data) {
  return api.patch(`/fans/${id}`, data)
}

export function deleteFan(id) {
  return api.delete(`/fans/${id}`)
}

export function getFanCards(fanId) {
  return api.get(`/fans/${fanId}/cards`)
}

// delta 为带符号整数：正数增加、负数减少；reason 必填
export function adjustFanCard(fanId, data) {
  return api.post(`/fans/${fanId}/cards/adjust`, data)
}

export function getFanLogs(fanId, { page = 1, pageSize = 20 } = {}) {
  return api.get(`/fans/${fanId}/logs`, { params: { page, pageSize } })
}
