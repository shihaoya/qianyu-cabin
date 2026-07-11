# 小屋游戏 · 通用架构设计

> 适用范围：本仓库内「小屋游戏」体系的设计与实现。架构决策（技术栈、模块边界、接口/数据库/鉴权契约）见 `ARCHITECTURE.md`；本文件只定义**游戏框架**这一子系统的设计，含：通用存档 / 排行榜 / 历史记录 / 跨端续玩，以及「新增一个游戏要改哪些文件」。
> 本文件内容与 `ARCHITECTURE.md`、`DEV-PC.md`、`DEV-MOBILE.md`、`DEV-SERVER.md` 互不冲突，且遵循其中的分层、响应结构、错误码、Prisma、鉴权约定。

---

## 1. 已确认的产品决策（来自 2026-07-11 讨论）

| # | 决策 | 说明 |
|---|---|---|
| D1 | 必须登录才能玩游戏 | 进入游戏前路由/接口均要求 `auth`；未登录跳登录（沿用现有 `auth` 中间件） |
| D2 | 排行榜在游戏**内**展示 | 排行榜不放在首页，由 `GameShell` 在游戏页内呈现；接口登录可见（非公开） |
| D3 | 每用户每游戏仅一个存档 | `GameSave` 唯一约束 `[userId, gameKey]`，无多槽位 |
| D4 | 进入有存档→确认继续/重开 | 打开游戏时若有存档，弹确认框「继续上局 / 重新开始」 |
| D5 | PC / 移动端各自实现游戏视图 | 操作逻辑（鼠标键盘 vs 触摸）不同，两端各写一份视图；但**状态契约一致**，存档可跨端续玩 |
| D6 | 记录平台，排行榜展示 | `GameSave` / `GameRecord` 均存 `platform`（`'pc'` / `'mobile'`）；榜单行展示平台 |
| D7 | 存档跨端通用 | `GameSave.state` 必须是**平台无关纯数据 JSON**（不含 DOM / Canvas 引用），PC 存、移动端取，反之亦然 |
| D8 | 排行榜内容每游戏自定义 | 各游戏自有计分语义（分数 / 用时 / 步数…），框架只提供「按 `score` 排序 + 展示 `detail`」的通用能力，具体列由 engine 定义 |
| D9 | 架构同时支持回合/数值类与实时类 | 两类游戏共用同一套存档/排行榜/历史；差异仅在 engine 的 `validateResult` 设计（见 §9） |

---

## 2. 分层总览

```
┌─ 前端（pc / mobile 各一份，按约定同步，不共享代码）──────────────┐
│  views/games/<Key>Game.vue  → 只写「游戏循环 + 渲染 + 输入」      │
│  components/GameShell.vue    → 通用外壳：暂停/存档提示/排行榜/历史 │
│  composables/useGame.js      → useGameSave / useGameLeaderboard   │
│  games/registry.js           → { key, name, icon, component } 单一真源 │
│  api/games.js                → 调后端                              │
└───────────────────────────┬───────────────────────────────────┘
                            │ HTTP /server/api/games
┌─ 后端 server ─────────────┴───────────────────────────────────┐
│  routes/games.js   → 仅分发，`:key` 参数化，一套路由服务所有游戏 │
│  controllers/gameController.js → 解析参数、校验、组装响应        │
│  services/gameService.js → 存档/历史/排行榜的通用 CRUD          │
│  games/<key>.js (engine) → 每游戏一个文件：validate + score     │
│  db (Prisma) → GameSave / GameRecord 两张表                     │
└────────────────────────────────────────────────────────────────┘
```

依赖方向同 `ARCHITECTURE.md §3`：`server` 不依赖前端；`pc`/`mobile` 仅经 HTTP 调 `/server/api`；`pc`/`mobile` 不共享代码，靠 `games/registry.js` 与 engine 文档约定保持同步。

**可维护性核心思想**：游戏「计分规则 + 结果校验」收口在后端 `engine`（单一真源），前端只渲染并上报一个**自校验的结果元组**。这样 pc/mobile 不必复制计分逻辑，也不违背「不共享代码」的硬规则；排行榜诚信由服务端保证。

---

## 3. 数据模型（`server/prisma/schema.prisma` 新增）

