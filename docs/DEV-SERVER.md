# 服务端开发规范

> 适用范围：`server/` 项目。架构决策见 `ARCHITECTURE.md`。已落地：Express + Prisma(SQLite v6) + JWT，分层 `routes→controllers→services→db`，含统一响应/错误码/`auth` 中间件、`User` 表（已 migrate）。
> 本规范用于保证后端分层清晰、响应一致、错误可预期，便于 PC/移动端对接。
> 注意：Prisma 固定 **v6**（v7 改了 schema 规则、需 TS config + adapter，对单体 SQLite 过重，不使用）。

## 1. 目录结构

```
server/
├── prisma/
│   └── schema.prisma        # 数据模型（遵循 ARCHITECTURE.md §4 规范）
├── src/
│   ├── config/index.js      # 环境变量集中读取与校验
│   ├── db/index.js          # PrismaClient 单例
│   ├── middleware/
│   │   ├── auth.js          # JWT 校验中间件（auth 硬鉴权 / optionalAuth 软鉴权）
│   │   ├── requireAdmin.js  # 仅 admin（开发者）可访问
│   │   └── error.js         # 统一错误处理中间件
│   ├── routes/              # 路由（仅做分发，不含业务逻辑）
│   │   ├── guestbook.js     # 留言板（POST 支持匿名）
│   │   └── admin.js         # 用户管理（仅开发者）
│   ├── controllers/         # 控制器（解析入参、调用 service、组装响应）
│   │   ├── guestbookController.js
│   │   └── adminController.js
│   ├── services/            # 业务逻辑（与数据库交互，可复用）
│   │   ├── guestbookService.js
│   │   └── userService.js   # 注册/登录/查用户/改角色/分页列表
│   ├── utils/
│   │   ├── response.js      # 统一响应 { code, data, message }
│   │   └── errors.js        # 业务错误类（携带 code/httpStatus）
│   └── server.js            # 入口：组装 app、挂载路由、注册错误中间件
├── .env                     # 运行配置（不入库）
└── package.json
```

## 2. 分层职责（依赖单向）

`routes → controllers → services → db`，反向禁止：

- **routes**：仅声明路径与方法，委托给 controller；不含业务逻辑与 try/catch。
- **controllers**：解析/校验请求参数，调用 service，用 `response.js` 返回；负责 HTTP 层关注点（状态码映射）。
- **services**：纯业务逻辑，直接操作 Prisma；可被多个 controller 复用；不感知 HTTP。
- **db**：仅暴露 PrismaClient 单例，不含业务。

## 3. 命名约定

- 文件/目录：`kebab-case`（如 `authController.js`、`userService.js`）。
- 路由文件：`kebab-case` 复数或资源名（`auth.js`、`games.js`）。
- 函数：`camelCase`；导出对象 `camelCase`（如 `authController`）。
- 变量：`camelCase`；常量：`UPPER_SNAKE_CASE`。

## 4. 统一响应结构

所有响应经 `utils/response.js` 构造，严格遵循架构文档 §5：

- 成功：`ok(data)` → `{ code: 0, data, message: 'ok' }`，HTTP 200。
- 失败：`fail(code, message, httpStatus)` → `{ code, data: null, message }`，HTTP 取对应状态码（参数/业务 400、未认证 401、无权限 403、不存在 404、服务端 500）。
- controller/route 不直接 `res.json` 手写结构，统一走 `response.js`，保证前后端契约一致。

## 5. 错误处理

- 业务错误抛 `AppError(code, message, httpStatus)`（`utils/errors.js`）。
- 全局错误中间件（`middleware/error.js`）兜底：捕获 `AppError` 走 `fail`；未知错误记日志后返回 `code=5000`、`message='服务器开小差了'`，**不向前端泄露堆栈**。
- async 路由用 `try/catch` 或包裹器（`asyncHandler`）把异常导向错误中间件，禁止吞异常、禁止裸 `catch{}`。
- 入参校验前置：在 controller 层用轻量校验（自建 `validate` 工具或显式判断），失败抛 `AppError(1001~1xxx, '参数错误', 400)`；具体业务码值在新增接口时于本文件「错误码登记」处追加。

