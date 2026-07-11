# 千羽的小屋 · 架构设计

> 本文档仅记录架构决策与模块间契约，不含产品需求、开发计划与部署细节。初始化已由你完成；后续依赖以 `pnpm add` 命令提供，不代跑、不写 package.json。配套文档：部署见 `DEPLOYMENT.md`；开发规范见 `DEV-PC.md`（PC 前端）/ `DEV-MOBILE.md`（移动端）/ `DEV-SERVER.md`（后端）。

## 1. 关键决策（锁定）

| 项 | 决定 |
|---|---|
| 前端结构 | PC 端、移动端两个独立项目，各自开发构建，不共享代码 |
| 后端 | Express + Prisma + SQLite + JWT |
| 包管理 | pnpm（各项目独立，非 monorepo workspace） |
| 鉴权 | JWT（无状态，前端存 localStorage） |
| ORM | Prisma（SQLite） |
| UI | 不使用任何 UI 组件库，组件自研 |
| 部署 | PC→`/`、移动端→`/m`、后端→`/server`，nginx 反代（详见 `DEPLOYMENT.md`） |

## 2. 技术栈（各项目独立）

| 项目 | 选型 |
|---|---|
| PC 前端 | Vue 3 (`<script setup>`) + Vite + Vue Router + Pinia |
| 移动端 | Vue 3 (`<script setup>`) + Vite + Vue Router + Pinia |
| 后端 | Node + Express + Prisma + jsonwebtoken + bcryptjs |
| 规范 | ESLint + Prettier + EditorConfig（三端统一） |
| 语言 | JavaScript（ESM） |

## 3. 仓库结构与模块边界

```
qianyu-cabin/
├── docs/ARCHITECTURE.md   # 本文件
├── pc/                    # PC 前端（独立项目）
├── mobile/                # 移动端（独立项目）
└── server/                # 后端（独立项目）
```

**依赖方向（硬约束）**：
- `server` 独立，不依赖任何前端。
- `pc` / `mobile` 仅通过 HTTP 调用 `server` 的 `/server/api`，彼此不共享代码。
- 三端无 shared 包、无 workspace 链接；一致性靠文档约定，不靠代码复用。

## 4. 数据库设计规范

具体模型定义在 `server/prisma/schema.prisma`，须遵循以下规范：

- **技术**：SQLite，ORM 用 Prisma；表结构由 schema 定义，变更走 `prisma migrate`，禁止手改库。
- **命名**：模型 `PascalCase` 单数（如 `User`），字段 `camelCase`；关系字段命名 `<entity>Id`（如 `userId`）。
- **主键**：每张表 `id Int @id @default(autoincrement())`。
- **时间戳**：所有表含 `createdAt DateTime @default(now())`；可变数据附加 `updatedAt DateTime @updatedAt`。
- **唯一约束**：业务唯一字段（如登录名）加 `@unique`。
- **软删除**：不引入，删除即物理删除（数据量小，保持简单）。
- **敏感字段**：密码一律 bcrypt 哈希，字段名 `passwordHash`，绝不存明文；API 响应中不包含该字段。
- **枚举**：SQLite 不支持 Prisma enum，枚举值用 `String` + 注释说明取值范围。
- **索引**：外键与高频查询字段建索引。
- **时间存储**：`DateTime` 以 UTC 存储，展示层按需转换时区。

## 5. API 设计规范

具体接口在 `server` 实现时定义，须遵循以下规范：

- **基地址**：所有接口以 `/api` 为前缀（部署后由 nginx 挂到 `/server/api`）。
- **版本**：本期不加版本号；发生不兼容变更时升级为 `/api/v{n}`。
- **协议**：仅 JSON；`Content-Type: application/json`；请求体与响应体均为 JSON。
- **资源命名**：路径 `kebab-case`，资源用名词（列表用复数，如 `/users`、`/games`）；动作型用子路径（如 `/auth/login`）。
- **方法语义**：GET 读取、POST 创建/动作、PUT 整体更新、DELETE 删除；不做非常规语义复用。
- **鉴权**：受保护接口须在 `Authorization: Bearer <token>` 头携带 JWT；缺失或失效返回 401。
- **统一响应结构**：`{ code, data, message }`。`code=0` 为成功，`data` 为业务载荷；非 0 为失败，`message` 为可读中文提示。
- **错误码方案**：业务码为数字；`0` 成功；客户端错误（4xx）归入 `1xxx` 段，服务端错误（5xx）归入 `5xxx` 段；具体码值在接口实现时定义，前后端保持一致。
- **分页（列表接口）**：查询参数 `page`、`pageSize`；响应 `data` 含 `list` 与 `total`。
- **HTTP 状态码映射**：参数/业务错误 400、未认证 401、无权限 403、不存在 404、服务端 500。

## 6. 鉴权模型

1. 注册/登录 → 后端 bcrypt 校验 → 返回 JWT（`expiresIn` 见 env）。
2. 前端存 token 到 `localStorage`，axios 默认头附加 `Authorization: Bearer <token>`。
3. 路由守卫：需登录页无 token → 跳登录。
4. 后端 `auth` 中间件校验 JWT，失败返回 `code=1004`；前端拦截器清 token 并跳登录。

## 7. 视觉与一致性约定

- 个人站，温暖手作风，**不使用任何 UI 组件库**；按钮/卡片/输入框等自研。
- 设计方向：暖奶油底、陶土橙主色、羽毛/小屋手绘 SVG 点缀。具体令牌各项目按此方向自行定义。
- 一致性靠文档约定保证（非共享代码）：pc / mobile 采用相同命名、目录、组件写法与配色基调；图标用内联 SVG 自绘，不引图标库。

## 8. 文档边界（何时读哪份）

本仓库文档分四份，职责互斥、不重叠。按场景选择阅读：

| 场景 | 读哪个文档 |
|---|---|
| 想知道项目用了什么技术、模块怎么切、接口/数据库/鉴权定死了什么规则 | `ARCHITECTURE.md`（本文件） |
| 要写/改 PC 前端代码（目录、命名、组件写法、样式、可靠性） | `DEV-PC.md` |
| 要写/改移动端代码（与 PC 相同约定 + 移动布局差异） | `DEV-MOBILE.md` |
| 要写/改后端代码（分层、响应结构、错误码、Prisma、鉴权） | `DEV-SERVER.md` |
| 要部署/配 nginx/看构建产物去向与发布流程 | `DEPLOYMENT.md` |
| 要设计/实现「小屋游戏」（通用框架：存档/排行榜/历史/跨端续玩、engine 接口） | `GAME-ARCHITECTURE.md` |
| 接手整个仓库、需要快速建立全局认知（含常用命令） | 根目录 `CODEBUDDY.md` |

规则：

- 改某一端代码前，**先读对应 `DEV-*.md`**，再动手；架构类决策（技术栈、契约）只在 `ARCHITECTURE.md` 改，不在各端文档重定义。
- 任一端新增接口/错误码/模型，先回 `ARCHITECTURE.md` 对齐契约，再在 `DEV-SERVER.md` 登记错误码；若涉及部署路径变化，同步 `DEPLOYMENT.md`。
- `ARCHITECTURE.md` 只记「难回头的决策与模块间契约」，不含需求、计划、部署细节、具体实现。
