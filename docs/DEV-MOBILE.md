# 移动端开发规范

> 适用范围：`mobile/` 项目。架构决策见 `ARCHITECTURE.md`。与 PC 端的差异仅在本规范第 7 节（移动布局），其余约定与 `DEV-PC.md` 保持一致，确保两端视觉语言与代码风格统一。
> 当前脚手架：create-vite（Vue 3 + Vite，ESM）。尚未安装 `vue-router`、`pinia`、`axios`，开发时通过 `pnpm add` 补充。

## 1–6、8–10（与 PC 端相同）

以下章节要求与 `DEV-PC.md` **完全一致**，不重复定义，避免漂移：

- 第 1 节 目录结构：仅 `layouts/` 改为移动态布局（底部 Tab 栏），其余相同。
- 第 2 节 命名约定：完全相同（kebab-case 文件、PascalCase 组件、useXxx、camelCase 变量）。
- 第 3 节 组件代码组织（`<script setup>` 顺序）：完全相同。
- 第 4 节 路由与守卫：完全相同（含 `meta.requiresAuth` 与全局守卫）。
- 第 5 节 状态管理（Pinia）：完全相同（token key 同为 `qianyu_token`）。
- 第 6 节 API 客户端：`baseURL` 同为 `/server/api`、拦截器逻辑完全相同。
- 第 8 节 错误处理与可靠性：完全相同（统一提示、loading 态、不吞异常）。
- 第 9 节 工具链：ESLint/Prettier/EditorConfig 规则与 PC 端同版本同配置。
- 第 10 节 构建与代理：Vite 代理配置相同；产物在 `mobile/dist`（`DEPLOYMENT.md` 的 `/m`）。

## 7. 样式与主题（移动布局专属差异）

移动端沿用 PC 端同一套设计令牌（`styles/theme.css`：暖奶油底、陶土橙、鼠尾草绿、圆角 14px），**不复写配色**，仅布局与交互适配小屏：

- **视口**：`index.html` 的 `<meta name="viewport">` 设 `width=device-width, initial-scale=1, viewport-fit=cover`；禁止整体缩放（`user-scalable=no`）按体验需要决定。
- **布局**：单栏流式布局，主内容两侧留安全边距（`env(safe-area-inset-*)`）；主导航用**底部 Tab 栏**（`layouts/DefaultLayout.vue` 内含 `BottomNav`）。
- **尺寸单位**：字号/间距用 `rem` 或 `vw`（基准便于跨设备），不写死大像素；触控目标高度 ≥ `44px`。
- **断点**：以 `max-width: 480px` 为主适配目标，必要时 `481–768px` 兜底；不针对桌面做复杂布局。
- **基础组件**：与 PC 端共用同一套自研组件（`BaseButton`/`BaseCard`/`BaseInput` 等）与同一套内联 SVG 图标，仅可通过 props 调整尺寸/密度，不得各写一套。
- **交互**：列表下拉刷新、上拉加载（如引入）用统一组合式函数 `usePullLoad`；避免依赖第三方 UI 库实现。
- **组件复用与文档规则**：与 `DEV-PC.md` 第 7 节「组件复用与自动同步文档规则」完全一致——先复用后新建、相似功能先封装、每个组件在 `.vue` 顶部写 `@doc` 块、`docs/COMPONENTS.md` 由 `scripts/sync-components.mjs` 自动生成（移动端维护 `mobile/docs/COMPONENTS.md`）。`docs/COMPONENTS.md` 是检索可复用组件的唯一入口，禁止手改。

## 一致性红线

- 两端**不共享代码**（架构硬约束），但上述约定必须同步执行，确保「同一套视觉语言、同一套写法」。
- 任一处样式/令牌改动，须同步在另一端文档化，不允许一端独有配色或组件命名。

## 环境变量分层（与 PC 端相同）

与 `DEV-PC.md` 第 11 节完全一致，仅 `DEV_PORT` 默认 `5174`（PC 为 `5173`），其余变量（`API_TARGET`、`VITE_API_BASE`）与加载规则、打包用法均相同。详见 `DEV-PC.md` 第 11 节。
