# 原项目分析报告（navjotdhanawat/saas-template）

> 分析日期：基于当前仓库快照（Git commit `4c87a2d`，文件时间 2025-10-12）
> 说明：本报告仅由静态代码阅读得出，不涉及任何业务代码修改。目标是为后续"企业级 SaaS 升级"提供事实基线。

---

## 1. 当前目录结构

项目为 **pnpm monorepo + Turborepo** 结构，根目录包含以下关键文件：

```
saas_rabc/
├── CLAUDE.md                     # 项目开发规则（升级后追加，非原模板内容）
├── README.md                     # 项目说明与快速上手
├── ROADMAP.md                    # 版本路线图（v1.0 → v3.0）
├── saas.md                       # 完整产品需求规格（约 1200 行）
├── package.json                  # 根脚本（turbo 驱动）
├── pnpm-workspace.yaml           # workspace: apps/* + packages/*
├── turbo.json                    # Turborepo 构建/测试任务编排
├── .env.example                  # 前后端环境变量示例
├── apps/
│   ├── api/                      # NestJS 后端
│   │   ├── src/
│   │   │   ├── main.ts          # 启动引导
│   │   │   ├── app.module.ts    # 根模块
│   │   │   ├── common/          # 装饰器、守卫、过滤器、拦截器、DTO
│   │   │   ├── modules/         # auth / users / organizations / health
│   │   │   └── prisma/          # PrismaService / PrismaModule（Global）
│   │   ├── prisma/
│   │   │   └── schema.prisma    # 数据模型（无 migrations/seed）
│   │   └── package.json
│   └── web/                      # Next.js 前端
│       ├── app/                 # App Router
│       │   ├── (auth)/          # login / register
│       │   └── (dashboard)/     # dashboard / organization / team / settings / billing
│       ├── components/
│       │   ├── dashboard/       # app-sidebar / user-nav / org-switcher / command-palette
│       │   └── ui/              # shadcn/ui 组件
│       ├── hooks/               # use-auth / use-mobile / index
│       ├── lib/                 # api-client / stores / utils
│       └── package.json
├── packages/
│   ├── shared/                   # @saas/shared（类型与常量）
│   ├── eslint-config/            # @saas/eslint-config（ESLint 9 flat config）
│   └── typescript-config/        # @saas/typescript-config（base/nestjs/nextjs）
└── docker/
    └── docker-compose.yml       # PostgreSQL 16 + Redis 7 + Mailpit
```

**关键观察点**

- `apps/api/prisma/` 目录下**只有 `schema.prisma`，没有 `migrations/`，也没有 `seed.ts`**（`package.json` 里声明了 `db:seed` 脚本指向 `tsx prisma/seed.ts`，但该文件不存在）。
- 全仓库**未发现任何测试文件**（`.spec.ts` / `.test.ts` 均为空）。
- 根脚本中声明了 `test: turbo test`，但 `apps/api` 用 `vitest`、`apps/web` 未声明 `test` 脚本 —— 测试流程实际不可用。
- Git 仓库基线只有一个 commit（`add 123.txt`），当前业务文件全部处于 untracked 状态。

---

## 2. 前端架构（apps/web）

### 技术栈

| 方面 | 选型 |
|------|------|
| 框架 | Next.js `^15.1.3`，App Router（`app/` 目录），React 19 |
| 构建 | `next dev --turbopack`（开发），`next build` |
| UI | shadcn/ui（style: new-york，RSC 模式）+ Tailwind CSS 4 + lucide-react |
| 表单 | React Hook Form + Zod（`@hookform/resolvers`） |
| 服务端状态 | TanStack Query `^5.62.8` |
| 客户端状态 | Zustand `^5.0.9`（persist middleware，localStorage） |
| 主题 | next-themes（light / dark / system） |
| 路径别名 | `@/*` → 项目根（tsconfig paths） |
| 跨包引用 | `transpilePackages: ["@saas/shared"]` |

### 路由结构（App Router）

