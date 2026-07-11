import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '/server/api',
  withCredentials: false,
})

// 统一归一化：把任何失败都转成带友好中文 message 的 Error，
// 并挂上 code / status，供页面按需区分。页面只展示 err.message。
function toError(message, code, status) {
  const e = new Error(message || '请求失败，请稍后再试')
  if (code !== undefined) e.code = code
  if (status !== undefined) e.status = status
  return e
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('qianyu_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => {
    const body = res.data
    // HTTP 2xx 但业务失败（code !== 0）
    if (body && body.code !== 0) {
      return Promise.reject(toError(body.message, body.code))
    }
    return body.data
  },
  (err) => {
    const status = err.response?.status
    const data = err.response?.data

    if (status === 401) {
      // 仅当原本已登录（携带 token）时的 401 才是 token 失效，
      // 需要整页刷新回首页（与手动退出行为一致，销毁残留状态）。
      // 登录/注册失败后端同样返回 401，但此时根本没有 token，
      // 不应跳转，应交由页面展示“昵称或密码错误”等文案。
      const hadToken = !!localStorage.getItem('qianyu_token')
      localStorage.removeItem('qianyu_token')
      if (hadToken) {
        window.location.replace(import.meta.env.BASE_URL)
      }
    }

    // 优先用后端返回的中文 message；无响应体（断网/超时）给通用兜底文案，
    // 绝不把 axios 默认的 "Request failed with status code xxx" 透出到页面。
    const message =
      (data && data.message) ||
      (status ? '请求失败，请稍后再试' : '网络异常，请检查网络后重试')

    return Promise.reject(toError(message, data?.code, status))
  }
)

export default api
