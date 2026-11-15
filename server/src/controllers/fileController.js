import multer from 'multer'
import { config } from '../config/index.js'
import { prisma } from '../db/index.js'
import { AppError } from '../utils/errors.js'
import {
  ALLOWED_EXTENSIONS,
  getFileById,
  listFiles as listFilesService,
  normalizeCategory,
  removeFile,
  resolveStoragePath,
  saveUpload,
  serializeFile,
} from '../services/fileService.js'
import { sendOk } from '../utils/response.js'

// 内存接收：校验通过才写磁盘，避免非法类型落盘产生临时垃圾；
// 大小/数量上限在接收前拦截，超限直接 1001（不泄露 multer 英文错误）。
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.upload.maxFileSize, files: config.upload.maxFiles },
})

// multer 错误（超限等）统一转中文业务错误
export function handleUploadError(err, _req, _res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(new AppError(1001, `单个文件不能超过 ${Math.floor(config.upload.maxFileSize / 1024 / 1024)}MB`, 400))
    }
    return next(new AppError(1001, '上传文件不符合要求', 400))
  }
  next(err)
}

// POST /api/files  field 名 "file"（可多文件），query/body 可带 category
export async function postFiles(req, res) {
  if (!req.files?.length && !req.file) throw new AppError(1020, '请选择要上传的文件', 400)
  const files = req.files ?? [req.file]
  const category = normalizeCategory(req.body?.category ?? req.query?.category)
  const saved = []
  for (const f of files) {
    saved.push(await saveUpload(f, { category, uploaderId: req.user?.id ?? null }))
  }
  const list = saved.map(serializeFile)
  // 单文件时直接返回对象（大多数场景），多文件返回数组
  sendOk(res, list.length === 1 ? list[0] : list, '上传成功')
}

// GET /api/files?ids=1,2,3  供业务方按 id 回显文件信息
export async function getFiles(req, res) {
  const ids = String(req.query.ids ?? '')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0)
  if (!ids.length) throw new AppError(1001, '请提供文件 id', 400)
  const files = await prisma.uploadedFile.findMany({ where: { id: { in: ids } } })
  sendOk(res, files.map(serializeFile))
}

// GET /api/files/list?page=&pageSize=&category=  管理端分页列出全部文件
export async function listFiles(req, res) {
  sendOk(res, await listFilesService({ page: req.query.page, pageSize: req.query.pageSize, category: req.query.category }))
}

// GET /api/files/:id/raw  鉴权后流式读取（音频/视频需要 Range 支持）
export async function getFileRaw(req, res) {
  const file = await getFileById(req.params.id)
  const abs = resolveStoragePath(file.storageKey)
  res.setHeader('Content-Type', file.mimeType)
  res.setHeader('Cache-Control', 'private, max-age=86400')
  res.setHeader('Accept-Ranges', 'bytes')
  res.sendFile(abs, (err) => {
    if (err && !res.headersSent) {
      res.status(404).json({ code: 1021, data: null, message: '文件不存在' })
    }
  })
}

// DELETE /api/files/:id
export async function deleteFile(req, res) {
  await removeFile(req.params.id)
  sendOk(res, null, '已删除')
}

// GET /api/files/extensions  白名单下发，前端上传组件据此校验/生成 accept
export function getExtensions(_req, res) {
  sendOk(res, [...ALLOWED_EXTENSIONS])
}