```prisma
model GameSave {
  id        Int      @id @default(autoincrement())
  userId    Int
  gameKey   String   // 对应 engine.key，如 "climb"
  state     String   // JSON：平台无关的游戏状态快照（必须可跨端反序列化）
  score     Int?     // 暂存时的当前进度/分数（便于「继续上局」直接展示）
  platform  String   @default("pc")  // "pc" | "mobile"，记录上次存档端
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@unique([userId, gameKey])   // D3：每用户每游戏一个存档
  @@index([gameKey])
}

// 一局结束 = 一条记录；历史与排行榜同源（排行榜=按用户取最佳派生）
model GameRecord {
  id         Int      @id @default(autoincrement())
  userId     Int
  gameKey    String
  score      Int      // 排序键（由 engine.score 计算，D8 语义各游戏自定）
  detail     String?  // JSON：每游戏自定义明细（用时/步数/难度…），供榜单/历史展示
  platform   String   @default("pc") // "pc" | "mobile"，D6 榜单展示
  finishedAt DateTime @default(now())
  @@index([gameKey, score])   // 排行榜排序
  @@index([userId, gameKey])  // 我的历史
}
```

设计要点：
- **不单独建排行榜表**：`gameService.leaderboard()` 用 `groupBy({ by:['userId'], _max:{score} })` 派生每用户最佳，再 `orderBy` 分数 + `finishedAt` 决胜。历史 = 该 `(userId, gameKey)` 的全部记录。一张表同时喂两个需求。
- `GameSave.state` 是**平台无关纯数据**，这是 D7 跨端续玩成立的前提（见 §6.4）。
- `platform` 由前端在请求体携带（见 §5），属展示性字段、非安全项。

---

## 4. 后端 engine 接口（每游戏唯一要写的后端文件）

路径：`server/src/games/<key>.js`，导出默认对象：

```js
export default {
  key: 'climb',                 // 与前端 registry、路由 :key 一致
  name: '千羽爬树',
  order: 'desc',                // 排行榜方向：'desc' 高分在前 | 'asc' 低分（用时）在前
  scoreLabel: '得分',           // 榜单主列中文名（D8）
  // 状态（存档）形状：{ lane, h, hp, score, bugsKilled, timeSurvived, shieldRemainingMs }
  //   lane：横向离散位置 0..5（3 棵树 × 左/右两侧）；h：沿树高度（上下连续）
  validateState(state) { /* 各字段类型/范围合法，防坏存档 */ },
  // 结果（结束上报）形状：{ score, bugsKilled, timeSurvived, hpLeft }
  // 校验「结束结果元组」是否自洽（防作弊核心），返回 true/false
  validateResult(result) { /* 例如：bugsKilled 与 score 守恒、hpLeft<=maxHp、timeSurvived 上限 */ },
  // 由结果算官方排序分（前端仅显示，最终以服务端为准）
  score(result) { return result.score },
  // 把 detail(JSON) 转成榜单/历史要展示的字段数组 [{ label, value }]
  formatDetail(detail) { /* 例如 [{label:'用时',value:'42s'},{label:'步数',value:18}] */ },
}
```

`server/src/games/registry.js`：`{ climb: (await import('./climb.js')).default, ... }`，新游戏仅在此登记一行。

---

## 5. 后端通用服务 / 控制器 / 路由

### 5.1 `services/gameService.js`（通用，不感知具体游戏）

| 方法 | 职责 |
|---|---|
| `getEngine(gameKey)` | 从 registry 取 engine；找不到抛 `1007` |
| `upsertSave({ userId, gameKey, state, score, platform })` | 先 `engine.validateState(state)`，再 upsert（唯一 `[userId,gameKey]`） |
| `getSave({ userId, gameKey })` | 取存档；无则返回 null |
| `clearSave({ userId, gameKey })` | 游戏正常结束/放弃时清档 |
| `addRecord({ userId, gameKey, result, platform })` | `engine.validateResult` → `engine.score` → 写 `GameRecord`；可选顺带 `clearSave` |
| `myHistory({ userId, gameKey, page, pageSize })` | 该用户该游戏的全部记录，倒序 |
| `leaderboard({ gameKey, page, pageSize })` | `groupBy` 派生每用户最佳，按 `engine.order` 排序，join 昵称，返回 `{ list, total }` |
| `catalog(userId)` | 列出所有游戏 + 当前用户是否有存档 + 个人最佳（供 Home 游戏区展示「有存档」标记） |