| 路由 | 说明 |
|------|------|
| `/` | 营销落地页（Hero / Features / Pricing） |
| `/(auth)/login`、`/(auth)/register` | 邮箱密码 + Google/GitHub OAuth 按钮 |
| `/(dashboard)/layout.tsx` | 客户端布局：鉴权守卫 + Sidebar + Header + CommandPalette |
| `/dashboard` | 概览统计卡片 + 组织列表 |
| `/dashboard/organization` | 组织设置（general settings / danger zone） |
| `/dashboard/team` | 成员列表 + 邀请弹窗 + 移除确认（部分未接 API） |
| `/dashboard/settings` | 个人资料 / 账号安全 / 通知偏好 |
| `/dashboard/billing` | 计费页（静态价格卡片，未接 Stripe） |

### 数据流与状态

- **`lib/api-client.ts`**：手写 fetch 封装 `ApiClient`。
  - 自动附加 `Authorization: Bearer <accessToken>`（从 Zustand store 读取）。
  - **401 自动刷新**：单次重试逻辑调用 `/auth/refresh`，成功后用新 token 重放请求。
  - 错误统一从响应体 `error.message` 提取。
- **`lib/stores/auth-store.ts`**：Zustand + `persist` 存储 `accessToken` / `refreshToken` / `user` / `isAuthenticated` / `isLoading`，持久化到 `localStorage["auth-storage"]`（只 `partialize` 部分字段）。
- **`hooks/use-auth.ts`** 聚合了 `useAuth / useLogin / useRegister / useLogout / useUser / useOrganizations / useCreateOrganization`。
- **鉴权守卫**：`(dashboard)/layout.tsx` 依赖客户端 store 的 `isAuthenticated`，未登录则 `router.push('/login?redirect=...')`；**纯客户端守卫，无 middleware 或服务端保护，页面/接口自身不强制服务端鉴权**。

### 前端功能实现状态

| 页面/功能 | 状态 |
|-----------|------|
| 登录 / 注册（邮箱 + OAuth 跳转） | 已实现 |
| `/auth/callback`（OAuth 回调接收 token） | **缺失**（ROADMAP v1.1 待办，OAuth 跳转会 404） |
| 组织创建 | 已实现（org-switcher） |
| 组织设置保存 | **前端伪造**（`setTimeout` 模拟，未调 update API） |
| 成员邀请 | 已接 API |
| 移除成员 / 修改角色 | **UI 存在但未接 API** |
| 计费 / Stripe | **纯静态展示** |
| 头像 / Logo 上传 | **按钮占位，无实现** |
| 忘记密码 | 链接存在但页面/接口缺失 |

---

## 3. 后端架构（apps/api）

### 技术栈

| 方面 | 选型 |
|------|------|
| 框架 | NestJS `^10.4.15`（Express 平台） |
| ORM | Prisma `^6.1.0`（PostgreSQL） |
| 鉴权 | `@nestjs/passport` + `@nestjs/jwt` + passport-jwt / passport-google-oauth20 / passport-github2 |
| 校验 | class-validator + class-transformer |
| 文档 | `@nestjs/swagger`（Swagger UI 挂载于 `/docs`） |
| 限流 | `@nestjs/throttler` `^6.3.0`（**内存态**，未接 Redis） |
| 密码 | bcrypt（12 rounds） |
| 路径别名 | `@/*` → `src/*` |

### 目录与模块划分

```
src/
├── main.ts                    # 全局前缀 api/v1、CORS、ValidationPipe、Swagger
├── app.module.ts              # ConfigModule(global) + ThrottlerModule + 业务模块
├── prisma/                    # PrismaService（$connect/$disconnect/cleanDatabase）+ 全局模块
├── common/
│   ├── decorators/            # @Public @Roles @CurrentUser
│   ├── guards/                # jwt-auth.guard / roles.guard
│   ├── filters/               # http-exception.filter（统一错误结构）
│   ├── interceptors/          # transform.interceptor（统一成功结构）
│   └── dto/                   # PaginationQueryDto / PaginationMeta / ApiResponseDto
└── modules/
    ├── auth/                  # controller / service / strategies(jwt,google,github) / guards / dto
    ├── users/                 # controller / service / dto
    ├── organizations/         # controller / service / dto
    └── health/                # 数据库连通性健康检查
```

