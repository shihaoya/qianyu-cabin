import axios from 'axios'
import router from '../router/index.js'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '/server/api',
  withCredentials: false,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('qianyu_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => {
    const body = res.data
    if (body && body.code !== 0) {
      return Promise.reject(new Error(body.message || '请求失败'))
    }
    return body.data
  },
  (err) => {
    if (err.response && err.response.status === 401) {
      localStorage.removeItem('qianyu_token')
      router.replace('/login')
    }
    return Promise.reject(err)
  }
)

export default api
