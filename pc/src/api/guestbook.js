import api from './request.js'

export function list() {
  return api.get('/guestbook')
}

export function create({ content, anonymous }) {
  return api.post('/guestbook', { content, anonymous })
}

export function remove(id) {
  return api.delete('/guestbook/' + id)
}
