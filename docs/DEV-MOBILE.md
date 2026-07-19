# 移动端开发规范

> 适用范围：`mobile/` 项目。架构决策见 `ARCHITECTURE.md`。与 PC 端的差异仅在本规范第 7 节（移动布局），其余约定与 `DEV-PC.md` 保持一致，确保两端视觉语言与代码风格统一。
> 当前脚手架：create-vite（Vue 3 + Vite，ESM）。尚未安装 `vue-router`、`pinia`、`axios`，开发时通过 `pnpm add` 补充。

## 1–6、8–10（与 PC 端相同）

以下章节要求与 `DEV-PC.md` **完全一致**，不重复定义，避免漂移：

- 第 1 节 目录结构：仅 `layouts/` 改为移动态布局（底部 Tab 栏），其余相同。
- 第 2 节 命名约定：完全相同（kebab-case 文件、PascalCase 组件、useXxx、camelCase 变量）。
- 第 3 节 组件代码组织（`<script setup>` 顺序）：完全相同。
- 第 4 节 路由与守卫：完全相同（含 `meta.requiresAuth`、按 `meta.cap` + `can()` 的能力守卫、按 `can(auth.user,'manageUsers')` 显隐管理入口的约定）。
- 第 5 节 状态管理（Pinia）：完全相同（token key 同为 `qianyu_token`）。
- 第 6 节 API 客户端：`baseURL` 同为 `/server/api`；拦截器逻辑完全相同，含「响应拦截器是错误归一化唯一出口，把业务失败与 HTTP 失败都转成带中文 `message` 的 `Error`」。
- 第 8 节 错误处理与可靠性：完全相同（统一错误处理方案：后端返回中文 `message` → 拦截器归一化 → 页面只展示 `e.message`；含登出/token 失效「整页刷新回首页」约定、自查清单、loading 态、不吞异常）。
- 第 9 节 工具链：ESLint/Prettier/EditorConfig 规则与 PC 端同版本同配置。
- 第 10 节 构建与代理：Vite 代理配置相同；产物在 `mobile/dist`（`DEPLOYMENT.md` 的 `/m`）。

## 7. 样式与主题（移动布局专属差异）

移动端沿用 PC 端同一套设计令牌（`styles/theme.css`：暖奶油底、陶土橙、鼠尾草绿、圆角 14px），**不复写配色**，仅布局与交互适配小屏：

- **视口**：`index.html` 的 `<meta name="viewport">` 设 `width=device-width, initial-scale=1, viewport-fit=cover`；禁止整体缩放（`user-scalable=no`）按体验需要决定。
- **布局**：单栏流式布局，主内容两侧留安全边距（`env(safe-area-inset-*)`）；**不使用底部 Tab 栏**。首页（`Home.vue`）以「区块」流式排布：游戏区 → 互动区 → 关于小屋。互动区内含跳转入口：留言板（`RouterLink` → `/guestbook`）、用户管理（仅 `can(auth.user,'manageUsers')` 可见 → `/admin/users`）。
- **尺寸单位**：字号/间距用 `rem` 或 `vw`（基准便于跨设备），不写死大像素；触控目标高度 ≥ `44px`。
- **断点**：以 `max-width: 480px` 为主适配目标，必要时 `481–768px` 兜底；不针对桌面做复杂布局。
- **基础组件**：与 PC 端共用同一套自研组件（`BaseButton`/`BaseCard`/`BaseInput` 等）与同一套内联 SVG 图标，仅可通过 props 调整尺寸/密度，不得各写一套。
- **交互**：列表下拉刷新、上拉加载（如引入）用统一组合式函数 `usePullLoad`；避免依赖第三方 UI 库实现。
- **组件复用与文档规则**：与 `DEV-PC.md` 第 7 节「组件复用与自动同步文档规则」完全一致——先复用后新建、相似功能先封装、每个组件在 `.vue` 顶部写 `@doc` 块、`docs/COMPONENTS.md` 由 `scripts/sync-components.mjs` 自动生成（移动端维护 `mobile/docs/COMPONENTS.md`）。`docs/COMPONENTS.md` 是检索可复用组件的唯一入口，禁止手改。

## 一致性红线

- 两端**不共享代码**（架构硬约束），但上述约定必须同步执行，确保「同一套视觉语言、同一套写法」。
- 任一处样式/令牌改动，须同步在另一端文档化，不允许一端独有配色或组件命名。

## 移动端游戏开发：各游戏互相独立

每个游戏（如「千羽爬树」「飞扬的千羽」）是**自包含模块**，视图组件、engine、render、config 各自独立。**游戏之间严禁耦合**，否则一个游戏的改动会悄悄影响另一个。具体红线：

- **CSS 命名空间隔离**：每个游戏的视图组件必须使用**自己专属的类名前缀**，且不得复用其它游戏的类名。例：爬树用 `.climb-game` / `.cg-*`、飞鸟用 `.fly-game` / `.fly-*`。**禁止**像「飞鸟直接复制爬树的 `.climb-game`/`.cg-*` 类名」那样跨游戏套用——这会让两个游戏的样式与竖屏旋转行为混在一起，切换游戏时表现互相串。
- **全局组件/状态隔离**：游戏内弹框（如「继续上局」确认框）若需随本游戏 DOM 旋转或表现，应**挂在本游戏组件内**，并使用**独立实例状态**（如 `useConfirm` 的 `createConfirmScope()` 工厂），**不得**用模块级全局单例标志去协调多游戏的渲染/显隐——否则切换游戏时全局状态泄漏，导致另一个游戏的弹框被错误横转或隐藏。
- **竖屏旋转自理**：每个游戏自行决定是否在竖屏下旋转横玩，旋转逻辑与样式只作用于**本游戏根节点**（`.fly-game.is-portrait` / `.climb-game.is-portrait`），不得影响其它游戏或普通页面。
- 引擎逻辑（`<shared>/games/<key>/{engine,render}.js`）本就跨端复用，但**视图层各自独立**，不要为了省事而共用对方视图的类名或组件。

> 历史教训：`e6e71c3 飞扬的千羽` 从爬树游戏复制粘贴了整套 `.climb-game`/`.cg-*` 类名；后续把飞鸟也改成 CSS 旋转后，两个游戏视觉与行为完全混在一起，排查耗时。新游戏请直接起一套独立类名，从一开始就隔离。

## 环境变量分层（与 PC 端相同）

与 `DEV-PC.md` 第 11 节完全一致，仅 `DEV_PORT` 默认 `5174`（PC 为 `5173`），其余变量（`API_TARGET`、`VITE_API_BASE`）与加载规则、打包用法均相同。详见 `DEV-PC.md` 第 11 节。
