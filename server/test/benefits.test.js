// 福利管理验证：连隔离测试库（不碰开发库、不启 HTTP 服务），真实落库验证
// 福利类型 / 粉丝档案 / 持卡数量 / 增减流水 的完整链路。
// 运行：node --test test/benefits.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ROLE, CAP, can } from '../src/permissions.js'
import { ERR } from '../src/utils/errors.js'
import { requireBenefitsAdmin } from '../src/middleware/requireAdmin.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
// 相对 prisma 目录：实际落在 server/prisma/test-benefits.sqlite（SQLite 需 file: 前缀）
const testDbRel = 'file:./test-benefits.sqlite'
const testDbAbs = path.join(root, 'prisma', 'test-benefits.sqlite')

process.env.DATABASE_URL = testDbRel

let prisma
let types
let fans
let reasons
let userService

test.before(async () => {
  execSync('node node_modules/prisma/build/index.js db push --skip-generate --accept-data-loss', {
    cwd: root,
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: testDbRel },
  })
  const db = await import('../src/db/index.js')
  prisma = db.prisma
  types = await import('../src/services/benefitTypeService.js')
  fans = await import('../src/services/fanService.js')
  reasons = await import('../src/services/benefitReasonService.js')
  userService = await import('../src/services/userService.js')
})

test.after(async () => {
  await prisma.$disconnect()
  fs.rmSync(testDbAbs, { force: true })
  fs.rmSync(`${testDbAbs}-journal`, { force: true })
})

// ---------- 权限（纯单元，不触库） ----------

test('permissions: 福利管理能力对 admin/owner 开放、普通用户关闭', () => {
  assert.equal(can({ role: ROLE.ADMIN }, CAP.MANAGE_BENEFITS), true)
  assert.equal(can({ role: ROLE.OWNER }, CAP.MANAGE_BENEFITS), true)
  assert.equal(can({ role: ROLE.USER }, CAP.MANAGE_BENEFITS), false)
  assert.equal(can(null, CAP.MANAGE_BENEFITS), false)
})

test('requireBenefitsAdmin: 非管理角色返回 1005', () => {
  let err
  requireBenefitsAdmin({ user: { role: ROLE.USER } }, {}, (e) => {
    err = e
  })
  assert.equal(err.code, 1005)
})

test('requireBenefitsAdmin: 管理员放行', () => {
  let err
  requireBenefitsAdmin({ user: { role: ROLE.ADMIN } }, {}, (e) => {
    err = e
  })
  assert.equal(err, undefined)
})

// ---------- 错误码 ----------

test('ERR: 福利相关错误码取值正确', () => {
  assert.equal(ERR.TYPE_NOT_FOUND().code, 1010)
  assert.equal(ERR.TYPE_NOT_FOUND().httpStatus, 404)
  assert.equal(ERR.TYPE_NAME_TAKEN().code, 1011)
  assert.equal(ERR.TYPE_IN_USE().code, 1012)
  assert.equal(ERR.FAN_NOT_FOUND().code, 1013)
  assert.equal(ERR.FAN_NOT_FOUND().httpStatus, 404)
  assert.equal(ERR.BENEFIT_NOT_ENOUGH().code, 1014)
  assert.equal(ERR.REASON_REQUIRED().code, 1015)
  assert.equal(ERR.ADJUST_INVALID().code, 1016)
  assert.equal(ERR.COMMON_REASON_TAKEN().code, 1017)
  assert.equal(ERR.COMMON_REASON_NOT_FOUND().code, 1018)
  assert.equal(ERR.COMMON_REASON_NOT_FOUND().httpStatus, 404)
})

// ---------- 福利类型 CRUD ----------

test('type: 创建后列表按顺序返回，重名抛 1011', async () => {
  const first = await types.createType({ name: '加班卡', description: '多干一会儿' })
  assert.equal(first.name, '加班卡')
  await types.createType({ name: '减班卡' })

  const list = await types.listTypes()
  assert.deepEqual(
    list.map((t) => t.name),
    ['加班卡', '减班卡'],
  )
  assert.equal(list[0].holderCount, 0)

  await assert.rejects(() => types.createType({ name: '加班卡' }), (e) => e.code === 1011)
  await assert.rejects(() => types.createType({ name: '   ' }), (e) => e.code === 1001)
})