### 5.2 `controllers/gameController.js` + `routes/games.js`

全部用 `:key` 参数化（一套路由管所有游戏），沿用 `{ code, data, message }`：

| Method | Path | 鉴权 | 说明 |
|---|---|---|---|
| GET | `/api/games` | 可选 | 游戏目录（含当前用户存档标记/最佳） |
| GET | `/api/games/:key/save` | auth | 取当前用户存档；无则 `data:null` |
| PUT | `/api/games/:key/save` | auth | body `{ state, score?, platform }`；先 `engine.validateState`，失败 `1008` |
| GET | `/api/games/:key/records` | auth | 我的历史（分页） |
| POST | `/api/games/:key/records` | auth | body `{ result, platform }`；`engine.validateResult` 失败 `1009` → 算分入库 |
| GET | `/api/games/:key/leaderboard` | auth（D2 游戏内展示） | 排行榜（分页），含 `platform`、昵称、排名 |

> `platform` 由前端在 PUT/POST 的请求体里带 `'pc'` / `'mobile'`，控制器透传给 service 落库。

---

## 6. 前端架构（pc / mobile 各自实现，保持契约一致）

### 6.1 游戏注册表 `games/registry.js`（单一真源）

把现有 `Home.vue` 里的静态 `games` 数组抽成注册表，新增游戏只改此处：

```js
// pc/src/games/registry.js 与 mobile/src/games/registry.js（结构一致，组件各自 lazy import）
export const GAMES = [
  { key: 'climb', name: '千羽爬树', icon: 'climb', component: () => import('../views/games/ClimbGame.vue') },
]
export function getGame(key) { return GAMES.find((g) => g.key === key) }
```

`GameArea` 改为读注册表；`catalog` 接口返回「是否有存档」后，可在卡片上标「继续」角标。

### 6.2 通用外壳 `components/GameShell.vue`

提供与具体游戏无关的外壳，游戏视图通过 `<slot/>` 注入棋盘/画布：

- 顶部：游戏名 + 「暂停」按钮 + 存档状态提示（如「上次在手机端玩到一半」）
- 中部：`<slot name="board" />` 游戏内容
- 侧/底：`排行榜` 面板（`useGameLeaderboard` 拉取，行内展示 `platform` 图标 + 昵称 + `scoreLabel` + `formatDetail`）与 `历史` 入口

### 6.3 通用 composable `composables/useGame.js`

```js
useGameSave(gameKey)      // load() 进页调用；save(state,score) 暂停/定时自动存档；clear() 结束清档
useGameLeaderboard(gameKey) // 拉榜单、暴露当前用户高亮
```

游戏视图**不直接调 `api/games.js`**，统一走 composable，保证存档/榜单逻辑只写一遍。

### 6.4 跨端续玩的状态契约（D5/D7 关键）

- 每个游戏在 engine 注释 + 前端约定一份 **`state` 形状说明**（纯 JSON：数字/字符串/数组/嵌套对象，绝不含 DOM/Canvas/组件实例）。
- PC 与移动端的 `<Key>Game.vue` **状态字段名与类型必须一致**；仅「输入方式 + 渲染布局」不同。
- 序列化：`JSON.stringify(state)` 上传；反序列化：`JSON.parse` 后恢复。两端用同一份形状说明，故 PC 存的档移动端能原样读、继续玩，反之亦然。
- 兼容性：若某游戏未来改了 `state` 形状，旧存档 `engine.validateState` 会失败 → 视图按「无存档」处理并提示「旧存档已失效，开始新局」。状态版本化（如 `state.v`）留作后续扩展，本期不强制。

### 6.5 每游戏两个视图（pc + mobile）

| 文件 | 内容 |
|---|---|
| `pc/src/views/games/<Key>Game.vue` | 键盘/鼠标输入 + 桌面布局 + 调 `useGameSave`/`useGameLeaderboard` |
| `mobile/src/views/games/<Key>Game.vue` | 触摸输入 + 移动布局 + 同样的 composable 调用 |

两者共享 §6.4 的状态契约，逻辑尽可能一致，仅操作/UI 差异。

---

## 7. 暂停 / 续玩生命周期（D3/D4）

