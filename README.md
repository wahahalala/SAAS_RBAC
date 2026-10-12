# SaaS Template

A production-ready, open-source SaaS starter template built with modern technologies. Get your SaaS product up and running in minutes, not months.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10-red)](https://nestjs.com/)

## ✨ Features

### Authentication
- [x] JWT authentication with access/refresh tokens
- [x] Refresh token in httpOnly cookie (server-stored hash, no localStorage JWT)
- [x] Session management (list / revoke / logout-all-devices)
- [x] Social login (Google, GitHub OAuth)
- [ ] Password reset flow
- [ ] Email verification

### Multi-Tenancy
- [x] Organizations with slug-based routing
- [x] Role-based access control (Admin/Member)
- [x] **RBAC permissions**: `@RequirePermission("project.create")` + `PermissionGuard` (Membership → Role → RolePermission → Permission), frontend `usePermission()` to hide UI
- [x] Member invitation system
- [x] Team management UI
- [x] **Tenant isolation**: `TenantGuard` validates `X-Tenant-Id` against the caller's Membership and `TenantInterceptor` opens a `TenantContext` (AsyncLocalStorage) for the request; every service query filters on that authorised `tenantId` (Tenant A can never read Tenant B data)
- [x] **Slug lookups are tenant-bound**: organization routes address the org by slug, which is resolved *within* the request's tenant — a member of two tenants cannot use one tenant's `X-Tenant-Id` to operate on the other's organization. There is no Prisma auto-scoping extension; scoping is explicit and fail-closed (`TenantContext.requireTenantId()`).
- [x] **Client tenant scope**: the web app sends `X-Tenant-Id` on every tenant-bound request; the active tenant is persisted in `localStorage`, switchable from the org switcher, and re-validated against the user's memberships on load

### Frontend
- [x] Next.js 15 with App Router
- [x] shadcn/ui components
- [x] Dark mode support
- [x] Command palette (⌘K)
- [x] Responsive dashboard layout
- [x] Beautiful landing page

### Backend
- [x] NestJS REST API with Swagger docs
- [x] Prisma ORM with PostgreSQL
- [x] Global exception handling
- [x] Request validation with class-validator
- [x] Redis: `RedisService` + `CacheService` + `@Cache()` decorator (RBAC permission cache, tenant settings cache, login rate limit)

### Tenant flow (API ↔ web)

Every tenant-bound request carries `X-Tenant-Id`; `TenantGuard` resolves it and stores the tenant on the request so `TenantInterceptor` can open the AsyncLocalStorage context.

| Route | Tenant scope |
|-------|--------------|
| `GET /users/me/organizations` | user-level — `@SkipTenantCheck()`, returns each membership's `tenantId` |
| `GET /auth/me`, `PATCH|DELETE /users/me` | user-level — `@SkipTenantCheck()` |
| `POST /organizations` | provisioning — `@SkipTenantCheck()` (no tenant exists yet) |
| `GET /auth/me/permissions`, `GET /organizations/:slug`, … | tenant-scoped — `X-Tenant-Id` required, else `403` |

The web client marks each call accordingly (`api-client.ts` → `tenantScoped`), resolves the active tenant in `useActiveTenant()` (keep the persisted one when still valid, otherwise fall back to the first organization), clears it on logout, and drops tenant-scoped React Query caches when the tenant changes.

Organization routes take a **slug**, not a tenant id, so the slug is always resolved *within* the request's tenant (`OrganizationsService.findBySlugInTenant` / `getMembership`). Without that binding a user who belongs to two tenants could send tenant A's `X-Tenant-Id` and operate on tenant B's organization.

### Tests

| Suite | Covers |
|-------|--------|
| `apps/api/test/tenant-discovery.spec.ts` | user-level routes skip the tenant check; memberships expose `tenantId` |
| `apps/api/test/organization-tenant-scope.spec.ts` | slug lookups are bound to the request tenant (cross-tenant slug is rejected, fail-closed without context) |
| `apps/api/test/tenant-isolation.spec.ts` | `TenantContext` scoping and concurrency safety |
| `apps/api/test/permission-guard.spec.ts` | RBAC allow/deny |
| `apps/web/test/tenant-header.spec.ts` | `X-Tenant-Id` injection, retry pinning, persistence and fallback |

`apps/api` tests hit a real PostgreSQL database (`docker compose up -d` first, then `pnpm --filter api test`).

### Developer Experience
- [x] pnpm monorepo with Turborepo
- [x] Shared TypeScript configs
- [x] ESLint 9 flat config
- [x] Docker Compose for local development

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 15, React 19, Tailwind CSS 4, shadcn/ui |
| **Backend** | NestJS 10, Prisma, PostgreSQL, Redis |
| **Worker** | NestJS 10, BullMQ (Redis queues) |
| **Shared** | `@saas/shared-types` (types/DTO), `@saas/validation` (Zod) |
| **Auth** | JWT, Passport.js, bcrypt |
| **Tooling** | pnpm, Turborepo, TypeScript 5.7 |

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker + Docker Compose (for local services)

### Setup

```bash
# Clone the repository
git clone https://github.com/navjotdhanawat/saas-template.git
cd saas-template

# Install dependencies
pnpm install

# Start local services (PostgreSQL, Redis, Mailpit)
docker compose up -d

# Optional: start development GUIs (pgAdmin, Redis Insight)
docker compose --profile tools up -d

# Setup environment
cp .env.example apps/api/.env
cp .env.example apps/web/.env.local

# Generate Prisma client & run migrations
pnpm db:generate
pnpm db:migrate

# Seed the database with demo data (idempotent, safe to re-run)
pnpm db:seed

# Start development
pnpm dev
```

> **Prisma 命令对照**：根目录通过 `pnpm --filter api` 转发到 `apps/api` 中的 Prisma CLI。
> 你也可以 `cd apps/api` 后直接运行原生命令：

| Monorepo 脚本 | 等价的原生命令（在 `apps/api` 内） |
|---------------|-------------------------------------|
| `pnpm db:generate` | `pnpm prisma generate` |
| `pnpm db:migrate` | `pnpm prisma migrate dev` |
| `pnpm db:seed` | `pnpm prisma db seed` |
| `pnpm db:studio` | `pnpm prisma studio` |

### Access Points

| Service | URL |
|---------|-----|
| Web App | http://localhost:3000 |
| API | http://localhost:3001/api/v1 |
| Worker (BullMQ processor) | no HTTP server — `pnpm --filter worker dev` |
| API Docs (Swagger) | http://localhost:3001/docs |
| Prisma Studio | `pnpm db:studio` |
| pgAdmin (optional `tools`) | http://localhost:5050 — login `admin@example.com` / `admin` |
| Redis Insight (optional `tools`) | http://localhost:5540 |
| Mailpit (email testing) | http://localhost:8025 |

### 数据库管理

```bash
# 启动全部基础设施服务
docker compose up -d

# 停止服务（保留数据卷）
docker compose down

# 停止并删除数据卷（重置数据库/Redis 数据）
docker compose down -v
```

| Command | Description |
|---------|-------------|
| `pnpm db:generate` | Generate Prisma client |
| `pnpm db:migrate` | Run database migrations (`prisma migrate dev`) |
| `pnpm db:seed` | Seed demo data (`prisma db seed`) |
| `pnpm db:studio` | Open Prisma Studio |

## 📁 Project Structure

```
├── apps/
│   ├── api/              # NestJS Backend
│   │   ├── src/
│   │   │   ├── modules/  # Feature modules (auth, users, organizations)
│   │   │   ├── common/   # Shared utilities (guards, decorators, filters)
│   │   │   └── prisma/   # Database service
│   │   └── prisma/       # Schema, migrations & seed
│   ├── web/              # Next.js Frontend
│   │   ├── app/          # App router pages
│   │   ├── components/   # React components
│   │   ├── hooks/        # Custom React hooks
│   │   └── lib/          # Utilities & API client
│   └── worker/           # NestJS background worker (BullMQ queues)
├── packages/
│   ├── shared/           # Compatibility facade → re-exports shared-types
│   ├── shared-types/     # Canonical types, DTO shapes & constants
│   ├── validation/       # Zod schemas + inferred types
│   ├── eslint-config/    # ESLint configurations
│   └── typescript-config/# TypeScript configurations
├── docker/               # Docker support files (pgAdmin config, ...)
└── docker-compose.yml    # Local services (PostgreSQL, Redis, Mailpit, pgAdmin, Redis Insight)
```

## 📜 Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all apps in development mode |
| `pnpm --filter worker dev` | Start the BullMQ worker only |
| `pnpm build` | Build all apps for production |
| `pnpm lint` | Lint all packages |
| `pnpm type-check` | Type-check all apps |
| `pnpm test` | Run all test suites (api: vitest + Prisma, web: vitest) |
| `pnpm db:generate` | Generate Prisma client |
| `pnpm db:migrate` | Run database migrations (`prisma migrate dev`) |
| `pnpm db:seed` | Seed demo data (`prisma db seed`) |
| `pnpm db:studio` | Open Prisma Studio |
| `docker compose up -d` | Start local infra (PostgreSQL, Redis, Mailpit) |
| `docker compose --profile tools up -d` | Additionally start pgAdmin + Redis Insight |

## 🗺 Roadmap

### Version 1.0 (Current)
- [x] Core authentication (JWT, OAuth)
- [x] Multi-tenant organizations
- [x] Dashboard with settings pages
- [x] Landing page with pricing

### Version 1.1 (In Progress)
- [x] Frontend `X-Tenant-Id` propagation + active-tenant switcher
- [ ] OAuth callback page (fix OAuth flow)
- [ ] Complete member management (remove, change role)
- [ ] Password reset flow
- [ ] Accept invitation flow

### Version 1.2 (Planned)
- [ ] Email service integration (@nestjs-modules/mailer)
- [ ] Email verification
- [ ] Invitation emails
- [ ] Notification system

### Version 2.0 (Future)
- [ ] Stripe integration
- [ ] Subscription management
- [ ] Usage-based billing
- [ ] Customer portal
- [ ] Audit logging
- [ ] API keys management

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

Built with ❤️ by [Navjot Dhanawat](https://github.com/navjotdhanawat)