test('type: 重命名与修改说明；重命名为已有名称抛 1011', async () => {
  const target = (await types.listTypes()).find((t) => t.name === '减班卡')
  const updated = await types.updateType(target.id, { name: '调休卡', description: '换一天休息' })
  assert.equal(updated.name, '调休卡')
  assert.equal(updated.description, '换一天休息')

  await assert.rejects(
    () => types.updateType(target.id, { name: '加班卡' }),
    (e) => e.code === 1011,
  )
  await assert.rejects(() => types.updateType(99999, { name: 'x' }), (e) => e.code === 1010)
})

// ---------- 粉丝档案 ----------

test('fan: 昵称必填，其余字段可留空', async () => {
  const fan = await fans.createFan({ nickname: '阿团' })
  assert.equal(fan.nickname, '阿团')
  assert.equal(fan.userId, null)
  assert.equal(fan.systemAccount, null)
  assert.equal(fan.douyinAccount, null)
  assert.equal(fan.remark, null)

  await assert.rejects(() => fans.createFan({ nickname: '  ' }), (e) => e.code === 1001)
})

test('fan: 关联系统内账号时落 userId 与昵称快照；账号不存在抛 1001', async () => {
  const user = await userService.register(`__bn_${Date.now()}`, 'pw123456')
  const fan = await fans.createFan({ nickname: '汤圆', userId: user.id })
  assert.equal(fan.userId, user.id)
  assert.equal(fan.systemAccount, user.nickname)

  await assert.rejects(() => fans.createFan({ nickname: 'xx', userId: 99999 }), (e) => e.code === 1001)
})

test('fan: 编辑资料并可解除系统内账号关联', async () => {
  const fan = (await fans.listFans({})).list.find((f) => f.nickname === '汤圆')
  const updated = await fans.updateFan(fan.id, { remark: '常来的小伙伴' })
  assert.equal(updated.remark, '常来的小伙伴')
  assert.equal(updated.systemAccount, fan.systemAccount)

  const unlinked = await fans.updateFan(fan.id, { userId: '' })
  assert.equal(unlinked.userId, null)
  assert.equal(unlinked.systemAccount, null)

  await assert.rejects(() => fans.updateFan(99999, { remark: 'x' }), (e) => e.code === 1013)
})

test('fan: 列表分页与关键字搜索', async () => {
  await fans.createFan({ nickname: '找不到的人', douyinAccount: 'dy_demo' })
  const { total } = await fans.listFans({ page: 1, pageSize: 50 })
  const all = (await fans.listFans({ page: 1, pageSize: 50 })).list
  assert.equal(all.length, total)

  const hit = await fans.listFans({ keyword: 'dy_demo' })
  assert.equal(hit.list.length, 1)
  assert.equal(hit.list[0].nickname, '找不到的人')
})

// ---------- 增减卡与流水 ----------

function typeIdByName(name) {
  return types.listTypes().then((list) => list.find((t) => t.name === name).id)
}

test('card: 增加后余额与流水正确（记录理由、时间、操作人、余额）', async () => {
  const tid = await typeIdByName('加班卡')
  const fan = (await fans.listFans({ keyword: '阿团' })).list[0]
  const operator = { id: 101, nickname: '管理员A' }

  const { card, log } = await fans.adjustFanCard({
    fanId: fan.id,
    typeId: tid,
    delta: 5,
    reason: '活动奖励',
    operator,
  })
  assert.equal(card.amount, 5)
  assert.equal(log.delta, 5)
  assert.equal(log.balance, 5)
  assert.equal(log.reason, '活动奖励')
  assert.equal(log.typeName, '加班卡')
  assert.equal(log.fanNickname, '阿团')
  assert.equal(log.operatorName, '管理员A')
  assert.ok(log.createdAt instanceof Date)

  // 再增加一次：余额累加，流水两条
  await fans.adjustFanCard({ fanId: fan.id, typeId: tid, delta: 2, reason: '补发', operator })
  const { cards } = await fans.listFanCards(fan.id)
  const held = cards.find((c) => c.typeId === tid)
  assert.equal(held.amount, 7)

  const { list, total } = await fans.listFanLogs({ fanId: fan.id })
  assert.equal(total, 2)
  assert.equal(list[0].balance, 7) // 倒序：最新在前
})

