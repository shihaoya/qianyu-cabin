import { Router } from 'express'
import {
  deleteFile,
  getExtensions,
  getFileRaw,
  getFiles,
  handleUploadError,
  postFiles,
  upload,
} from '../controllers/fileController.js'
import { auth } from '../middleware/auth.js'

// 文件上传与读取：上传/查询/读取需登录；删除暂不开放（后续业务接入时按能力挂 requireCap）
const router = Router()

router.use(auth)

// 上传（multipart，field 名 "file"，可多文件）；multer 错误转中文业务错误
router.post('/', upload.array('file', 10), handleUploadError, postFiles)
// 扩展名白名单下发（前端上传组件据此校验）
router.get('/extensions', getExtensions)
// 按 id 批量回显文件信息
router.get('/', getFiles)
// 流式读取（鉴权后）；注意必须放在 '/:id' 语义之前无冲突，'/extensions' 已先注册
router.get('/:id/raw', getFileRaw)
router.delete('/:id', deleteFile)

export default router
