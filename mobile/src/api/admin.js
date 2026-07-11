import api from './request.js'

export function listUsers(params = {}) {
  return api.get('/admin/users', { params })
}

export function updateRole(id, role) {
  return api.patch(`/admin/users/${id}`, { role })
}
