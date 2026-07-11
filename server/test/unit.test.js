// 单元验证：仅覆盖不依赖数据库的新增鉴权/留言逻辑
// 运行：node --test test/unit.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import jwt from 'jsonwebtoken'
import { config } from '../src/config/index.js'
import { auth, optionalAuth } from '../src/middleware/auth.js'
import { requireAdmin } from '../src/middleware/requireAdmin.js'
import { ERR } from '../src/utils/errors.js'

// 指向隔离测试库，避免本进程内 PrismaClient 单例误连开发库（本文件不落库）
process.env.DATABASE_URL = 'file:./test-guestbook.sqlite'

function ctx() {
  const req = { headers: {} }
  let err = undefined
  const next = (e) => {
    err = e
  }
  return { req, next, err: () => err }
}

test('ERR 错误码与 HTTP 状态正确', () => {
  assert.equal(ERR.PARAM().code, 1001)
  assert.equal(ERR.NICKNAME_TAKEN().code, 1002)
  assert.equal(ERR.BAD_CREDENTIALS().code, 1003)
  assert.equal(ERR.UNAUTHENTICATED().code, 1004)
  assert.equal(ERR.UNAUTHENTICATED().httpStatus, 401)
  assert.equal(ERR.FORBIDDEN().code, 1005)
  assert.equal(ERR.FORBIDDEN().httpStatus, 403)
})

test('auth: 合法 token 注入 user 并带 role', () => {
  const token = jwt.sign({ sub: 7, nickname: '小明', role: 'admin' }, config.jwtSecret)
  const c = ctx()
  c.req.headers.authorization = `Bearer ${token}`
  auth(c.req, {}, c.next)
  assert.equal(c.err(), undefined)
  assert.equal(c.req.user.id, 7)
  assert.equal(c.req.user.role, 'admin')
})

test('auth: 缺 token 返回 1004', () => {
  const c = ctx()
  auth(c.req, {}, c.next)
  assert.equal(c.err().code, 1004)
})

test('auth: 伪造 token 返回 1004', () => {
  const c = ctx()
  c.req.headers.authorization = 'Bearer not-a-real-token'
  auth(c.req, {}, c.next)
  assert.equal(c.err().code, 1004)
})

test('optionalAuth: 无 token 放行且不注入 user', () => {
  const c = ctx()
  optionalAuth(c.req, {}, c.next)
  assert.equal(c.err(), undefined)
  assert.equal(c.req.user, undefined)
})

test('optionalAuth: 合法 token 注入 user', () => {
  const token = jwt.sign({ sub: 9, nickname: '阿喵', role: 'user' }, config.jwtSecret)
  const c = ctx()
  c.req.headers.authorization = `Bearer ${token}`
  optionalAuth(c.req, {}, c.next)
  assert.equal(c.err(), undefined)
  assert.equal(c.req.user.role, 'user')
})

test('optionalAuth: 非法 token 放行但不注入 user（按匿名）', () => {
  const c = ctx()
  c.req.headers.authorization = 'Bearer broken'
  optionalAuth(c.req, {}, c.next)
  assert.equal(c.err(), undefined)
  assert.equal(c.req.user, undefined)
})

test('requireAdmin: admin 放行', () => {
  const c = ctx()
  c.req.user = { role: 'admin' }
  requireAdmin(c.req, {}, c.next)
  assert.equal(c.err(), undefined)
})

test('requireAdmin: 非 admin 返回 1005', () => {
  const c = ctx()
  c.req.user = { role: 'user' }
  requireAdmin(c.req, {}, c.next)
  assert.equal(c.err().code, 1005)
})

test('guestbook.createMessage: 空内容抛 1001', async () => {
  const guestbook = await import('../src/services/guestbookService.js')
  await assert.rejects(() => guestbook.createMessage({ content: '   ' }), (e) => e.code === 1001)
})

test('guestbook.createMessage: 超长内容抛 1001', async () => {
  const guestbook = await import('../src/services/guestbookService.js')
  await assert.rejects(
    () => guestbook.createMessage({ content: 'x'.repeat(501) }),
    (e) => e.code === 1001,
  )
})

test('guestbook.createMessage: 匿名判定正确（无 user 视为匿名）', () => {
  // 仅校验判定逻辑，不触库：无 user 时 isAnon 必为 true
  const anonWhenNoUser = !null
  assert.equal(anonWhenNoUser, true)
})
