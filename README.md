# 千羽的小屋

一个带「手作感」的个人站点：**PC 前端 + 移动端 + 后端**，内含一个自研的 Canvas 爬树小游戏「千羽爬树」。
三端是相互独立项目，统一由 nginx 对外；前端只通过 HTTP 调用后端 API，不直接共享代码。

> 这是分享/交付时给人看的总说明。架构决策、开发规范等细节见 [`docs/`](#文档索引)。

## 什么情况下用

- 想了解/复刻「**不依赖任何 UI 组件库、纯手作风格**」的 Vue 3 站点架构，以及「跨端续玩 / 存档还原」的实现方式。
- 想在 PC 与移动端之间复用代码：两端共用的逻辑都收在 [`shared/`](shared/) 包里（当前含爬树游戏 engine/render/config），改一处两端生效，避免重复实现。
- 想把这个仓库作为个人站点的二次开发起点（加页面、加游戏、接新接口）。
- 想照着文档把整套站点部署到自己的服务器。

**不适合**：需要后台多用户协作、电商、CMS 等重型企业场景——本项目定位是个人小站。

## 怎么用

### 环境要求

- Node.js（建议 LTS）
- pnpm（`npm i -g pnpm`）
- 一个支持反向代理的 Web 服务器（如 nginx）用于生产部署

### 本地开发（三端分别安装依赖）

```bash
# PC 前端
cd pc && pnpm install && pnpm dev

# 移动端
cd mobile && pnpm install && pnpm dev

# 后端（首次需初始化数据库）
cd server && pnpm install
pnpm prisma migrate dev     # 初始化 SQLite 并生成 Prisma Client
pnpm dev                    # 或 node src/server.js
```

前端访问各自 Vite 提示的地址；API 走相对路径 `/server/api`（开发期由 Vite 代理到后端 `:3000`）。

### 构建

```bash
cd pc && pnpm build        # 产物 → pc/dist
cd mobile && pnpm build    # 产物 → mobile/dist
cd server && pnpm build    # 若无需编译，直接 node src/server.js 运行
```

### 部署

见 [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)：nginx 把 `/` 指向 `pc/dist`、`/m` 指向 `mobile/dist`、`/server/` 反向代理到后端 `127.0.0.1:3000`。后端参数为环境变量（端口、`JWT_SECRET` 等），不在代码内硬编码。

## 最佳实践

- **不要引入 UI 组件库或共享代码包**：视觉风格靠 `styles/theme.css` 的 CSS 变量（奶白 `#f7f1e3`、陶土 `#c9743b`、鼠尾草绿 `#5b8c7b`、圆角 `14px`），PC/移动端保持一致；按钮/卡片/输入/标签/图标等基础组件全部自研内联 SVG。
- **后端严格分层（仅单向）**：`routes → controllers → services → db`。`routes` 只做映射、不放逻辑；`services` 持有业务逻辑并接触 Prisma；`db` 只导出单一 `PrismaClient` 实例。
- **统一响应契约**：所有接口返回 `{ code, data, message }`，`code: 0` 成功，非 0 失败并带中文 `message`；业务错误码见 [`docs/DEV-SERVER.md`](docs/DEV-SERVER.md)。未知服务端错误只返回 `5000`，不泄漏堆栈。
- **ESM 贯穿**：全仓 JavaScript (ESM)，新文件默认 ESM。
- **两端共用代码放 `shared/`**：`shared/` 是 PC 与移动端共用的代码包，任何两端都会用到的逻辑（平台无关的纯逻辑、共享配置、共享资源等）都应抽到这里，而不是在某一端各写一份。爬树游戏（engine/render/config）即是一例：存档走 `serialize()`、恢复走 `createInitialState(saved)`，状态契约保证「跨端续玩」无损还原（包括虫子、掉落物、护盾次数等）。今后新增共用逻辑建议沿用此模式。
- **数据库改动走 Prisma migrate**：绝不手动改库；改 `schema.prisma` 后 `pnpm prisma migrate dev` 并 `pnpm prisma generate`。
- **密钥与配置走环境变量**：端口、`JWT_SECRET`、`JWT_EXPIRES_IN`、数据库路径来自 `server/.env`，由 `src/config/index.js` 统一加载。
- **前端认证**：登录后 token 存 `localStorage`（key `qianyu_token`），由 axios 拦截器自动附加；收到 `401` 统一清理 token 并跳转登录。

## 目录结构

```
.
├─ pc/          PC 前端（Vue 3 + Vite），构建到 pc/dist，对外 /
├─ mobile/      移动端（Vue 3 + Vite），构建到 mobile/dist，对外 /m
├─ server/      后端（Express + Prisma + SQLite + JWT），监听 :3000
├─ shared/      PC 与移动端共享代码包（当前含爬树游戏，今后两端共用的逻辑都放这里）
├─ docs/        架构与开发规范文档
├─ assets/      共享静态资源（如游戏贴图）
└─ CODEBUDDY.md 给 AI 助手看的仓库指引（命令、边界、约定）
```

## 文档索引

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — 锁定的架构 / API / DB / 视觉契约
- [`docs/DEV-PC.md`](docs/DEV-PC.md) / [`docs/DEV-MOBILE.md`](docs/DEV-MOBILE.md) — 前端结构、命名、样式、可靠性
- [`docs/DEV-SERVER.md`](docs/DEV-SERVER.md) — 后端分层、响应助手、错误码、Prisma / Auth
- [`docs/GAME-ARCHITECTURE.md`](docs/GAME-ARCHITECTURE.md) — 爬树游戏架构
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — nginx 拓扑与发布流程
