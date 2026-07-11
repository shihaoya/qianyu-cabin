# 千羽的小屋 · 部署文档

> 本文件描述构建产物去向、nginx 拓扑与发布流程。架构决策见 `ARCHITECTURE.md`，开发规范见各端 `DEV-*.md`。
> 三端为独立项目，各自构建、各自产出静态/运行产物，由 nginx 统一对外。

## 1. 构建产物去向

| 项目 | 构建命令 | 产物目录 | 对外路径 |
|---|---|---|---|
| PC 前端 | `cd pc && pnpm build` | `pc/dist` | `/`（站点根） |
| 移动端 | `cd mobile && pnpm build` | `mobile/dist` | `/m` |
| 后端 | `cd server && pnpm build`（若需编译）/ 直接 `node src/server.js` | `server/` | `/server` |

- 前端构建为纯静态文件（HTML/CSS/JS），由 nginx 直接托管。
- 后端为 Node 进程，监听本地端口（默认 `3000`），由 nginx 反向代理，不直接暴露公网。
- 后端 SQLite 数据库文件落在 `server/` 内（如 `server/prisma/dev.db`），随服务进程所在目录，需保证该目录在部署环境中持久存在且可写。

## 2. nginx 拓扑

```
浏览器
  │
  ├─ /            → 静态托管 pc/dist        （SPA，try_files 回退 index.html）
  ├─ /m           → 静态托管 mobile/dist     （SPA，try_files 回退 index.html）
  └─ /server      → 反向代理 127.0.0.1:3000  （后端 API）
```

前端 API 调用统一使用相对 baseURL：`/server/api`（开发期由 Vite 代理到后端，生产期由 nginx 反代）。

## 3. nginx 配置示例

```nginx
server {
  listen 80;
  server_name qianyu.example.com;   # 替换为实际域名

  # PC 前端
  location / {
    root /var/www/qianyu-cabin/pc/dist;
    try_files $uri $uri/ /index.html;
  }

  # 移动端（注意末尾斜杠保持一致）
  location /m {
    alias /var/www/qianyu-cabin/mobile/dist;
    try_files $uri $uri/ /m/index.html;
  }

  # 后端反代
  location /server/ {
    proxy_pass http://127.0.0.1:3000/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

要点：

- `location /m` 用 `alias` 且 `try_files` 回退到 `/m/index.html`，保证移动端 SPA 路由刷新不 404。
- `location /server/` 的 `proxy_pass` 末尾带 `/`，把 `/server/api/xxx` 转发为后端 `/api/xxx`（与架构文档「基地址 `/api`」对齐）。
- 生产建议加 HTTPS（Let's Encrypt），并统一 `X-Forwarded-Proto`，后端据此判断安全上下文。

## 4. 发布流程

1. 后端：`cd server && pnpm install --prod && pnpm prisma migrate deploy && node src/server.js`（建议用 pm2 / systemd 守护进程，非文档范围，按环境自选）。
2. PC：`cd pc && pnpm install && pnpm build`，将 `pc/dist` 同步到 nginx 的 `pc/dist` 根。
3. 移动端：`cd mobile && pnpm install && pnpm build`，将 `mobile/dist` 同步到 nginx 的 `mobile/dist` 根。
4. 重启/重载 nginx：`nginx -s reload`。

## 5. 环境配置

- 后端运行参数（端口、JWT 密钥、过期时间、数据库路径）通过环境变量注入（见 `DEV-SERVER.md` 的「配置」节），不在代码内硬编码。
- 部署前确认 `.env` 已就位且 `JWT_SECRET` 为强随机值。