test('card: 同一粉丝可同时持有多种卡，数量各自独立', async () => {
  const tidA = await typeIdByName('加班卡')
  const tidB = await typeIdByName('调休卡')
  const fan = (await fans.listFans({ keyword: '汤圆' })).list[0]

  await fans.adjustFanCard({ fanId: fan.id, typeId: tidA, delta: 3, reason: '登记' })
  await fans.adjustFanCard({ fanId: fan.id, typeId: tidB, delta: 1, reason: '登记' })

  const { cards } = await fans.listFanCards(fan.id)
  assert.equal(cards.find((c) => c.typeId === tidA).amount, 3)
  assert.equal(cards.find((c) => c.typeId === tidB).amount, 1)
  // 未持有的类型也要返回（数量 0），便于前端直接增减
  assert.equal(cards.length, (await types.listTypes()).length)
})

test('card: 减少需校验余额；理由为空抛 1015；数量为 0 抛 1016', async () => {
  const tid = await typeIdByName('调休卡')
  const fan = (await fans.listFans({ keyword: '汤圆' })).list[0]

  const { card } = await fans.adjustFanCard({ fanId: fan.id, typeId: tid, delta: -1, reason: '用掉一张' })
  assert.equal(card.amount, 0)

  await assert.rejects(
    () => fans.adjustFanCard({ fanId: fan.id, typeId: tid, delta: -1, reason: '再来一张' }),
    (e) => e.code === 1014,
  )
  await assert.rejects(
    () => fans.adjustFanCard({ fanId: fan.id, typeId: tid, delta: 1, reason: '  ' }),
    (e) => e.code === 1015,
  )
  await assert.rejects(
    () => fans.adjustFanCard({ fanId: fan.id, typeId: tid, delta: 0, reason: '零' }),
    (e) => e.code === 1016,
  )
  await assert.rejects(
    () => fans.adjustFanCard({ fanId: fan.id, typeId: 99999, delta: 1, reason: '不存在' }),
    (e) => e.code === 1010,
  )
})

test('card: 列表概览只回显数量大于 0 的卡', async () => {
  const list = (await fans.listFans({ page: 1, pageSize: 50 })).list
  const fan = list.find((f) => f.nickname === '阿团')
  assert.equal(fan.cards.length, 1)
  assert.equal(fan.cards[0].typeName, '加班卡')
  assert.equal(fan.cards[0].amount, 7)

  const zero = list.find((f) => f.nickname === '汤圆')
  assert.equal(zero.cards.length, 1) // 调休卡已减到 0，只剩加班卡
  assert.equal(zero.cards[0].typeName, '加班卡')
})

// ---------- 删除约束 ----------

test('type: 有人持卡不可删除（1012），清空后可删除', async () => {
  const list = await types.listTypes()
  const heldType = list.find((t) => t.name === '加班卡')
  assert.ok(heldType.holderCount > 0)
  await assert.rejects(() => types.removeType(heldType.id), (e) => e.code === 1012)

  await assert.rejects(() => types.removeType(99999), (e) => e.code === 1010)
})

test('type: 清空某类型所有卡后可删除，且不误删同名流水快照', async () => {
  const tid = await typeIdByName('加班卡')
  await prisma.fanBenefit.updateMany({ where: { typeId: tid }, data: { amount: 0 } })

  const result = await types.removeType(tid)
  assert.equal(result.deleted, true)
  const left = (await types.listTypes()).map((t) => t.name)
  assert.ok(!left.includes('加班卡'))

  const orphan = await prisma.fanBenefit.count({ where: { typeId: tid } })
  assert.equal(orphan, 0)
})