### 全局机制

- **全局前缀**：`api/v1`（`API_PREFIX` 环境变量）。
- **CORS**：`origin = FRONTEND_URL`（默认 `http://localhost:3000`），`credentials: true`。
- **ValidationPipe**：`whitelist: true`、`forbidNonWhitelisted: true`、`transform: true`。
- **统一响应（TransformInterceptor）**：成功包 `{ success, data, meta? }`。
- **统一异常（HttpExceptionFilter）**：`{ success:false, error:{code,message,statusCode,details?}, timestamp, path }`。
- **全局 JWT 守卫**：`JwtAuthGuard` 通过 `APP_GUARD` 注册，`@Public()` 标记的端点跳过。
- **限流器**：`ThrottlerModule.forRoot` 定义 `short(1s/3)、medium(10s/20)、long(60s/100)` 三档命名限流，但**控制器中未见 `@Throttle` 实际使用**，且为默认内存存储。

### 功能模块概览

| 模块 | 端点 | 说明 |
|------|------|------|
| Authentication | `POST /auth/register` `/login` `/refresh` `/logout`；`GET /auth/me`；`GET /auth/google` `/google/callback` `/github` `/github/callback` | JWT 双 token + OAuth |
| Users | `GET/PATCH/DELETE /users/me`；`GET /users/me/organizations` | 个人资料 + 所属组织 |
| Organizations | `POST /organizations`；`GET/PATCH/DELETE /organizations/:slug`；`GET /organizations/:slug/members`；`POST /organizations/:slug/invitations`；`PATCH/DELETE /organizations/:slug/members/:memberId` | 多租户 + 成员管理 |
| Health | `GET /health` | 数据库探测 |

---

## 4. 数据模型（Prisma schema）

共 **10 个模型 + 3 个枚举**，全部主键用 `uuid()`，映射到 snake_case 表名。

### 模型清单

| 模型 | 表名 | 用途 | 关键字段 |
|------|------|------|----------|
| `User` | `users` | 用户主体 | `email(unique)`、`passwordHash?`、`name?`、`image?`、`emailVerified?` |
| `Account` | `accounts` | OAuth 账号关联 | `[provider, providerAccountId] unique`，`type/provider/accessToken?/refreshToken?` |
| `Session` | `sessions` | 刷新令牌会话 | `refreshToken(unique)`、`expiresAt`、`ipAddress?`、`userAgent?` |
| `Organization` | `organizations` | 租户 | `name`、`slug(unique)`、`logo?` |
| `OrganizationMember` | `organization_members` | 用户-组织成员关系 | `role(Role)`，`[userId, organizationId] unique` |
| `Invitation` | `invitations` | 成员邀请 | `email`、`role`、`token(unique, uuid)`、`expiresAt`、`invitedById` |
| `Subscription` | `subscriptions` | 计费订阅 | `organizationId(unique)`、Stripe 字段、`status`、`plan`、周期字段 |
| `ApiKey` | `api_keys` | API 密钥 | `keyHash`、`keyPrefix`、`scopes(String[])`、`lastUsedAt?`、`expiresAt?` |
| `AuditLog` | `audit_logs` | 审计日志 | `organizationId?/userId?`、`action`、`entity/entityId?`、`metadata(Json?)`、`ipAddress?` |
| `Notification` | `notifications` | 站内通知 | `userId`、`type/title/message?`、`read`、`metadata(Json?)` |

### 枚举

| 枚举 | 值 |
|------|----|
| `Role` | `admin` / `member` |
| `Plan` | `free` / `pro` / `enterprise` |
| `SubscriptionStatus` | `active` / `canceled` / `past_due` / `trialing` / `incomplete` |

### 模型可用性