## 6. 鉴权（JWT）

- `middleware/auth.js`：读 `Authorization: Bearer <token>`，用 `jsonwebtoken` 校验；失败抛 `AppError(1004, '未登录或登录失效', 401)`。
- 受保护路由在 routes 中 `use(auth)`。
- JWT 密钥与过期时间来自 `config`（env：`JWT_SECRET`、`JWT_EXPIRES_IN`）；`JWT_SECRET` 须为强随机值，绝不硬编码。
- 密码校验用 `bcryptjs.compare`；注册时 `bcryptjs.hash`（cost 适中，如 10）。

## 7. 配置

- 所有运行参数经 `dotenv` 载入，由 `config/index.js` 集中读取与启动校验（缺失关键项则启动失败并打印明确信息）。
- 必要项：`PORT`（默认 3000）、`JWT_SECRET`、`JWT_EXPIRES_IN`、`DATABASE_URL`（Prisma 用）。
- 不在代码中写死端口、密钥、路径。
- 环境变量文件：`.env`（含密钥，**不入库**，已被 `.gitignore` 忽略）；提供 `.env.example` 作为模板（入库）。生产部署通过平台环境变量注入或该 `.env` 提供，绝不把 `JWT_SECRET` 等提交到仓库。

## 8. Prisma 使用

- `db/index.js` 导出单例 `prisma`，全局复用，不在请求内 `new PrismaClient()`。
- 模型定义在 `schema.prisma`，遵循架构文档 §4 规范（PascalCase 单数、camelCase 字段、`createdAt`、密码 `passwordHash` 等）。
- 结构变更走 `prisma migrate`（`prisma migrate dev` 开发 / `prisma migrate deploy` 生产）；禁止手改库或手编 SQL 改结构。
- 查询结果与返回给前端的对象，**剔除 `passwordHash` 等敏感字段**（用 `select` 或显式映射）。

## 9. 日志与可靠性

- 结构化日志：关键路径（注册、登录、关键写操作、所有错误）输出 `level + 时间 + 上下文`；生产可降级级别。
- 不在响应中泄露内部实现细节；错误中间件统一收口。
- 数据库操作为原子；涉及多步写用 Prisma transaction，避免半成品数据。
- 列表接口遵循分页约定（`page`/`pageSize`，返回 `{ list, total }`）。

## 10. 错误码登记（随接口增长追加）

