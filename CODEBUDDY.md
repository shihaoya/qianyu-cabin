# CODEBUDDY.md This file provides guidance to CodeBuddy when working with code in this repository.

## Commands

All commands use pnpm. Each subproject (`pc/`, `mobile/`, `server/`) is independent and has its own `package.json`; run commands from within the relevant subproject directory.

### PC / Mobile frontends (`pc/`, `mobile/`)
- `pnpm dev` — start Vite dev server with HMR.
- `pnpm build` — build static output to `dist/` (PC → served at `/`; mobile → served at `/m`).
- `pnpm preview` — preview the production build locally.
- `pnpm lint` — run ESLint + Prettier (configure `eslint`/`prettier` per `DEV-PC.md` §9; not yet installed).
- Add runtime deps as needed: `pnpm add vue-router pinia axios` (example; do NOT hand-edit `package.json` for deps).

### Backend (`server/`)
- `pnpm dev` — run `src/server.js` with watch (configure in `package.json`; not yet set).
- `pnpm prisma migrate dev` — create/apply a DB migration during development.
- `pnpm prisma migrate deploy` — apply migrations in production (no generate step).
- `pnpm prisma generate` — regenerate Prisma client after schema change.
- `pnpm add express @prisma/client jsonwebtoken bcryptjs dotenv` — install backend deps (example).
- No test runner is configured yet; add one (e.g. `vitest`/`jest`) and a `pnpm test` script before writing tests.

## Architecture

This is a personal site ("千羽的小屋") for one developer. Three **independent** projects live in one repo, developed and built separately, then unified at deploy time by nginx. There is deliberately **no monorepo workspace and no shared code package** — consistency is enforced by written conventions, not by code reuse.

### Projects and boundaries
- `pc/` — PC web frontend (Vue 3 + Vite + Vue Router + Pinia). Built to `pc/dist`, served at site root `/`.
- `mobile/` — Mobile web frontend (same stack). Built to `mobile/dist`, served at `/m`. Single-column, bottom-tab layout; shares the same design tokens and self-made components as `pc/`.
- `server/` — Backend (Node + Express + Prisma + SQLite + JWT). Listens on localhost:3000; nginx reverse-proxies `/server` → `:3000`.

Hard dependency rule: `server` depends on nothing frontend; `pc`/`mobile` talk to `server` only over HTTP at baseURL `/server/api` (dev: Vite proxy). The two frontends never share code and never call each other.

### Why no UI framework
Per the owner's preference the site should feel like a warm hand-made "cabin", not a business dashboard. **No UI component library** (no Element Plus / Vant) is used. Base components (button/card/input/tag) and icons (feather, cabin) are self-authored with inline SVG. Visual language (warm cream background `#f7f1e3`, terracotta `#c9743b`, sage `#5b8c7b`, 14px radius) is defined as CSS variables in `styles/theme.css` in each frontend, kept identical across `pc` and `mobile` by convention.

### Backend layering (strict one-way)
`routes → controllers → services → db`.
- `routes/` only map paths/methods to controllers; no business logic, no try/catch.
- `controllers/` parse/validate input, call a service, and return via the response helper.
- `services/` hold business logic and touch Prisma; reusable across controllers; never aware of HTTP.
- `db/index.js` exports a single `PrismaClient` instance — never instantiate per request.
- `middleware/auth.js` validates the `Authorization: Bearer` JWT; `middleware/error.js` is the global error catcher.

### Response & error contract (shared by all three sides)
Every response is `{ code, data, message }`. `code: 0` = success; non-zero = failure with a Chinese `message`. Business error codes are numeric: `0` success, `1xxx` client errors (e.g. 1001 param, 1002 nickname taken, 1003 bad credentials, 1004 unauthenticated), `5xxx` server errors (5000 unknown). HTTP status maps 400/401/403/404/500 accordingly. Unknown server errors are logged and return `5000` without leaking stack traces. New error codes must be registered in `DEV-SERVER.md` §10.

### Auth model
Register/Login → bcrypt-hashed password (`passwordHash`, never plaintext, never in API responses) → JWT returned. Frontends store the token in `localStorage` (key `qianyu_token`) and attach it via an axios interceptor. Route guards redirect unauthenticated users to `/login`; the axios response interceptor clears the token and redirects on HTTP 401.

### Data & API conventions
- SQLite via Prisma; schema lives in `server/prisma/schema.prisma`. Models are `PascalCase` singular, fields `camelCase`, every table has `id Int @default(autoincrement())` and `createdAt`; sensitive fields hashed; no soft deletes. Changes go through `prisma migrate` — never hand-edit the DB.
- API paths are `kebab-case`, JSON-only, prefixed `/api` (proxied to `/server/api`). List endpoints take `page`/`pageSize` and return `{ list, total }`.

### Deployment
nginx serves `pc/dist` at `/` and `mobile/dist` at `/m` (both SPA, `try_files` fallback to `index.html`), and reverse-proxies `/server/` to `127.0.0.1:3000` (trailing slash strips the `/server` prefix so the backend sees `/api/...`). See `DEPLOYMENT.md` for the full config and release flow. Backend config (PORT, JWT_SECRET, JWT_EXPIRES_IN, DATABASE_URL) comes from `.env`, loaded centrally by `src/config/index.js`.

## Conventions to follow (read before editing)
- `docs/ARCHITECTURE.md` — locked decisions, API/DB/visual contracts.
- `docs/DEV-PC.md` — PC frontend structure, naming, component order, styling, reliability.
- `docs/DEV-MOBILE.md` — mobile specifics; §1–6,8–10 defer to `DEV-PC.md` to stay in sync.
- `docs/DEV-SERVER.md` — backend layering, response helper, error codes, Prisma/Auth rules.
- `docs/DEPLOYMENT.md` — nginx topology and release steps.
- Tooling: ESLint + Prettier + EditorConfig must be aligned across all three projects; JavaScript (ESM) everywhere; do not introduce a UI library or a shared code package.
