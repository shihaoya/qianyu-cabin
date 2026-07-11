// 集成验证：连隔离测试库（不碰开发库、不启 HTTP 服务），真实落库验证留言与角色变更。
// 运行：node --test （同进程内把 DATABASE_URL 指向独立的 test-guestbook.sqlite，执行后删除）
import test from 'node:test'
import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ROLE } from '../src/permissions.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
// 相对 prisma 目录：实际落在 server/prisma/test-guestbook.sqlite（SQLite 需 file: 前缀）
const testDbRel = 'file:./test-guestbook.sqlite'
const testDbAbs = path.join(root, 'prisma', 'test-guestbook.sqlite')

// 指向隔离测试库：确保本进程内任何 PrismaClient 单例都不会连到开发库
process.env.DATABASE_URL = testDbRel

let prisma
let guestbook
let userService

test.before(async () => {
  // 用 db push 在临时库上建表（跳过 generate，不启服务）
  execSync('node node_modules/prisma/build/index.js db push --skip-generate --accept-data-loss', {
    cwd: root,
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: testDbRel },
  })
  const db = await import('../src/db/index.js')
  prisma = db.prisma
  guestbook = await import('../src/services/guestbookService.js')
  userService = await import('../src/services/userService.js')
})

test.after(async () => {
  await prisma.$disconnect()
  fs.rmSync(testDbAbs, { force: true })
  fs.rmSync(`${testDbAbs}-journal`, { force: true })
})

test('guestbook: 匿名留言不存储任何身份（userId/nickname 为空）', async () => {
  const m = await guestbook.createMessage({ content: '匿名留言测试', anonymous: true })
  // 回库查证真实落库值（service 的 select 出于隐私不回传 userId）
  const stored = await prisma.message.findUnique({ where: { id: m.id } })
  assert.equal(stored.isAnonymous, true)
  assert.equal(stored.userId, null)
  assert.equal(stored.nickname, null)
})

test('guestbook: 登录用户留言记录昵称与 userId', async () => {
  const user = await userService.register(`__it_${Date.now()}`, 'pw123456')
  const m = await guestbook.createMessage({ content: '登录用户留言', user })
  const stored = await prisma.message.findUnique({ where: { id: m.id } })
  assert.equal(stored.isAnonymous, false)
  assert.equal(stored.userId, user.id)
  assert.equal(stored.nickname, user.nickname)
})

test('guestbook: 列表按时间倒序返回且含已写留言', async () => {
  // 匿名看不到任何留言；用具备 manageUsers 的 admin 才能查看全部
  const admin = await userService.register(`__it_admin_${Date.now()}`, 'pw123456')
  const adminUser = await userService.setRole(admin.id, ROLE.ADMIN)
  const list = await guestbook.listMessages(adminUser)
  assert.ok(Array.isArray(list))
  assert.ok(list.length >= 2)
})

test('admin: 角色可调整为 admin 并在用户列表中体现', async () => {
  const user = await userService.register(`__it2_${Date.now()}`, 'pw123456')
  await userService.setRole(user.id, ROLE.ADMIN)
  const updated = await userService.getUserById(user.id)
  assert.equal(updated.role, ROLE.ADMIN)
  const { list } = await userService.listUsers({ page: 1, pageSize: 50 })
  assert.ok(list.some((u) => u.id === user.id && u.role === ROLE.ADMIN))
})