| code | HTTP | 含义 | 引入接口 |
|---|---|---|---|
| 0 | 200 | 成功 | - |
| 1001 | 400 | 参数错误 | 通用 |
| 1002 | 400 | 昵称已存在 | 注册 |
| 1003 | 401 | 昵称或密码错误 | 登录 |
| 1004 | 401 | 未登录/登录失效 | 鉴权中间件 |
| 1005 | 403 | 无权限（非管理角色） | requireAdmin 中间件（requireCap('manageUsers')） |
| 1006 | 401 | 原密码不正确 | 修改密码 `POST /auth/change-password` |
| 1007 | 404 | 游戏不存在（gameKey 未注册） | 游戏相关接口 `GET/PUT/POST/DELETE /api/games/:key/*` |
| 1008 | 400 | （已废弃）原「存档状态非法」；`PUT /api/games/:key/save` 现已改为**不校验、原样存储**（前端传什么存什么），此码不再返回，保留登记 | `PUT /api/games/:key/save` |
| 1009 | 400 | 游戏结果非法（engine.validateResult 失败） | `POST /api/games/:key/records` |
| 1010 | 404 | 福利类型不存在 | `PATCH/DELETE /api/benefit-types/:id`、`POST /api/fans/:id/cards/adjust` |
| 1011 | 400 | 福利类型名称重复 | `POST /api/benefit-types`、`PATCH /api/benefit-types/:id` |
| 1012 | 400 | 仍有粉丝持有该类型的卡，不能删除 | `DELETE /api/benefit-types/:id` |
| 1013 | 404 | 粉丝不存在 | `PATCH/DELETE /api/fans/:id`、`GET/POST /api/fans/:id/*` |
| 1014 | 400 | 卡数量不足（扣减后为负） | `POST /api/fans/:id/cards/adjust` |
| 1015 | 400 | 未填写增减卡的理由 | `POST /api/fans/:id/cards/adjust` |
| 1016 | 400 | 调整数量非法（非整数或为 0） | `POST /api/fans/:id/cards/adjust` |
| 1017 | 400 | 常用理由已存在 | `POST /api/benefit-reasons`、`PATCH /api/benefit-reasons/:id` |
| 1018 | 404 | 常用理由不存在 | `PATCH/DELETE /api/benefit-reasons/:id` |
| 1019 | 404 | 用户不存在 | 用户管理相关接口 |
| 1020 | 400 | 未选择要上传的文件 | `POST /api/files` |
| 1021 | 404 | 文件不存在 | `GET /api/files/:id/raw`、`DELETE /api/files/:id` |
| 1022 | 404 | 礼品不存在 | `PATCH/DELETE /api/raffles/prizes/:id` |
| 1023 | 400 | 礼品名称重复 | `POST /api/raffles/prizes`、`PATCH /api/raffles/prizes/:id` |
| 1024 | 400 | 当前没有可抽取的礼品 | `POST /api/raffles/draw` |
| 1025 | 400 | 抽奖次数非法（非 1~100 整数） | `POST /api/raffles/draw` |
| 1026 | 400 | 批量增减的条目非法（空数组 / 非整数 delta / delta 为 0 / 重复 typeId） | `POST /api/fans/:id/cards/adjust-batch` |
| 1027 | 400 | 系统自带礼品不能编辑或删除（请到「福利管理」里操作） | `PATCH/DELETE /api/raffles/prizes/:id`（`benefitTypeId != null` 时） |
| 5000 | 500 | 服务端未知错误 | 错误中间件 |

> 新增业务错误码时，在此表登记并在对应接口文档/注释说明，保证 PC/移动端一致。下一个可用业务码：**1028**。

### 游戏存档接口：不校验、原样存

`PUT /api/games/:key/save` 只做「游戏存在性」确认，**不对上报的 `state` 做任何业务校验**，前端传什么就 `JSON.stringify` 原样入库（`score`/`platform` 也原样保留，仅做 DB 类型兜底，不拒绝、不归一化）。理由：存档是用户自己的「续玩」数据，跨端续玩要求状态完整可逆，后端不应因形状判断而丢弃合法存档。

与之区分：`POST /api/games/:key/records`（结束一局上报成绩）仍走 `engine.validateResult` + `engine.score` 算分入库——这是排行榜防作弊的单一真源，**保留校验**，不受影响。

**错误响应契约（前端归一化依赖此约定）**：无论 HTTP 状态是 2xx 还是 4xx/5xx，响应体一律是 `{ code, data:null, message }`，`message` 必须是可直接展示给用户的中文文案。前端响应拦截器据此在「业务失败（2xx+code≠0）」和「HTTP 失败（非 2xx）」两种情况下都能取到 `message` 并归一化展示（见 `DEV-PC.md` §6/§8）。因此后端**禁止**返回没有 `message` 的裸错误、或仅靠 HTTP 状态码表意；未知错误统一 `5000 + 通用中文文案`，不泄漏堆栈。

## 11. 构建与运行

- 开发：`pnpm dev`（`node --watch src/server.js`）。
- **数据库迁移**：
  - **开发环境**（改了 `schema.prisma` 后）：`pnpm db:migrate`（= `prisma migrate dev`），会提示输入迁移名称，生成迁移文件并应用。只在开发时用。
  - **生产环境**（部署时）：`pnpm db:deploy`（= `prisma migrate deploy`），按迁移历史把库升到最新，不生成新迁移。部署文档用的就是这个。
  - 查看数据库（调试用）：`pnpm db:studio`（= `prisma studio`），打开 Prisma Studio 可视化查看/编辑数据。