test('fan: 删除粉丝会清掉其卡，但增减流水保留可查', async () => {
  const tid = await typeIdByName('调休卡')
  const created = await fans.createFan({ nickname: '待删除粉丝' })
  await fans.adjustFanCard({ fanId: created.id, typeId: tid, delta: 4, reason: '奖励' })

  await fans.removeFan(created.id)
  assert.equal(await prisma.fan.findUnique({ where: { id: created.id } }), null)
  assert.equal(await prisma.fanBenefit.count({ where: { fanId: created.id } }), 0)

  const { total } = await fans.listFanLogs({ fanId: created.id })
  assert.equal(total, 1)

  await assert.rejects(() => fans.removeFan(created.id), (e) => e.code === 1013)
})

test('fan: 改名后历史流水的粉丝名快照同步更新', async () => {
  const tid = await typeIdByName('调休卡')
  const fan = await fans.createFan({ nickname: '旧名字' })
  await fans.adjustFanCard({ fanId: fan.id, typeId: tid, delta: 1, reason: '测试改名' })
  await fans.updateFan(fan.id, { nickname: '新名字' })

  const { list } = await fans.listFanLogs({ fanId: fan.id })
  assert.equal(list[0].fanNickname, '新名字')
})

// ---------- 常用理由（增减卡时一键带入） ----------

// ---------- 我的福利（按登录账号反查粉丝档案，只读） ----------

test('fan: 列表按昵称 A→Z 排序（同昵称按 id 稳定）', async () => {
  await fans.createFan({ nickname: '__zulu' })
  await fans.createFan({ nickname: '__alpha' })
  await fans.createFan({ nickname: '__mike' })

  const { list } = await fans.listFans({ pageSize: 200 })
  const names = list.map((f) => f.nickname)
  // SQLite 文本比较是二进制升序，与 JS 的 < > 比较一致
  const expected = [...names].sort((a, b) => (a > b ? 1 : a < b ? -1 : 0))
  assert.deepEqual(names, expected)
})

test('myBenefits: 绑定的账号能看到自己的卡与最近流水', async () => {
  const tid = await typeIdByName('调休卡')
  const user = await userService.register(`__my_${Date.now()}`, 'pw123456')
  const fan = await fans.createFan({ nickname: '我的福利测试号', userId: user.id })
  await fans.adjustFanCard({ fanId: fan.id, typeId: tid, delta: 3, reason: '入伙礼' })
  await fans.adjustFanCard({ fanId: fan.id, typeId: tid, delta: -1, reason: '用掉一张' })

  const data = await fans.getMyBenefits({ userId: user.id })
  assert.equal(data.bound, true)
  assert.equal(data.nickname, '我的福利测试号')

  const held = data.cards.find((c) => c.typeId === tid)
  assert.equal(held.amount, 2)
  // 已持有的排在前面
  assert.equal(data.cards[0].typeId, tid)

  assert.ok(data.logs.length >= 2)
  assert.equal(data.logs[0].reason, '用掉一张') // 倒序：最新在前
  assert.equal(data.logs[0].balance, 2)
  assert.equal(data.logs[0].delta, -1)
})

test('myBenefits: 未绑定粉丝档案的账号返回 bound:false，不报错', async () => {
  const user = await userService.register(`__my_none_${Date.now()}`, 'pw123456')
  const data = await fans.getMyBenefits({ userId: user.id })
  assert.equal(data.bound, false)
  assert.equal(data.nickname, null)
  assert.deepEqual(data.cards, [])
  assert.deepEqual(data.logs, [])
})

test('myBenefits: 只看自己的卡，看不到别人名下的数量', async () => {
  const tid = await typeIdByName('调休卡')
  const owner = await userService.register(`__my_a_${Date.now()}`, 'pw123456')
  const other = await userService.register(`__my_b_${Date.now()}`, 'pw123456')

  const myFan = await fans.createFan({ nickname: '只有我自己', userId: owner.id })
  const otherFan = await fans.createFan({ nickname: '别人', userId: other.id })
  await fans.adjustFanCard({ fanId: myFan.id, typeId: tid, delta: 2, reason: '给我' })
  await fans.adjustFanCard({ fanId: otherFan.id, typeId: tid, delta: 7, reason: '给别人' })

  const mine = await fans.getMyBenefits({ userId: owner.id })
  assert.equal(mine.cards.find((c) => c.typeId === tid).amount, 2)
  assert.ok(!mine.logs.some((l) => l.reason === '给别人'))
})