- **已接入业务代码**：`User`、`Organization`、`OrganizationMember`、`Session`、`Subscription`（创建组织时写 `free/active`）、`Invitation`（邀请时写入，但**不发送邮件、无接受流程**）。
- **仅定义未使用**：`Account`（模型存在，但 AuthService OAuth 流程实际未写 account 关联逻辑？—— 已复核：`oauthLogin` 中有 `account.findFirst/create` 代码，但路径上 `Account` 的 OAuth token 字段基本未回写）、`ApiKey`、`AuditLog`、`Notification` —— 模型中定义但**没有任何模块代码读写它们**。

> 修正上表歧义：`Account` 在 `auth.service.ts` 的 `oauthLogin` 中确有创建/查询逻辑；`ApiKey`、`AuditLog`、`Notification` 为**纯 schema 模型，代码零使用**。

---

## 5. Auth 流程

### 邮箱/密码注册 → 登录

1. **注册**：`POST /auth/register`
   - 邮箱转小写查重 → `bcrypt.hash(password, 12)` → 创建 `User` → 签发双 token。
2. **登录**：`POST /auth/login`
   - 查用户（无 `passwordHash` 的用户会统一提示"Invalid email or password"）→ `bcrypt.compare` → 签发双 token。
3. **签发**（`generateAuthResponse`）：
   - `accessToken`：payload `{ sub, email, type:"access" }`，有效期 `JWT_ACCESS_EXPIRATION`（默认 15m）。
   - `refreshToken`：payload `{ sub, email, type:"refresh" }`，有效期 `JWT_REFRESH_EXPIRATION`（默认 7d）。
   - refresh token 存入 `Session` 表（`expiresAt` 硬编码 +7 天）。

### 刷新与登出

- **刷新**：`POST /auth/refresh`
  - 校验 JWT 且 `type === "refresh"` → 查 `Session.refreshToken` 且未过期 → **删除旧 session → 签发新 token**（实现"令牌轮换"）。
- **登出**：`POST /auth/logout`，按 refreshToken `deleteMany` session。
- 前端 `api-client` 收到 401 时自动用 refresh 重试一次。

### 访问鉴权（服务端）

- 全局 `JwtAuthGuard` → `@Public()` 跳过；其余端点要求请求中存在 `request.user`。
- `JwtStrategy.validate` 检查 `type === "access"` 并回查 `User` 表，返回用户对象。

### OAuth

- Google / GitHub 策略（passport）：回调地址 `http://localhost:3001/api/v1/auth/{provider}/callback`。
- 回调将 token 通过 **URL query 参数**重定向到 `${FRONTEND_URL}/auth/callback?accessToken=...&refreshToken=...`。
- **前端 `/auth/callback` 页面不存在** → OAuth 流程实际中断（ROADMAP v1.1 已列入）。
- **安全风险**：access/refresh token 明文出现在 URL query 中，会被浏览器历史、日志、Referer 泄露。

---

## 6. RBAC 实现

### 现有设计

- 角色只有两类：**`admin` / `member`**，通过 `OrganizationMember.role` 绑定到"用户 × 组织"。
- 前端（`packages/shared`）与后端 Prisma 各维护了一套角色常量/枚举（`ROLES` 常量 vs `Role` enum）。

### 鉴权路径

1. **`@Roles(...roles)` 装饰器**：在 controller 上声明所需角色（`ROLES_KEY` 元数据）。
2. **`RolesGuard`**：读 `ROLES_KEY`，从 `request.organizationMember` 取成员记录，比对 `requiredRoles.includes(membership.role)`。

### 关键缺陷

- **`RolesGuard` 实际上不可用**：
  - 它读取 `request.organizationMember`，但**没有任何代码把成员关系写入 request**（无 `OrganizationMemberGuard` / 中间件 / 服务层注入），因此该值恒为 `undefined` → 永远抛 `ForbiddenException("Not a member of this organization")`。
  - 搜索结果确认：**全代码库没有任何 `@Roles(` 实际调用**，`RolesGuard` 也未被 `APP_GUARD` 注册。
