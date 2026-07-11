import api from './request.js'

export function register(nickname, password) {
  return api.post('/auth/register', { nickname, password })
}

export function login(nickname, password) {
  return api.post('/auth/login', { nickname, password })
}

export function me() {
  return api.get('/auth/me')
}

export function changePassword(currentPassword, newPassword) {
  return api.post('/auth/change-password', { currentPassword, newPassword })
}
