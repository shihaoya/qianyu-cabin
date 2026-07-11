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
- 登录态由 `stores/auth.js` 暴露 `isLoggedIn`（`!!token`）。角色与权限判定集中在一处：`src/permissions.js` 定义角色层级 `ROLE_RANK`、能力 `CAP_ROLE` 与 `can(user, cap)` 工具；`role` 来自登录响应里的 `user`，刷新后 `user` 为 `null`，需在 `main.js`/`App.vue` 调 `fetchMe()` 重新拉取（token 仍在 `localStorage`，仅缺 `user`）。**任何权限判断都走 `can(auth.user, 'xxx')`，勿再写 `role === 'admin'` 之类的散落判断**。
- 受保护路由加 `meta.requiresAuth = true`（登录拦截，未来新增需登录页时启用）；自定义守卫可扩展 `meta` 字段。
- **权限路由加 `meta.cap`**：值为 `CAP_ROLE` 中登记的能力名（如 `manageUsers`）。全局前置守卫 `beforeEach` 中 `if (to.meta.cap && !can(auth.user, to.meta.cap)) return { name: 'home' }`——无权限直接回退首页，**不弹 403、不暴露入口存在**。
- **管理入口按 `can(auth.user, 'manageUsers')` 显隐（前端仅体验层，非安全边界）**：入口只在具备该能力时渲染，不能只靠「点到了才拦截」。PC 端在 `AppHeader.vue` 用 `v-if="can(auth.user,'manageUsers')"` 渲染「用户管理」导航项；移动端在 `Home.vue` 互动区同理。**两端入口都改后，后端权限中间件仍须兜底**（见 `DEV-SERVER.md` §13.3），缺一不可。
- 已登录访问 `/login` → 重定向首页。

## 5. 状态管理（Pinia）

- 单一 store 单职责；避免在组件里直接写业务请求，改为在 store action 中调用 `api/`。
- token 持久化在 `localStorage`（key 统一 `qianyu_token`）；store 初始化时从本地读取。
- 登出 action 清理 token 与用户态。

## 6. API 客户端

- `api/request.js` 创建 axios 实例：`baseURL` 为 `import.meta.env.VITE_API_BASE || '/server/api'`（`VITE_API_BASE` 来自环境变量，见第 11 节；默认相对路径，由 Vite 代理 / nginx 反代转发到后端），`withCredentials: false`。
- 请求拦截器：自动附加 `Authorization: Bearer <token>`。
- **响应拦截器是前端错误处理的唯一归一化出口（强约束）**。所有失败最终都被转成一个「带友好中文 `message` 的 `Error`」再 reject，页面/store 只负责展示 `err.message`，**永远不会看到 axios 默认的英文 `Request failed with status code xxx`**。具体规则：
  - **成功且业务成功**（HTTP 2xx 且 `code === 0`）：返回 `body.data`，调用方直接拿数据。
  - **业务失败**（HTTP 2xx 但 `code !== 0`）：`reject(toError(body.message, body.code))`。
  - **HTTP 失败**（非 2xx，如 400/401/403/500）：后端此时**仍返回** `{ code, data:null, message }`，必须从 `err.response.data.message` 取中文文案；断网/超时无响应体时用通用兜底文案（如「网络异常，请检查网络后重试」）。**绝不允许**直接 `reject(err)` 把 axios 原始错误透出。
  - 归一化用统一的 `toError(message, code, status)` 生成 `Error`，并把 `code`/`status` 挂到 error 上，供页面按需区分（一般只用 `message`）。
  - HTTP 401：清 token 并跳登录（副作用），同时照常归一化错误。
- 每个资源一个封装文件（如 `api/auth.js`），页面/store 只调用封装函数，不直接用 axios；封装层与 store **不得二次 try/catch 吞掉或重写 `message`**，让归一化后的错误一路冒泡到页面。

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

**统一错误处理方案（前后端一致，务必遵守）**

1. **后端**：任何失败都返回 `{ code, data:null, message }`，`message` 为可直接展示给用户的中文文案，并配对应 HTTP 状态码（400/401/403/404/500）。未知错误只返回 `5000 + 通用文案`，不泄漏堆栈（见 `DEV-SERVER.md` §10）。
2. **拦截器归一化（唯一出口）**：`api/request.js` 的响应拦截器把「业务失败」和「HTTP 失败」都归一化成带中文 `message` 的 `Error`（见 §6）。这是页面能拿到友好文案的前提——**新增接口无需在页面重复处理原始错误**。
3. **页面/store 消费**：接口调用统一 `try { ... } catch (e) { error.value = e.message || '兜底文案' }`，把 `e.message` 展示在页面内联错误区（如 `.xxx-error`）或统一提示组件，**不裸 `alert`、不展示 `e` 本身或状态码**。
4. **自查清单（每次开发新接口/表单必过）**：
   - [ ] 该请求失败时，页面显示的是**中文业务文案**，不是英文 `Request failed with status code xxx`。
   - [ ] `catch` 里用的是 `e.message`，且有兜底文案。
   - [ ] 未在封装层/store 二次 `catch` 吞掉错误或覆盖 `message`。
   - [ ] 表单提交中禁用按钮（`loading` 态），失败回显、成功才跳转/刷新。
   - [ ] 需要区分错误类型时用 `e.code`（业务码）/`e.status`（HTTP 码），而非解析文案。

5. **登出与 token 失效（统一「整页刷新回首页」，杜绝页面残留）**：
   - 手动退出（`auth.logout()`）与 token 失效（HTTP 401）行为必须一致：清除 `localStorage` 的 `qianyu_token` 后，`window.location.replace(import.meta.env.BASE_URL)` 整页刷新回首页（PC 回 `/`、移动端回 `/m/`）。**不得**仅靠 `router.push/replace` 做客户端跳转而保留内存中的组件状态。
   - 整页刷新能彻底销毁当前组件实例与内存里的用户数据（如管理区列表、昵称），重新挂载的首页会因 token 已空而显示未登录态，从而杜绝退出后受保护内容残留展示。
   - 首页承载登录入口，因此「回首页」而非「跳登录页」；不要再为 401 单独打开登录页路由。

**其它可靠性约定**

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
