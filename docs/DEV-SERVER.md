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
| 1005 | 403 | 无权限（非开发者） | requireAdmin 中间件 |
| 5000 | 500 | 服务端未知错误 | 错误中间件 |

> 新增业务错误码时，在此表登记并在对应接口文档/注释说明，保证 PC/移动端一致。

## 11. 构建与运行

- 开发：`pnpm dev`（建议 `node --watch src/server.js` 或 nodemon，按环境选）。
- 迁移：`pnpm prisma migrate deploy`（生产）/ `prisma migrate dev`（开发）。
- 生产：守护进程运行 `src/server.js`（pm2 / systemd），经 nginx 反代（见 `DEPLOYMENT.md`）。
- 启动自检：配置缺失则退出并提示；`prisma generate` 应在部署脚本中执行。

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
pnpm prisma generate
pnpm prisma migrate dev --name <name>
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

- 取值：`"user"`（普通用户）| `"admin"`（开发者）。默认 `"user"`（见 `schema.prisma`）。
- JWT 载荷携带 `role`，`auth` 中间件把 `req.user.role` 透传给下游；`publicUser` 在登录响应里一并返回 `role`。
- 前端据此渲染入口：仅 `role === 'admin'` 显示「用户管理」，路由用 `requireAdmin` 守卫（见 `DEV-PC.md`/`DEV-MOBILE.md` 的路由章节）。
- 改角色走 `userService.setRole`，不在此处做密码等敏感字段回显。

### 13.2 匿名留言板（Message）

- 模型 `Message`：`content` 必填，`isAnonymous` 标记，`userId`/`nickname` 可空。
- **匿名 = 不存储任何身份信息**：`POST /api/guestbook` 经 `optionalAuth` 软鉴权——带合法 token 则记录 `userId`+`nickname` 并置 `isAnonymous=false`；无 token 或匿名勾选时 `userId`/`nickname` 均为 `null`、`isAnonymous=true`。**绝不落库 IP、邮箱等可定位身份的数据。**
- 内容校验前置：`createMessage` 在 service 层判空与长度（≤500），失败抛 `AppError(1001)`。
- 列表 `GET /api/guestbook` 返回倒序留言（含 `isAnonymous`/`nickname`），供首页/留言页展示。

### 13.3 仅开发者可见的用户管理

- 双重拦截：前端路由守卫 `requireAdmin`（无 admin 角色直接跳首页/登录）+ 后端 `middleware/requireAdmin.js`（非 admin 返回 `1005`）。两端缺一会漏权限。
- 列表 `GET /api/admin/users`：`userService.listUsers` 分页返回 `{ list, total }`，`select` 剔除 `passwordHash`。
- 改角色 `PATCH /api/admin/users/:id/role`：`adminController` 调 `setRole`；**禁止把仅存的最后一个 admin 降级、并禁止把自己降级**（保持至少一名开发者），违例抛 `AppError(1005)`。
- 提升某用户为开发者：用脚本（不连前端）`node scripts/promote-admin.mjs <昵称>`，仅开发期使用。

> 权限边界是安全红线：任何新增的「管理类」接口都必须挂 `requireAdmin`，且前端对应入口/路由同步加 `isAdmin` 判断。