- 生产：守护进程运行 `src/server.js`（pm2 / systemd），经 nginx 反代（见 `DEPLOYMENT.md`）。
- 启动自检：配置缺失则退出并提示；`pnpm db:generate`（= `prisma generate`）在部署脚本中执行，重新生成 Prisma Client。

## 12. 排错（pnpm 与 Prisma 构建脚本）

**问题**：pnpm 11 在执行任何 `pnpm <命令>`（如 `pnpm dev`、`pnpm prisma ...`）前会跑依赖校验，默认**禁止 `@prisma/client` 的构建脚本**，导致校验直接失败、命令起不来。此问题在 Prisma v6 下出现。

**已落地解法（推荐）**：在 `server/pnpm-workspace.yaml` 加构建白名单，pnpm 11 即可放行 Prisma 的构建脚本：

```yaml
onlyBuiltDependencies:
  - "@prisma/client"
  - "@prisma/engines"
  - "prisma"
```

加完后正常用法恢复：

```bash
cd server
pnpm install            # 批准后即放行 Prisma 构建
pnpm dev                # node --watch src/server.js
pnpm db:generate        # 重新生成 Prisma Client（= prisma generate）
pnpm db:migrate         # 开发环境迁移（= prisma migrate dev）
pnpm db:deploy          # 生产环境迁移（= prisma migrate deploy）
pnpm db:studio          # 可视化查看数据库（= prisma studio）
```

**应急绕过（白名单未生效时）**：直接用 `node` 调 Prisma CLI，跳过 pnpm 包装器：

```bash
cd server
node node_modules/prisma/build/index.js generate
node node_modules/prisma/build/index.js migrate dev --name <name>
```

**其它约定**：
- 切勿改用 `pnpm approve-builds` 手批——它会交互、不利于非交互部署；以 `pnpm-workspace.yaml` 白名单为准。
- `.npmrc` 的 `dangerously-allow-all-builds` 在本机 pnpm 11 下仍被 `verify-deps-before-run` 拦截，不可靠，不要用。
- 数据库文件 `*.db` 在 `.gitignore` 已忽略；`prisma/schema.prisma` 与 `prisma/migrations/` 需入库。

## 13. 角色、留言板与用户管理约定

### 13.1 角色模型（User.role）

- 取值：`"user"`（用户）| `"admin"`（管理员（开发者））| `"owner"`（开发管理员（站长），仅本人）。默认 `"user"`（见 `schema.prisma`）。层级 `user < admin < owner`。
- JWT 载荷携带 `role`，`auth` 中间件把 `req.user.role` 透传给下游；`publicUser` 在登录响应里一并返回 `role`。
- 角色与权限的**单一真源在 `src/permissions.js`**：`ROLE_RANK`（层级）、`CAP_ROLE`（能力→最低角色）、`can(user, cap)`（判定）。前端同样维护一份语义一致的 `permissions.js`。前端按 `can(user, 'manageUsers')` 渲染入口 / 守卫（见 `DEV-PC.md`/`DEV-MOBILE.md` 的路由章节）。
- 改角色走 `userService.setRole`，不在此处做密码等敏感字段回显。

### 13.2 匿名留言板（Message）

- 模型 `Message`：`content` 必填，`isAnonymous` 标记，`userId`/`nickname` 可空。
- **匿名 = 不存储任何身份信息**：`POST /api/guestbook` 经 `optionalAuth` 软鉴权——带合法 token 则记录 `userId`+`nickname` 并置 `isAnonymous=false`；无 token 或匿名勾选时 `userId`/`nickname` 均为 `null`、`isAnonymous=true`。**绝不落库 IP、邮箱等可定位身份的数据。**
- 内容校验前置：`createMessage` 在 service 层判空与长度（≤500），失败抛 `AppError(1001)`。
- 列表 `GET /api/guestbook` 返回倒序留言（含 `isAnonymous`/`nickname`），供首页/留言页展示。

### 13.3 仅开发者可见的用户管理

