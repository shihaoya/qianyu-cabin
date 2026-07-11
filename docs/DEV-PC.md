# PC 前端开发规范

> 适用范围：`pc/` 项目。架构决策见 `ARCHITECTURE.md`。移动端差异见 `DEV-MOBILE.md`。本规范用于保证后续代码风格一致、行为可靠。
> 当前脚手架：create-vite（Vue 3 + Vite，ESM）。尚未安装 `vue-router`、`pinia`、`axios`，开发时通过 `pnpm add` 补充。

## 1. 目录结构

```
pc/
├── src/
│   ├── api/            # axios 实例与接口封装（按资源分文件，如 auth.js）
│   ├── assets/         # 静态资源（SVG 图标、图片、字体）
│   ├── components/     # 业务组件（按功能分子目录）
│   ├── composables/    # 组合式函数（useXxx）
│   ├── layouts/        # 页面级布局（DefaultLayout.vue）
│   ├── router/         # 路由定义（index.js + 路由守卫）
│   ├── stores/         # Pinia 状态（auth.js 等）
│   ├── styles/         # 全局样式 + 设计令牌 theme.css
│   ├── views/          # 路由页面（按功能分子目录）
│   ├── App.vue
│   └── main.js
├── public/
├── index.html
└── vite.config.js
```

## 2. 命名约定

- 文件/目录：`kebab-case`（如 `auth.js`、`user-card.vue` 组件目录内）。
- Vue 组件（SFC）：`PascalCase` 单文件（`BaseButton.vue`、`GameArea.vue`）；同一目录内不重名。
- 组合式函数：`use` 前缀 + `PascalCase`（`useAuth.js`）。
- Pinia store：`camelCase` 名词（`auth.js`、`game.js`）。
- 变量/函数：`camelCase`；常量：`UPPER_SNAKE_CASE`。
- 路由 `name`：`kebab-case`；`path`：`kebab-case`，动态段用 `:param`。

## 3. 组件代码组织（`<script setup>`）

单文件组件固定顺序：`<script setup>` → `<template>` → `<style scoped>`。`<script setup>` 内部顺序：

1. 依赖导入
2. props（`defineProps`）/ emits（`defineEmits`）
3. 响应式状态（`ref` / `reactive`）
4. 计算属性（`computed`）
5. 侦听（`watch` / `watchEffect`）
6. 生命周期
7. 方法
8. 向模板暴露（如需）

Props 必须声明类型；跨组件通信优先 props / emits，跨页面状态用 Pinia，避免 EventBus。

## 4. 路由与守卫

- 路由集中定义在 `router/index.js`，按需懒加载（`() => import(...)`）。
- 登录态由 `stores/auth.js` 暴露两个 getter：`isLoggedIn`（`!!token`）、`isAdmin`（`user?.role === 'admin'`）。`role` 来自登录响应里的 `user`；刷新后 `user` 为 `null`，需在 `main.js`/`App.vue` 调 `fetchMe()` 重新拉取以恢复 `isAdmin`（token 仍在 `localStorage`，仅缺 `user`）。
- 受保护路由加 `meta.requiresAuth = true`（登录拦截，未来新增需登录页时启用）；自定义守卫可扩展 `meta` 字段。
- **开发者专属路由加 `meta.requiresAdmin = true`**：当前 `/admin/users` 即如此。全局前置守卫 `beforeEach` 中 `if (to.meta.requiresAdmin && !auth.isAdmin) return { name: 'home' }`——非开发者直接回退首页，**不弹 403、不暴露管理入口存在**。
- **管理入口按 `isAdmin` 显隐（前端仅体验层，非安全边界）**：入口只在 `auth.isAdmin` 为 `true` 时渲染，不能只靠「点到了才拦截」。PC 端在 `AppHeader.vue` 用 `v-if="auth.isAdmin"` 渲染「用户管理」导航项；移动端在 `Home.vue` 互动区按 `v-if="auth.isAdmin"` 渲染「用户管理」入口（`BottomNav` 已弃用）。**两端入口都改后，后端 `requireAdmin` 中间件仍须兜底**（见 `DEV-SERVER.md` §13.3），缺一不可。
- 已登录访问 `/login` → 重定向首页。

## 5. 状态管理（Pinia）

- 单一 store 单职责；避免在组件里直接写业务请求，改为在 store action 中调用 `api/`。
- token 持久化在 `localStorage`（key 统一 `qianyu_token`）；store 初始化时从本地读取。
- 登出 action 清理 token 与用户态。

## 6. API 客户端

- `api/request.js` 创建 axios 实例：`baseURL` 为 `import.meta.env.VITE_API_BASE || '/server/api'`（`VITE_API_BASE` 来自环境变量，见第 11 节；默认相对路径，由 Vite 代理 / nginx 反代转发到后端），`withCredentials: false`。
- 请求拦截器：自动附加 `Authorization: Bearer <token>`。
- 响应拦截器：按 `{ code, data, message }` 解包；`code !== 0` 抛出含 `message` 的错误；HTTP 401 清 token 并跳登录。
- 每个资源一个封装文件（如 `api/auth.js`），页面/store 只调用封装函数，不直接用 axios。

