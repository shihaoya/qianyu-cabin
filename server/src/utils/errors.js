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
  FORBIDDEN: (message = '无权访问') => new AppError(1005, message, 403),
  OLD_PWD_WRONG: (message = '原密码不正确') => new AppError(1006, message, 401),
  GAME_NOT_FOUND: (message = '游戏不存在') => new AppError(1007, message, 404),
  SAVE_INVALID: (message = '存档状态非法') => new AppError(1008, message, 400),
  RESULT_INVALID: (message = '游戏结果非法') => new AppError(1009, message, 400),
}
