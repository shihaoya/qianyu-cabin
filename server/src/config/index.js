import dotenv from 'dotenv'

dotenv.config()

function required(name) {
  const value = process.env[name]
  if (value === undefined || value === '') {
    throw new Error(`缺少必要环境变量: ${name}`)
  }
  return value
}

export const config = {
  port: Number(process.env.PORT) || 3000,
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  databaseUrl: required('DATABASE_URL'),
  // 上传：根目录（不入库）、单文件大小上限（字节）、单请求文件数上限
  upload: {
    dir: process.env.UPLOAD_DIR || 'file',
    maxFileSize: Number(process.env.UPLOAD_MAX_FILE_SIZE) || 10 * 1024 * 1024,
    maxFiles: Number(process.env.UPLOAD_MAX_FILES) || 10,
  },
}