## 7. 样式与主题（自研，无 UI 框架）

- 设计令牌集中在 `styles/theme.css`：暖奶油底 `#f7f1e3`、陶土橙主色 `#c9743b`、鼠尾草绿 `#5b8c7b`、圆角 `14px`、柔和阴影；全局 `:root` 变量，组件内用 `var(--xxx)`。
- **不使用任何 UI 组件库**；按钮/卡片/输入框/标签等基础组件自研，放 `components/base/`（如 `BaseButton.vue`）。
- 图标用内联 SVG 自绘（羽毛🪶、小屋），不引图标库；可封装 `FeatherIcon.vue`、`CabinLogo.vue`。
- 布局：PC 采用宽屏布局，主内容最大宽度约 `1080px` 居中；顶部导航 + 内容区；断点 `@media (max-width: 768px)` 仅作兜底，主适配目标为桌面。
- 组件样式默认 `<style scoped>`；跨组件通用类放 `styles/`。

### 组件复用与自动同步文档规则（重要）

- **先复用，后新建**：实现任一功能前，先运行 `pnpm docs:components` 看 `docs/COMPONENTS.md` 是否已有同功能组件；已有则直接复用，不得重复造轮子。
- **相似功能先封装**：多处出现相似 UI/逻辑时，抽成通用组件放入 `components/base/`，而非在每个页面各写一份。
- **组件即文档源（自动同步）**：每个 `.vue` 文件顶部必须含一段 `@doc` 注释块，写明 `name / path / category / purpose / appliesTo / props / events / example`（字段见 `docs/COMPONENTS.md` 顶部格式）。`docs/COMPONENTS.md` **由 `scripts/sync-components.mjs` 自动生成，禁止手改**；增删或改动组件后运行该脚本，文档即同步。无 `@doc` 块的组件视为未完成。
- 跨端通用组件（如 `BaseButton`、`FeatherIcon`）两端各实现一份、外观一致；移动端通过 props 调密度/尺寸，不另起一套命名。
- 接入脚本（每个项目各自执行一次，不手改 `package.json` 的依赖，仅加脚本）：
  - `cd pc && pnpm pkg set scripts.docs:components="node scripts/sync-components.mjs"`
  - `cd mobile && pnpm pkg set scripts.docs:components="node scripts/sync-components.mjs"`

## 8. 错误处理与可靠性

- 所有接口调用 `try/catch`，区分「业务错误（code≠0）」与「网络错误」；用统一提示组件展示 `message`，不裸 `alert`。
- 表单提交：提交中禁用按钮（`loading` 态），失败回显错误，成功才跳转/刷新。
- 列表/详情加载展示骨架或加载态，空数据有空态提示。
- 不在 `catch` 中吞异常；未知错误至少打印日志并提示用户。

## 9. 工具链

- ESLint（`eslint-plugin-vue`）+ Prettier + EditorConfig，规则与 `DEV-MOBILE.md`、`DEV-SERVER.md` 对齐。
- 提交前本地自检：`pnpm lint`。
- 中文文案统一；代码注释精简，说明「为什么」而非「做什么」。

## 10. 构建与代理

- 开发：`pnpm dev`；Vite 代理 `/server` → 后端（见 `vite.config.js` 的 `server.proxy`，含 `rewrite` 去除 `/server` 前缀，转发为 `/api/...`，与生产 nginx `location /server/` 的 strip 行为一致，避免 dev 下 404）。
- 生产：`pnpm build` 产物在 `pc/dist`，部署见 `DEPLOYMENT.md`。

## 11. 环境变量分层

所有可配置项（端口、后端地址、API 基地址）一律进环境变量，**不写死在代码 / config**。Vite 按 `mode` 自动加载，优先级 `.env.[mode]` > `.env`：

| 文件 | 加载时机 | 入库 | 用途 |
|---|---|---|---|
| `.env.example` | - | ✅ | 模板，复制为其它文件使用 |
| `.env` | 始终 | ❌ | 本地个人覆盖（`.gitignore` 忽略） |
| `.env.development` | `pnpm dev` | ✅ | 开发：`DEV_PORT`、`API_TARGET`、`VITE_API_BASE` |
| `.env.production` | `pnpm build` | ✅ | 生产打包：`VITE_API_BASE` |
| `.env.preview` | `pnpm preview` | ✅ | 预览：`VITE_API_BASE` |

变量含义：
- `DEV_PORT`：Vite 开发服务器端口（仅 dev 用），PC 默认 `5173`；`strictPort: true`，被占用直接报错不漂移。
- `API_TARGET`：开发时代理转发到的后端地址（`vite.config.js` 的 `server.proxy` 目标），默认 `http://localhost:3000`。
- `VITE_API_BASE`：注入前端 bundle 的 API 基地址（需 `VITE_` 前缀），默认 `/server/api`；部署到独立域名后端时改为绝对地址（如 `https://api.example.com/server/api`）。

打包到不同部署环境：
- `pnpm build` → 用 `.env.production`；
- 需更多环境（如 staging）时，新建 `.env.staging` 并 `pnpm build --mode staging`。

`.gitignore` 已按 Vite 标准忽略 `.env` / `.env.local` / `.env.*.local`，上述分层文件均入库。