test('reason: 空库返回空列表；新增后按新增顺序返回', async () => {
  assert.deepEqual(await reasons.listReasons(), [])

  const first = await reasons.createReason({ text: '活动奖励' })
  assert.equal(first.text, '活动奖励')
  await reasons.createReason({ text: '直播抽奖中奖' })

  const list = await reasons.listReasons()
  assert.deepEqual(
    list.map((r) => r.text),
    ['活动奖励', '直播抽奖中奖'],
  )
})

test('reason: 空文本 / 超长抛 1001，重名抛 1017', async () => {
  await assert.rejects(() => reasons.createReason({ text: '   ' }), (e) => e.code === 1001)
  await assert.rejects(() => reasons.createReason({ text: 'x'.repeat(31) }), (e) => e.code === 1001)
  await assert.rejects(() => reasons.createReason({ text: '活动奖励' }), (e) => e.code === 1017)
  // 去空格后视为同一条
  await assert.rejects(() => reasons.createReason({ text: ' 活动奖励 ' }), (e) => e.code === 1017)
})

test('reason: 可改名改类型；改名为已有文本抛 1017，id 不存在抛 1018', async () => {
  const list = await reasons.listReasons()
  const target = list.find((r) => r.text === '直播抽奖中奖')
  const updated = await reasons.updateReason(target.id, { text: '抽奖中奖', type: 'add' })
  assert.equal(updated.text, '抽奖中奖')
  assert.equal(updated.type, 'add')

  await assert.rejects(
    () => reasons.updateReason(target.id, { text: '活动奖励' }),
    (e) => e.code === 1017,
  )
  await assert.rejects(
    () => reasons.updateReason(99999, { text: '不存在' }),
    (e) => e.code === 1018,
  )
})

test('reason: 不传 type 默认为 common（兼容历史数据与旧客户端）', async () => {
  const created = await reasons.createReason({ text: '缺省类型理由' })
  assert.equal(created.type, 'common')

  const updated = await reasons.updateReason(created.id, { text: '缺省类型理由2' })
  assert.equal(updated.type, 'common', '只改文本时不应把类型重置掉')

  await reasons.removeReason(created.id)
})

test('reason: type 只能是 common/add/sub，其它值抛 1001', async () => {
  assert.equal((await reasons.createReason({ text: '增加专用理由', type: 'add' })).type, 'add')
  assert.equal((await reasons.createReason({ text: '减少专用理由', type: 'sub' })).type, 'sub')
  await assert.rejects(() => reasons.createReason({ text: '非法类型', type: 'xxx' }), (e) => e.code === 1001)
  const target = (await reasons.listReasons()).find((r) => r.text === '减少专用理由')
  await assert.rejects(() => reasons.updateReason(target.id, { type: 'xxx' }), (e) => e.code === 1001)
})

test('reason: 删除后可重新添加同名；删除不存在的 id 抛 1018', async () => {
  const created = await reasons.createReason({ text: '待删除理由' })
  const result = await reasons.removeReason(created.id)
  assert.equal(result.deleted, true)
  assert.ok(!(await reasons.listReasons()).some((r) => r.id === created.id))

  const again = await reasons.createReason({ text: '待删除理由' })
  assert.equal(again.text, '待删除理由')

  await assert.rejects(() => reasons.removeReason(99999), (e) => e.code === 1018)
})

test('reason: 删除常用理由不影响已写进流水的理由文本', async () => {
  const tid = await typeIdByName('调休卡')
  const fan = await fans.createFan({ nickname: '理由快照测试' })
  await fans.adjustFanCard({ fanId: fan.id, typeId: tid, delta: 1, reason: '活动奖励' })

  const target = (await reasons.listReasons()).find((r) => r.text === '活动奖励')
  await reasons.removeReason(target.id)

  const { list } = await fans.listFanLogs({ fanId: fan.id })
  assert.equal(list[0].reason, '活动奖励')
})
