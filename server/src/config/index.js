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
}
