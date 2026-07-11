import { defineStore } from 'pinia'
import { login as apiLogin, register as apiRegister, me as apiMe } from '../api/auth.js'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('qianyu_token') || '',
    user: null,
  }),
  getters: {
    isLoggedIn: (state) => !!state.token,
    // 权限判断统一走 permissions.can()，见 src/permissions.js
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
      // 整页刷新回首页：彻底销毁当前页面组件实例与内存状态，
      // 避免退出后受保护内容（如管理区用户列表、昵称）残留展示。
      window.location.replace(import.meta.env.BASE_URL)
    },
  },
})