- **权限检查散落在 controller 层手动完成**：`organizations.controller.ts` 中每个端点重复调用 `getMembership()` 后用 `if` 判断 `role !== "admin"`。
- RBAC 是**硬编码的二元角色判断**，无权限点（permission）抽象、无策略层、无角色层级，难以扩展自定义角色。

---

## 7. Redis 使用

### 现状：Redis 几乎未接入业务

| 用途 | 状态 |
|------|------|
| Cache | ❌ 未实现（无 ioredis/redis 客户端依赖，无缓存服务代码） |
| BullMQ Queue | ❌ 未实现（package.json 无 bullmq） |
| Rate Limit | ⚠️ 部分：`@nestjs/throttler` 已引入并配置三档限制，但为**默认内存存储**，未接 Redis 存储；且未见 `@Throttle` 装饰器被实际使用 |
| Session 存储 | ❌ session 存 PostgreSQL，未用 Redis |

- `REDIS_URL=redis://localhost:6379` 仅存在于 `.env.example`，**代码中没有任何读取该环境变量的地方**。
- `docker/docker-compose.yml` 已提供 `redis:7-alpine` 容器与健康检查，但 API 不消费它。

---

## 8. 已有功能（分为"真实现"与"占位"）

### ✅ 真实可用

- 邮箱/密码注册、登录、登出、刷新（JWT 双 token + 刷新轮换）。
- NestJS 模块化（auth / users / organizations / health） + Swagger 文档。
- 多租户基础：组织创建（含 slug 生成/查重 + 默认 free 订阅）、按 slug 查询、成员列表、邀请入库。
- 成员管理后端逻辑：邀请（含重复/已存在判断）、更新角色、移除成员、**"最后一个 admin 保护"**。
- 统一响应/异常格式 + 全局校验管道 + 分页 DTO。
- 前端完整 UI：登录/注册、dashboard、organization、team、settings、billing、command palette、暗色模式、响应式布局。

### ⚠️ 仅有 UI 或半成品

- OAuth：后端有策略与回调，但前端 `/auth/callback` 缺失，token 走 URL 明文。
- 组织设置保存：前端 `setTimeout` 伪造，未调 `PATCH /organizations/:slug`。
- 成员移除/改角色：UI 菜单存在，**按钮未接后端 API**。
- 计费页：静态价格卡片与 FAQ，`Upgrade` 按钮无逻辑。
- 忘记密码 / 邮件验证：DTO（`ForgotPasswordDto`、`ResetPasswordDto`）已定义，功能未实现。
- 邀请接受流程：`Invitation.token` 存在，但无 accept 端点、无邮件。
- 头像/Logo 上传：占位按钮无实现。

### 🧩 仅有模型 / 仅有配置

- `ApiKey`、`AuditLog`、`Notification` 数据模型存在但零业务代码。
- Stripe / Resend / S3 相关环境变量齐全，但无对应 SDK 依赖与代码。
- Health 只探测数据库，不测 Redis。

---

## 9. 技术债务

### A. 多租户隔离（与 CLAUDE.md「tenantId 隔离」直接冲突的高优先级项）

