import { defineStore } from 'pinia'
import { login as apiLogin, register as apiRegister, me as apiMe } from '../api/auth.js'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('qianyu_token') || '',
    user: null,
    _userPromise: null,
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
    // 确保用户信息已加载：已登录但 user 为空时调 fetchMe()，
    // 并缓存 Promise 防止并发重复请求；路由守卫刷新鉴权时统一走这里。
    ensureUser() {
      if (!this.token) return Promise.resolve()
      if (this.user) return Promise.resolve()
      if (!this._userPromise) {
        this._userPromise = this.fetchMe().finally(() => {
          this._userPromise = null
        })
      }
      return this._userPromise
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
      // 避免退出后受保护内容残留展示。
      window.location.replace(import.meta.env.BASE_URL)
    },
  },
})
