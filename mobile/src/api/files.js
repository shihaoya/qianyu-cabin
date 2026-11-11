import api from './request.js'

// 文件上传：field 名固定 "file"；category 为业务分类（小写字母/数字/-/_，默认 general）
// 返回：单文件时为文件对象 { id, name, size, mimeType, category, url, createdAt }，多文件时为该数组
export function uploadFiles(files, { category = '', onUploadProgress } = {}) {
  const form = new FormData()
  for (const f of Array.isArray(files) ? files : [files]) form.append('file', f)
  if (category) form.append('category', category)
  return api.post('/files', form, { onUploadProgress })
}

// 按 id 批量回显文件信息（ids 为数字数组）
export function getFilesByIds(ids) {
  return api.get('/files', { params: { ids: ids.join(',') } })
}

// 扩展名白名单（上传组件据此做前端预校验）
export function getAllowedExtensions() {
  return api.get('/files/extensions')
}

// 读取文件内容（Blob）。文件读取接口需 Authorization 头，浏览器 <img>/<video> 直接挂 src
// 带不了 token，因此展示场景统一走这里换成本地 ObjectURL，组件销毁时记得 revoke。
export async function fetchFileObjectURL(id) {
  const blob = await api.get(`/files/${id}/raw`, { responseType: 'blob' })
  return URL.createObjectURL(blob)
}
