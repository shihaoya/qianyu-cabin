# 服务端开发规范

> 适用范围：`server/` 项目。架构决策见 `ARCHITECTURE.md`。当前仅有 `package.json`（pnpm，ESM），依赖未安装；开发时通过 `pnpm add` 补充（Express、Prisma、jsonwebtoken、bcryptjs、dotenv 等）。
> 本规范用于保证后端分层清晰、响应一致、错误可预期，便于 PC/移动端对接。

## 1. 目录结构

```
server/
├── prisma/
│   └── schema.prisma        # 数据模型（遵循 ARCHITECTURE.md §4 规范）
├── src/
│   ├── config/index.js      # 环境变量集中读取与校验
│   ├── db/index.js          # PrismaClient 单例
│   ├── middleware/
│   │   ├── auth.js          # JWT 校验中间件
│   │   └── error.js         # 统一错误处理中间件
│   ├── routes/              # 路由（仅做分发，不含业务逻辑）
│   ├── controllers/         # 控制器（解析入参、调用 service、组装响应）
│   ├── services/            # 业务逻辑（与数据库交互，可复用）
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
| 5000 | 500 | 服务端未知错误 | 错误中间件 |

> 新增业务错误码时，在此表登记并在对应接口文档/注释说明，保证 PC/移动端一致。

## 11. 构建与运行

- 开发：`pnpm dev`（建议 `node --watch src/server.js` 或 nodemon，按环境选）。
- 迁移：`pnpm prisma migrate deploy`（生产）/ `prisma migrate dev`（开发）。
- 生产：守护进程运行 `src/server.js`（pm2 / systemd），经 nginx 反代（见 `DEPLOYMENT.md`）。
- 启动自检：配置缺失则退出并提示；`prisma generate` 应在部署脚本中执行。
