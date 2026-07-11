import { AppError } from '../utils/errors.js'

export function errorHandler(err, req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.httpStatus).json({ code: err.code, data: null, message: err.message })
  }

  console.error('[UNHANDLED_ERROR]', err)
  return res.status(500).json({ code: 5000, data: null, message: '服务器开小差了' })
}