```
打开游戏页（已登录）
  └─ mount → useGameSave.load()
       ├─ 有存档 → 弹确认框：「继续上局（上次在 <platform> 端）」/「重新开始」
       │           继续 → resume(state)；重开 → clearSave() + 新局
       └─ 无存档 → 新开局
游戏中（暂停）
  └─ 冻结循环 + 防抖自动存档 PUT save（带 state + 当前 score + platform）
关闭/掉线
  └─ 存档已在服务端（按 userId+gameKey 绑账号）
下次同账号登录、再进该游戏
  └─ load() 取到上次存档 → 弹确认框续玩（满足 D4「自动确认是否继续」）
正常结束
  └─ POST records（算分入库）→ clearSave() 清掉续玩档
放弃
  └─ 显式「放弃本局」→ clearSave()
```

---

## 8. 排行榜（每游戏自定义，D2/D8）

- 通用服务只负责：`groupBy` 出每用户最佳 `score` → 按 `engine.order` 排序 → 返回 `{ list:[{ rank, nickname, score, detail, platform, finishedAt }], total }`。
- 具体**列名/明细**由 engine 定义：`scoreLabel`（主列名）、`formatDetail(detail)`（返回 `[{label,value}]`）。`GameShell` 渲染时调用 `formatDetail` 展示每行列，并显示 `platform` 图标（PC/手机）。
- 因 D2，排行榜在游戏内、登录可见，不公开。

---

## 9. 游戏类型说明（回合/数值类 vs 实时操作类）

> 这是给产品/设计同学的解释，不涉及架构分叉——两类游戏共用本文全部设计，差异只在 engine 怎么写。

- **回合 / 数值 / 解谜类**（如爬树、2048、数独、种田放置）：
  游戏过程由一系列离散「步」组成，最终能汇总成几个确定数字（步数、用时、收集数、得分）。结束时报一个 `result = { moves, time, collected, ... }`，后端 `validateResult` 很容易校验自洽、`score` 直接计算。**最贴合本架构，作弊难、实现轻。**

- **实时操作类**（如跑酷、音游、平台跳跃）：
  过程连续、靠手速/反应，没有干净的「步」可数。要做诚信榜单，需把**操作序列或关键事件流**也上报（如 `[{t:12,act:'jump'},...]`），`validateResult` 要能重放/校验这条流是否合理并算分，engine 更重、带宽更大。**本架构照样支持**（存档/榜单/历史全通用），只是第一个这类游戏时 engine 设计要多花心思。

**结论**：架构对两类一视同仁；建议**第一个游戏先做回合/数值类**上手（如把「千羽爬树」做成数值/解谜类），实时类后续按同一套骨架接入即可。

---

## 10. 新增一个游戏 = 改动清单

| 端 | 文件 | 内容 |
|---|---|---|
| server | `src/games/<key>.js` | engine：validateState / validateResult / score / order / formatDetail |
| server | `src/games/registry.js` | 登记一行 |
| pc | `src/games/registry.js` | 登记（含 lazy component） |
| pc | `src/views/games/<Key>Game.vue` | 游戏视图（只写循环 + 状态契约） |
| mobile | `src/games/registry.js` | 登记（镜像） |
| mobile | `src/views/games/<Key>Game.vue` | 移动端视图（镜像状态契约） |

存档、排行榜、历史、暂停续玩、跨端续玩、防作弊校验——**零额外代码**。

---

## 11. 错误码（待登记 `DEV-SERVER.md §10`）

| code | HTTP | 含义 | 引入接口 |
|---|---|---|---|
| 1007 | 404 | 游戏不存在（gameKey 未注册） | `GET/PUT/POST /api/games/:key/*` |
| 1008 | 400 | 存档状态非法（engine.validateState 失败） | `PUT /api/games/:key/save` |
| 1009 | 400 | 结束结果非法（engine.validateResult 失败） | `POST /api/games/:key/records` |

> 实现时同步登记到 `DEV-SERVER.md §10`，保证 PC/移动端一致。

---

## 12. 待确认 / 后续可扩展

- **全局总榜**：本期只做「每游戏榜」（D2 游戏内）。是否要一个跨游戏的总积分榜？默认不做。
- **状态版本化**：本期靠 `validateState` 失败兜底；是否要显式 `state.v` 做迁移，留待首个游戏定型后定。
- **首游戏选型**：建议先做回合/数值类（见 §9）；具体做哪个游戏待定。
- **平台标识**：由前端在请求体带 `platform`（非安全项），是否认可？
