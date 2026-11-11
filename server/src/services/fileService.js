// 文件上传：唯一负责「文件 ↔ 磁盘 + UploadedFile 表」的服务
// 扩展性约定：未来迁移到 OSS/S3 时，只改本文件的落盘/读取实现，
// controller 与业务方（按 fileId 关联）完全无感。
import { randomUUID } from 'node:crypto'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { config } from '../config/index.js'
import { prisma } from '../db/index.js'
import { ERR } from '../utils/errors.js'

// 上传根目录（server/ 运行目录下，由 UPLOAD_DIR 配置，默认 file/，不入库）
export const uploadRoot = path.resolve(import.meta.dirname, '../../', config.upload.dir)
// 扩展名白名单（单一真源）：新功能需要新类型时在此登记，前端组件的 accept 同步放开。
// 只按扩展名判断——multer 以内存接收，不落临时目录，无路径穿越面。
export const ALLOWED_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp',
  '.mp4', '.webm', '.mov', '.mp3', '.wav', '.m4a',
  '.pdf', '.txt', '.md', '.csv', '.json', '.zip',
])

// category 只允许小写字母/数字/中划线/下划线，默认 general；由业务方按功能传入（如 "avatar"）
export function normalizeCategory(category) {
  const c = String(category ?? '').trim().toLowerCase()
  if (!c) return 'general'
  if (!/^[a-z0-9_-]{1,32}$/.test(c)) throw ERR.PARAM('文件分类格式非法')
  return c
}

// 原始文件名 → 规范化小写扩展名（含点）；不在白名单抛 1001
export function normalizeExt(originalName) {
  const ext = path.extname(String(originalName ?? '')).toLowerCase()
  if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
    throw ERR.PARAM(`不支持的文件类型${ext ? `（${ext}）` : ''}`)
  }
  return ext
}

// storageKey → 绝对路径，且必须 containment 在上传根目录内（防 ../ 穿越）
export function resolveStoragePath(storageKey) {
  const abs = path.resolve(uploadRoot, storageKey)
  if (abs !== uploadRoot && !abs.startsWith(uploadRoot + path.sep)) {
    throw ERR.PARAM('文件路径非法')
  }
  return abs
}

// 列表/详情返回给前端的统一形状；url 经 /api/files/:id/raw 走鉴权后的流式读取
export function serializeFile(file) {
  return {
    id: file.id,
    name: file.originalName,
    size: file.size,
    mimeType: file.mimeType,
    category: file.category,
    url: `/api/files/${file.id}/raw`,
    createdAt: file.createdAt,
  }
}

// multer 以内存形式给出的 file（{ originalname, mimetype, buffer, size }）落盘 + 建档。
// 顺序：校验 → 写磁盘 → 写库；写库失败时回删磁盘文件，不留孤儿。
export async function saveUpload(file, { category = 'general', uploaderId = null } = {}) {
  const ext = normalizeExt(file.originalname)
  const now = new Date()
  const dateDir = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`
  const storageKey = `${dateDir}/${randomUUID()}${ext}`
  const abs = resolveStoragePath(storageKey)

  try {
    await mkdir(path.dirname(abs), { recursive: true })
    await writeFile(abs, file.buffer)
  } catch {
    throw ERR.PARAM('文件保存失败，请重试')
  }

  try {
    const record = await prisma.uploadedFile.create({
      data: {
        originalName: String(file.originalname).slice(0, 255),
        mimeType: String(file.mimetype || 'application/octet-stream').slice(0, 127),
        size: file.size,
        ext,
        storageKey,
        category: normalizeCategory(category),
        uploaderId,
      },
    })
    return record
  } catch (e) {
    await unlink(abs).catch(() => {})
    throw e
  }
}

export async function getFileById(id) {
  const num = Number(id)
  if (!Number.isInteger(num) || num <= 0) throw ERR.PARAM('文件 id 非法')
  const file = await prisma.uploadedFile.findUnique({ where: { id: num } })
  if (!file) throw ERR.FILE_NOT_FOUND()
  return file
}

// 删除：先查再删磁盘与记录；磁盘文件缺失不阻断记录删除（清理语义）
export async function removeFile(id) {
  const file = await getFileById(id)
  await unlink(resolveStoragePath(file.storageKey)).catch(() => {})
  await prisma.uploadedFile.delete({ where: { id: file.id } })
  return file
}