- 双重拦截：前端路由守卫 `can(auth.user,'manageUsers')`（无权限直接跳首页）+ 后端 `middleware/requireAdmin.js`（= `requireCap('manageUsers')`，非管理角色返回 `1005`）。两端缺一会漏权限。
- 列表 `GET /api/admin/users`：`userService.listUsers` 分页返回 `{ list, total }`，`select` 剔除 `passwordHash`。
- 改角色 `PATCH /api/admin/users/:id/role`：`adminController` 调 `setRole`；**禁止修改自己的角色**（避免锁死），且仅 `owner` 可把他人设为 `owner`，违例抛 `AppError(1005)`。
- 提升账号：开发期脚本 `node scripts/promote-owner.js <昵称>`（把账号置为 `owner`），仅本人使用。

> 权限边界是安全红线：任何新增的「管理类」接口都必须挂 `requireAdmin`（底层 `requireCap`，统一走 `permissions.can`），且前端对应入口/路由同步用 `can(user,'...')` 判断——**权限语言单一真源在 `src/permissions.js`**，新增能力先在 `CAP_ROLE` 登记。

## 14. 福利管理约定（福利类型 / 粉丝 / 卡）

### 14.1 数据模型（server/prisma/schema.prisma）

四个模型，与既有模型一致**不使用 Prisma relation**（无外键），跨表数据靠二次查询手工拼接：

| 模型 | 作用 | 关键约束 |
|---|---|---|
| `BenefitType` | 福利类型（如「加班卡」「减班卡」） | `name` 唯一 |
| `Fan` | 粉丝档案 | 仅 `nickname` 必填；`userId` 可空 + `systemAccount` 昵称快照；`douyinAccount`/`remark` 可选 |
| `FanBenefit` | 粉丝持有的某类型卡数量 | `@@unique([fanId, typeId])`，一个粉丝每种类型至多一条 |
| `BenefitLog` | 增减流水，**只增不改不删** | 存 `delta`、`balance`、`reason`、`createdAt`、`operatorId/Name`、`fanNickname`/`typeName` 快照 |
| `BenefitReason` | 常用理由短语，增减卡时一键带入 | `text` 唯一；删 **不级联**到流水，流水里的 `reason` 是独立文本 |

**Snapshot 冗余原则**：流水里的粉丝名 / 类型名做快照而非外键联查——粉丝被删除、类型被重命名后，历史记录依然可读可追溯。粉丝改名时同步刷新其流水的 `fanNickname`。

### 14.2 接口（`routes/benefitTypes.js`、`routes/fans.js`）

统一挂 `auth` + `requireBenefitsAdmin`（= `requireCap('manageBenefits')`，管理员与开发管理员可用）：

```
GET    /api/benefit-types              类型列表（含 holderCount：持有该类型的粉丝数）
POST   /api/benefit-types              新增
PATCH  /api/benefit-types/:id          改名/改说明
DELETE /api/benefit-types/:id          删除（有人持有则 1012）
GET    /api/benefit-reasons            常用理由列表（按新增顺序）
POST/PATCH/DELETE  /api/benefit-reasons[/:id]   常用理由增删改（重名 1017，不存在 1018）

GET    /api/fans                       粉丝列表（page/pageSize/keyword，含 cards 概览）
POST   /api/fans                       新增
PATCH  /api/fans/:id                   编辑
DELETE /api/fans/:id                   删除（连带清空其持有的卡，流水保留）
GET    /api/fans/:id/cards             该粉丝各类型卡数量（未持有也返回，amount=0）
POST   /api/fans/:id/cards/adjust      增减卡 { typeId, delta, reason }
POST   /api/fans/:id/cards/adjust-batch 批量增减 { reason, items:[{ typeId, delta }] }，整批一个事务 + 一个共用理由
GET    /api/fans/:id/logs              增减记录倒序分页

GET    /api/me/benefits                「我的福利」：按当前登录 userId 反查粉丝档案，返回卡状态 + 最近发放记录（**只需登录**，不要求管理员）
```

### 14.3 业务红线

