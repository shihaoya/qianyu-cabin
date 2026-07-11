export function sendOk(res, data = null, message = 'ok') {
  return res.json({ code: 0, data, message })
}

export function sendFail(res, code, message, httpStatus = 400) {
  return res.status(httpStatus).json({ code, data: null, message })
}
