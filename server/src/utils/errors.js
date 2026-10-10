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
  // 福利管理（以下为福利类型 / 粉丝卡相关业务码）
  TYPE_NOT_FOUND: (message = '福利类型不存在') => new AppError(1010, message, 404),
  TYPE_NAME_TAKEN: (message = '该福利类型已存在') => new AppError(1011, message, 400),
  TYPE_IN_USE: (message = '仍有粉丝持有该类型的卡，不能删除') => new AppError(1012, message, 400),
  FAN_NOT_FOUND: (message = '粉丝不存在') => new AppError(1013, message, 404),
  BENEFIT_NOT_ENOUGH: (message = '卡数量不足，扣减后不能为负') => new AppError(1014, message, 400),
  REASON_REQUIRED: (message = '请填写增减卡的理由') => new AppError(1015, message, 400),
  ADJUST_INVALID: (message = '调整数量必须是不为 0 的整数') => new AppError(1016, message, 400),
  // 常用理由
  COMMON_REASON_TAKEN: (message = '该常用理由已存在') => new AppError(1017, message, 400),
  COMMON_REASON_NOT_FOUND: (message = '常用理由不存在') => new AppError(1018, message, 404),
  // 用户管理
  USER_NOT_FOUND: (message = '用户不存在') => new AppError(1019, message, 404),
}