- **增减必须留痕**：`adjustFanCard` 在同一事务内更新 `FanBenefit` 并写 `BenefitLog`，二者不可只做一个；`reason` 必填、`delta` 必须为不为 0 的整数。
- **批量增减是一个事务**：`adjustFanCardsBatch` 抽出 `adjustFanCardTx({..., tx})` 核心（单条 `adjustFanCard` 只是包一层自己的 `$transaction`），批量时在**一个** `$transaction` 里顺序执行每一条；任何一条失败（如余额不足 1014）整批回滚。`items` 不允许重复 `typeId`（1026），`reason` 整批共用（必填、≤100 字）。
- **余额不可为负**：扣减后小于 0 抛 `1014`，提示携带当前剩余数量。
- **类型删除受保护**：`amount > 0` 的持有记录存在时拒绝删除（`1012`）；删除类型会顺带清理数量为 0 的残留 `FanBenefit`。
- **系统内账号必须真实**：`userId` 传入时需能查到 `User`，否则 `1001`；传 `null`/空串表示解除关联。
- **粉丝列表按昵称 A→Z 排序**：`listFans` 用 `orderBy: [{ nickname: 'asc' }, { id: 'asc' }]`（SQLite 文本二进制升序），前端不再自行排序。
- **常用理由带类型**：`BenefitReason.type` 取值 `common`（公共，增加/减少都能一键带入）/ `add`（仅增加时用）/ `sub`（仅减少时用），**缺省与空值一律按 `common`**，因此旧数据、旧客户端（不传 type）无需改动即可继续使用；类型非法抛 `1001`。详见 §14.4。
- **「我的福利」只走 token，不接受 id 入参**：`GET /api/me/benefits` 用 `req.user.id` 反查 `Fan.userId`，因此天然无越权读他人卡的可能；账号尚未被登记为粉丝是**正常状态**，返回 `{ bound:false, cards:[], logs:[] }` 交给前端做友好提示，不要报业务错误。
- **常用理由只是输入法**：`BenefitReason` 仅供前端快捷带入，服务端仍按常规校验该次增减的 `reason`（必填、≤30 字、去空格后判重）；删除常用理由**不得**改动任何已写入的流水。
- 分页入参沿用既有范式（`page`/`pageSize` clamp，`pageSize` 上限 50）。

### 14.4 常用理由的类型（兼容性要点）

`BenefitReason.type` 决定这条短语在增加还是减少时出现，取值单一真源在 `services/benefitReasonService.js` 的 `REASON_TYPES`：

| type | 含义 | 前端表现 |
|---|---|---|
| `common` | 公共理由（**默认**） | 增加、减少两个面板都能一键带入 |
| `add` | 增加理由 | 只在点「＋」打开的面板里出现 |
| `sub` | 减少理由 | 只在点「－」打开的面板里出现 |

- **向下兼容**：字段带 `DEFAULT 'common'`（迁移 `add_benefit_reason_type` 会把旧表重建为该默认值），因此①历史数据自动成为公共理由；②接口不传 `type` 时按 `common` 处理；③`PATCH` 只改文本、不带 `type` 时保留原类型。
- 文本仍全局唯一（与类型无关），重复抛 `1017`；类型非法抛 `1001`。
- 前端拉取列表后自行按方向筛选（`common` + 当前方向），服务端不区分过滤，保持接口简单。

## 15. 文件上传约定（UploadedFile / fileService）

### 15.1 模型与存储

- 模型 `UploadedFile`（`prisma/schema.prisma`）：`originalName`（原始文件名快照）、`mimeType`（客户端申报，仅展示）、`size`、`ext`（规范化小写扩展名）、`storageKey`（磁盘相对路径，`yyyy/MM/dd/uuid.ext`，唯一）、`category`（业务分类，默认 `general`）、`uploaderId`。
- 文件落盘在 **`server/file/`**（由 `UPLOAD_DIR` 配置，默认 `file`，已在 `server/.gitignore` 忽略，不入库）。目录按日期分层，文件名一律 UUID，**绝不使用用户原始文件名做磁盘名**（防路径穿越与覆盖）。
- **关联方式：id 关联，不用外键**。业务表加 `xxxFileId Int?` 字段存 `UploadedFile.id` 即可；与福利模块一致不使用 Prisma relation。
- **扩展性红线**：所有「文件 ↔ 磁盘」的读写只许出现在 `services/fileService.js`。未来迁移 OSS/S3 时只改该文件（`saveUpload`/`resolveStoragePath` 一族），controller 与业务方无感。