1. **跨租户数据泄漏风险**：
   - `updateMemberRole(slug, memberId, role)` 与 `removeMember(slug, memberId)` 只验证了 `memberId` 所属的成员记录，**删除/更新时未校验 `member.organizationId === 目标组织**。任意组织 admin 若获得其他组织的 `memberId`，即可跨租户改角色/删除成员。
   - 类似地，`inviteMember` 校验了当前操作者的 admin 身份，但成员读写路径缺少"memberId 属于本组织"的二次校验（`updateMemberRole` 中的 memberId 未做 org 归属检查）。
2. **无统一租户守卫/拦截器**：组织上下文（organizationId / membership）未进 request，`RolesGuard` 因此失效；租户过滤完全依赖 controller 手动实现，容易遗漏。
3. **`AuditLog`、`Notification`、`ApiKey` 等模型已含 organizationId/userId**，但一旦后续实现，需要统一的 tenant 中间件保证查询不越权。

### B. Auth / 安全

4. OAuth 回调把 token 放 URL query —— 明文泄露；`/auth/callback` 前端缺失。
5. 前端鉴权纯 client-side（localStorage + zustand），dashboard 无路由级服务端保护；token 存储于 localStorage，易受 XSS。
6. 登录无速率限制（throttler 已配置但未在 login 端点启用）、无账号锁定、无登录审计。
7. refresh token 过期时间硬编码 +7 天，与 `JWT_REFRESH_EXPIRATION` 环境变量不一致。
8. 密码重置/邮件验证有 DTO 无实现；`emailVerified` 字段未被注册流程使用。

### C. RBAC

9. `RolesGuard` + `request.organizationMember` 机制**不可用**（无写入方、无 `@Roles(` 使用、无全局注册），权限靠 controller 内重复的 `if` 判断。
10. 角色硬编码 `admin/member`，无 permission 抽象，扩展自定义角色成本高。

### D. Redis / 可观测性

11. Redis 声明在技术栈与 docker 中，但代码零使用（cache / BullMQ 均缺失）；rate limit 仅内存版。
12. 无结构化日志模块；`health` 不覆盖 redis；无 Sentry/PostHog SDK 实际接入（仅 env 占位）。

### E. 工程质量

13. **零测试**：无 `.spec.ts`/`.test.ts`/e2e；`vitest` 已在 api 依赖但无测试文件。
14. **无 Prisma migrations/seed**（`db:seed` 指向不存在的 `prisma/seed.ts`），部署只能 `db push`。
15. 部分代码用 `any`（`formatOrganization(org: any)`、request 用户对象 `(req as any).user`），类型不严。
16. 前端多处"TODO/假实现"：organization 保存、remove member、change role、billing upgrade、avatar 上传。
17. DTO 前端后端重复定义（`apps/web/lib/api-client.ts` 中大量内联类型），与 `@saas/shared` 的类型未复用。
18. `.env.example` 是前后端混合单文件，与 README「分别 copy 到 api/web」的流程不完全对应。

---

## 10. 改造计划（面向企业级 SaaS 升级的建议路线）

> 以下为**规划建议**，尚未实施。与 CLAUDE.md 约束对齐：PostgreSQL 16 / Redis 7 / Docker Compose / Prisma / NestJS Module / Next.js App Router / tenantId 隔离 / Redis 用于 Cache、BullMQ、Rate Limit。

### 阶段 0：基线加固（先还债，再做功能）

1. **补测试基础设施**：接通 `vitest`（api）与前端测试，为 auth / organizations / guards 补单测；仓库目前零测试。
2. **建立 Prisma migrations + seed**：`prisma migrate dev` 初始化迁移，新增可运行的 `seed.ts`。
3. **统一租户上下文**：
   - 新增 `TenantGuard` / `OrganizationContextGuard`：解析 `:slug`（或 header），校验 membership 后写入 `request.organizationMember` / `request.organizationId`。
   - 修复 `RolesGuard` 使其基于上述上下文工作，并全局 `APP_GUARD` 注册。
   - 修复 `updateMemberRole`/`removeMember` 的跨租户校验（memberId 必须属于当前 org）。
4. **收紧全部租户查询**：所有 SaaS 数据一律带 `organizationId` 过滤，建立可复用的 Prisma 扩展或 service 基类；后续新模块（audit/notification/api-key）从起点就隔离。

### 阶段 1：RBAC 升级

5. 设计 **Permission / Role / (可选 RoleBinding)** 模型：
   - 权限点常量（如 `org:manage`、`member:invite`、`billing:manage`、`audit:read`）。
   - 角色保留 `admin/member` 起步，但用 `role → permissions` 映射替代硬编码判断。
6. 把 controller 中的重复 `if (membership.role !== "admin")` 全部替换为 `@Roles()` + `RolesGuard` 或 `@Permissions()` 装饰器。
7. 前端按权限渲染（权限上下文 + `can()` hook），隐藏/禁用无权限操作。

### 阶段 2：Redis 接入（严格按 CLAUDE.md 用途）

8. **Rate Limit**：`@nestjs/throttler` 换成 Redis storage（`@nest-lab/throttler-storage-redis` 或自建 `ThrottlerStorage`），登录/重置等敏感端点显式加 `@Throttle`。
9. **Cache**：封装 `CacheService`（redis 客户端 GET/SET/失效），先用于组织信息 / 成员列表等读多写少接口。
10. **BullMQ**：引入 `@nestjs/bullmq`，建立 `jobs/`（邮件发送、审计写入、通知）队列与 worker 处理器。

### 阶段 3：补齐核心闭环

11. **Auth 深化**：
    - 实现密码重置 + 邮件验证（Resend / SMTP 经 BullMQ 队列异步发送）。
    - OAuth：新增前端 `/auth/callback`，token 改为 httpOnly cookie（或一次性 code）方式传输，杜绝 URL 明文。
    - 服务端路由保护（Next.js middleware 或 server-side guard 校验 JWT）。
12. **邀请闭环**：`POST /organizations/:slug/invitations` 触发邮件，新增 `POST /invitations/:token/accept` + 前端接受页。
13. **组织/成员前端闭环**：接通 update organization、remove/change member 按钮。

### 阶段 4：企业能力

14. **审计日志（AuditLog）**：接入统一 audit 服务，登录/成员/组织/权限变更写入，并提供 admin 查看与导出接口。
15. **通知中心（Notification）**：后端读写 + 前端通知铃铛/列表 + 已读状态。
16. **API Key（ApiKey）**：创建（仅返回一次明文）、哈希存储、scope 校验、过期/吊销，配合 `ApiKeyGuard`。
17. **计费（Stripe）**：checkout + webhook + 订阅状态同步（可选，视业务优先级）。

### 阶段 5：可观测性 / 工程化

18. 结构化日志（NestJS Logger / pino）+ 请求 ID + 审计关联。
19. 健康检查扩展 Redis/BullMQ；Sentinel/监控采集。
20. 测试覆盖率门禁 + CI（turbo lint / type-check / test）+ conventional commits。

### 优先级总览

| 优先级 | 事项 | 理由 |
|--------|------|------|
| P0 | 跨租户校验修复、统一 tenant 上下文、RBAC 可用化 | 直接关系数据安全底线 |
| P0 | 测试 + migrations/seed 补齐 | 一切改造的安全网 |
| P1 | Redis（rate limit/cache/bullmq）接入 | CLAUDE.md 明确要求 |
| P1 | 密码重置、邮箱验证、OAuth callback、邀请闭环 | 核心 SaaS 流程 |
| P2 | 审计/通知/APIKey/Stripe | 企业级能力扩展 |
| P3 | 日志、CI、可观测性 | 长期工程质量 |

---

## 附：与 CLAUDE.md 开发规则的对照

| CLAUDE.md 规则 | 现状 | 差距 |
|----------------|------|------|
| 基于 saas-template 二次开发 | ✅ 一致 | — |
| PostgreSQL 16 + Docker Compose | ✅ docker-compose 已配置 | 无 migrations/seed |
| Redis 7 用于 Cache / BullMQ / Rate Limit | ⚠️ 仅基础设施 | 业务零接入 |
| 禁止 Supabase/Firebase/MongoDB/Upstash | ⚠️ 代码未引入，但 `saas.md` 提及 Supabase/Neon/Upstash 作为可选托管 | 需求文档需清理表述 |
| 只能用 Prisma | ✅ | — |
| NestJS Module 架构 | ✅ | — |
| Next.js App Router | ✅ | — |
| 所有 SaaS 数据 tenantId 隔离 | ⚠️ 部分实现 | 见「技术债务 A」 |
| 重大功能：测试 / README / Git Commit | ❌ 零测试、README 未更新、业务文件未 commit | 需补齐 Git 与测试流程 |
