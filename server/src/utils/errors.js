export class AppError extends Error {
  constructor(code, message, httpStatus = 400) {
    super(message)
    this.code = code
    this.httpStatus = httpStatus
  }
}

export const ERR = {
  PARAM: (message = '参数错误') => new AppError(1001, message, 400),
  NICKNAME_TAKEN: (message = '昵称已存在') => new AppError(1002, message, 400),
  BAD_CREDENTIALS: (message = '昵称或密码错误') => new AppError(1003, message, 401),
  UNAUTHENTICATED: (message = '未登录或登录失效') => new AppError(1004, message, 401),
}