### 15.2 接口（`routes/files.js`，统一挂 `auth`）

```
POST   /api/files               上传（multipart，field 名 "file"，可多文件；可带 category）
                                单文件返回文件对象，多文件返回数组
GET    /api/files/extensions    扩展名白名单下发（前端上传组件据此预校验）
GET    /api/files?ids=1,2,3     按 id 批量回显文件信息 { id, name, size, mimeType, category, url, createdAt }
GET    /api/files/:id/raw       流式读取（鉴权后；支持 Range，音视频可拖动）
DELETE /api/files/:id           删除（记录 + 磁盘；当前未对普通用户开放，按业务挂 requireCap）
```

- `serializeFile()` 返回的 `url` 是 `/api/files/:id/raw` 路径；**该接口需 Authorization 头**，浏览器 `<img>/<video>` 直接挂 src 带不了 token，前端展示统一用 `fetchFileObjectURL(id)` 换本地 ObjectURL（见 DEV-PC.md §12）。
- 上传走 `multer` **内存接收**（不落临时目录）：校验通过才写磁盘，写库失败回删磁盘文件，不留孤儿。大小/数量超限由 multer limits 拦截，错误统一转中文 `1001`（`fileController.handleUploadError`）。
- 扩展名白名单单一真源：`fileService.ALLOWED_EXTENSIONS`。新功能需要新类型时在此登记，前端 `accept` 同步放开；不在名单抛 `1001`。

### 15.3 配置（env）

| 变量 | 默认 | 含义 |
|---|---|---|
| `UPLOAD_DIR` | `file` | 上传根目录（相对 server/） |
| `UPLOAD_MAX_FILE_SIZE` | `10485760` | 单文件大小上限（字节，10MB） |
| `UPLOAD_MAX_FILES` | `10` | 单请求文件数上限 |

### 15.4 新业务接入上传的步骤

1. 业务表加 `xxxFileId Int?` 字段 + 迁移，存 `UploadedFile.id`。
2. 前端用 `BaseUpload` 组件（`v-model="form.xxxFileId"`，`category` 传业务名，如 `avatar`），提交表单时把 id 随业务数据一起提交。
3. 回显时按 `xxxFileId` 调 `GET /api/files?ids=` 或 `fetchFileObjectURL`。
4. 业务对象删除时按需决定是否调 `DELETE /api/files/:id` 清理文件（不自动级联）。

## 16. 抽奖约定（RafflePrize / RaffleRecord）

### 16.1 数据模型（server/prisma/schema.prisma）

两个模型，与福利模块一致**不使用 Prisma relation**，跨表靠二次查询拼接：

| 模型 | 作用 | 关键约束 |
|---|---|---|
| `RafflePrize` | 奖池礼品 | `name` 唯一；`imageFileId Int?` 关联 `UploadedFile.id`（category=`raffle-prize`，非必填）；`weight`（整数权重，0 = 移出奖池）；`stock`（-1 无限制，0 = 已抽完）；`enabled` 停用开关；`@@index([enabled, stock])` |
| `RaffleRecord` | 抽奖流水，**只增不改不删** | 存 `prizeId`、`prizeName` 快照、`fanId`/`fanNickname` 快照（可空 = 未指定粉丝）、`operatorId/operatorName` 快照；`@@index([prizeId, createdAt])`、`@@index([fanId, createdAt])` |

**Snapshot 冗余原则**：记录里的礼品名 / 粉丝名做快照——礼品删除、粉丝改名后历史记录依然可读（与 §14.1 的 BenefitLog 同理）。

