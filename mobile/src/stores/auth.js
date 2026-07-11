import { defineStore } from 'pinia'
import { login as apiLogin, register as apiRegister, me as apiMe } from '../api/auth.js'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('qianyu_token') || '',
    user: null,
  }),
  getters: {
    isLoggedIn: (state) => !!state.token,
  },
  actions: {
    async login(nickname, password) {
      const data = await apiLogin(nickname, password)
      this._setSession(data)
    },
    async register(nickname, password) {
      const data = await apiRegister(nickname, password)
      this._setSession(data)
    },
    async fetchMe() {
      const data = await apiMe()
      this.user = data.user
    },
    _setSession(data) {
      this.token = data.token
      this.user = data.user
      localStorage.setItem('qianyu_token', data.token)
    },
    logout() {
      this.token = ''
      this.user = null
      localStorage.removeItem('qianyu_token')
    },
  },
})
