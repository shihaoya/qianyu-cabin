import api from './request.js'

// 文件上传：field 名固定 "file"；category 为业务分类（小写字母/数字/-/_，默认 general）
// 返回：单文件时为文件对象 { id, name, size, mimeType, category, url, createdAt }，多文件时为该数组
export function uploadFiles(files, { category = '', onUploadProgress } = {}) {
  // eslint-disable-next-line no-undef -- FormData 是浏览器内置对象
  const form = new FormData()
  for (const f of Array.isArray(files) ? files : [files]) form.append('file', f)
  if (category) form.append('category', category)
  return api.post('/files', form, { onUploadProgress })
}

// 按 id 批量回显文件信息（ids 为数字数组）
export function getFilesByIds(ids) {
  return api.get('/files', { params: { ids: ids.join(',') } })
}

// 管理端：分页列出全部文件（含 refs 被引用信息）。需 manageFiles 能力
export function listFiles({ page = 1, pageSize = 50, category = '' } = {}) {
  return api.get('/files/list', { params: { page, pageSize, category } })
}

// 删除文件（服务端会阻止删除被业务引用的文件，错误信息里带引用明细）
export function deleteFile(id) {
  return api.delete(`/files/${id}`)
}

// 扩展名白名单（上传组件据此做前端预校验）
export function getAllowedExtensions() {
  return api.get('/files/extensions')
}

// 读取文件内容（Blob）。文件读取接口需 Authorization 头，浏览器 <img>/<video> 直接挂 src
// 带不了 token，因此展示场景统一走这里换成本地 ObjectURL，组件销毁时记得 revoke。
export async function fetchFileObjectURL(id) {
  // 原生 fetch：responseType 'blob' 时 axios 拦截器无法区分业务错误与图片字节，
  // 若后端返回错误 JSON（如 401），axios 会把它包成 Blob，createObjectURL 后浏览器加载失败。
  const token = localStorage.getItem('qianyu_token')
  const base = import.meta.env.VITE_API_BASE || '/server/api'
  const res = await fetch(`${base}/files/${id}/raw`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) throw new Error(`读取文件失败（HTTP ${res.status}）`)
  return URL.createObjectURL(await res.blob())
}