### 16.2 接口（`routes/raffles.js`）

统一挂 `auth` + `requireRaffleAdmin`（= `requireCap('manageRaffle')`，管理员与开发管理员可用）：

```
GET    /api/raffles/prizes          礼品列表（含图片信息，返回实时 probability）
POST   /api/raffles/prizes          新增 { name, imageFileId?, weight, stock }
PATCH  /api/raffles/prizes/:id      改名/权重/库存/启停
DELETE /api/raffles/prizes/:id      删除（已有抽奖记录仍保留，见快照原则）
POST   /api/raffles/draw            抽奖 { count:1~100, fanId? }
                                    返回 { records:[{ id, prizeId, prizeName, fanNickname, createdAt }] }
GET    /api/raffles/records         抽奖记录（page/pageSize，可按 prizeId/fanId 过滤）
```

### 16.3 中奖率设计（权重而非百分数）

- 存的是**整数权重**而非百分比。某礼品的中奖率 = 该礼品权重 ÷ 所有「可用」礼品权重之和，前端实时显示。
- **可用奖池**（单一真源在 `services/raffleService.js` 的 `availableWhere`）：`enabled AND weight > 0 AND (stock = -1 OR stock > 0)`。**权重为 0、库存为 0、停用的礼品物理上不会被抽到**——不存在"归 0 还被抽中"的问题。
- 新增/停用/抽完某个礼品时，其余礼品的中奖率自动重归一化，无需人工调整任何百分比。
- `weight` 允许 0（用来"保留配置但暂时移出奖池"），但不允许负数；`stock` 允许 -1（无限制）与 0（已抽完，不可再中），但不允许小于 -1。

### 16.4 抽奖事务（库存与记录必须同事务）

- 每次抽奖（`draw`）在**一个** `prisma.$transaction` 内完成：按权重随机挑选（`pickOne`）→ 扣减库存（`stock = -1` 跳过）→ 插入 `RaffleRecord` 快照。
- **连抽 N 次 = 一个事务循环 N 次**：任何一次失败（如事务中途库存变化）整批回滚，不留半成品。
- 事务内每轮都基于 `availableWhere` 重新取池，所以一次连抽中某礼品抽完后，后续轮次不会再选中它。

### 16.5 系统自带礼品（与福利类型联动）

`RafflePrize.benefitTypeId Int? @unique` 关联 `BenefitType.id`：**非空 = 系统自带礼品**，由「福利类型」单向同步生成，不可在抽奖管理里编辑/删除（只能启停）。同步逻辑收拢在 `raffleService.js` 的 `syncFromBenefitType / syncBenefitTypeRename / syncBenefitTypeRemove(tx, ...)` 三个函数，由 `benefitTypeService` 在自己的 `$transaction` 里调用——**单向依赖（benefit → raffle），事务边界清晰**。

| 福利类型操作 | 抽奖侧同步动作 | 默认状态 |
|---|---|---|
| 新增类型 | 创建对应系统自带礼品（同名） | `enabled=false`（需管理员手动开启） |
| 改名 | 同步更新礼品名 | - |
| 删除 | 删除对应礼品（历史抽奖记录靠快照保留） | - |

**约束与规则：**

- 系统自带礼品在抽奖管理里**只能启停**（`enabled`），名称/图片/权重/库存归福利类型管。后端 `updatePrize` 用 `onlyToggle`（仅传 `enabled` 一个字段）放行，`removePrize` 直接拒绝（错误码 **1027**）。
- **抽到自动计入**：`draw` 时若奖品为系统自带（`benefitTypeId != null`）且指定了粉丝，在同一事务内调 `adjustFanCardTx` 给该粉丝对应类型的卡 **+1**，理由为「抽奖获得：xx」。复用 `fanService` 的事务核心，保证「抽奖记录 + 卡数量 + 流水」三者原子提交。
- **历史数据回填**：新增 `benefitTypeId` 列后，迁移需同步把已有 `BenefitType` 补建为 `RafflePrize`（见迁移 SQL）。

