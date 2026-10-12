# 🚀 SaaS Template - Complete Requirements

> A production-ready, scalable SaaS boilerplate built with **NestJS** (Backend API) + **Next.js 15** (Frontend), PostgreSQL, Prisma, and modern best practices.

---

## 🏗 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        MONOREPO (pnpm)                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────────┐         ┌─────────────────────────────┐   │
│   │   apps/web      │         │        apps/api             │   │
│   │   (Next.js 15)  │ ──────► │        (NestJS)             │   │
│   │                 │   REST  │                             │   │
│   │   • SSR/SSG     │   API   │   • REST API (/api/v1/*)    │   │
│   │   • React 19    │         │   • WebSocket (real-time)   │   │
│   │   • shadcn/ui   │         │   • Background Jobs         │   │
│   │   • Tailwind    │         │   • Prisma ORM              │   │
│   └─────────────────┘         └─────────────────────────────┘   │
│                                          │                      │
│   ┌─────────────────┐                    │                      │
│   │ packages/shared │◄───────────────────┘                      │
│   │ (Types, Utils)  │                                           │
│   └─────────────────┘                                           │
│                                          │                      │
│                               ┌──────────▼──────────┐           │
│                               │    PostgreSQL       │           │
│                               │    + Redis          │           │
│                               └─────────────────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📋 Table of Contents

1. [Tech Stack](#tech-stack)
2. [Authentication & Authorization](#authentication--authorization)
3. [Multi-Tenancy](#multi-tenancy)
4. [User Management](#user-management)
5. [Billing & Subscriptions](#billing--subscriptions)
6. [Admin Dashboard](#admin-dashboard)
7. [API Design (NestJS)](#api-design-nestjs)
8. [Database Design](#database-design)
9. [Security Features](#security-features)
10. [Email & Notifications](#email--notifications)
11. [File Storage](#file-storage)
12. [Analytics & Monitoring](#analytics--monitoring)
13. [Developer Experience](#developer-experience)
14. [UI/UX Components](#uiux-components)
15. [Deployment & Infrastructure](#deployment--infrastructure)
16. [Internationalization](#internationalization)
17. [Landing Page & Marketing](#landing-page--marketing)
18. [Legal & Compliance](#legal--compliance)

---

## 🛠 Tech Stack

### Backend (NestJS)
| Technology | Purpose |
|------------|--------|
| **NestJS 10+** | Backend framework with modular architecture |
| **TypeScript** | Type safety across the entire codebase |
| **PostgreSQL** | Primary database |
| **Prisma** | Type-safe ORM with migrations |
| **Redis** | Caching, sessions, rate limiting, queues |
| **BullMQ** | Background job processing |
| **Passport.js** | Authentication strategies |
| **class-validator** | DTO validation |
| **class-transformer** | Object transformation |
| **@nestjs/swagger** | Auto-generated API documentation |
| **@nestjs/websockets** | Real-time communication |

### Frontend (Next.js 15)
| Technology | Purpose |
|------------|--------|
| **Next.js 15** | React framework (App Router) |
| **React 19** | UI library with Server Components |
| **TypeScript** | Type safety |
| **TanStack Query** | Server state management |
| **Zustand** | Client state management |
| **React Hook Form** | Form handling |
| **Zod** | Schema validation |

### Authentication
| Technology | Purpose |
|------------|--------|
| **Passport.js** | NestJS authentication |
| **@nestjs/jwt** | JWT token handling |
| **bcrypt** | Password hashing |
| **Refresh Tokens** | Secure session management |

### Payments
| Technology | Purpose |
|------------|--------|
| **Stripe** | Primary payment processor |
| **stripe-node** | Stripe SDK for NestJS |

### Email
| Technology | Purpose |
|------------|--------|
| **@nestjs-modules/mailer** | Email service |
| **Resend** | Email delivery |
| **React Email** | Email templates |

### UI/Styling
| Technology | Purpose |
|------------|--------|
| **Tailwind CSS 4** | Utility-first CSS |
| **shadcn/ui** | Component library |
| **Framer Motion** | Animations |
| **Lucide Icons** | Icon library |

### Infrastructure
| Technology | Purpose |
|------------|--------|
| **Vercel** | Frontend hosting (Next.js) |
| **Railway / Render** | Backend hosting (NestJS) |
| **Neon / Supabase** | PostgreSQL database |
| **Upstash** | Serverless Redis |
| **Cloudflare R2 / AWS S3** | File storage |

### Monorepo Tooling
| Technology | Purpose |
|------------|--------|
| **pnpm** | Package manager |
| **Turborepo** | Monorepo build system |
| **Shared Types** | Common TypeScript types |

### Monitoring
| Technology | Purpose |
|------------|--------|
| **Sentry** | Error tracking (both apps) |
| **PostHog** | Product analytics |
| **Prometheus + Grafana** | API metrics (optional) |

---

## 🔐 Authentication & Authorization

### Authentication Methods
- [ ] **Email/Password** - Traditional email + password login
- [ ] **Magic Links** - Passwordless email authentication
- [ ] **OAuth Providers**
  - [ ] Google
  - [ ] GitHub
  - [ ] Microsoft
  - [ ] Apple
  - [ ] LinkedIn
- [ ] **Two-Factor Authentication (2FA)**
  - [ ] TOTP (Authenticator apps)
  - [ ] SMS (optional, paid)
  - [ ] Backup codes

### Session Management
- [ ] JWT tokens with refresh token rotation
- [ ] Remember me functionality
- [ ] Session timeout configuration
- [ ] Active sessions list (view & revoke)
- [ ] Device tracking (browser, OS, location)
- [ ] "Sign out all devices" option

### Password Management
- [ ] Secure password hashing (bcrypt, 12 rounds)
- [ ] Password strength meter
- [ ] Password requirements enforcement
- [ ] Forgot password flow
- [ ] Password reset with expiring tokens
- [ ] Password change (requires current password)
- [ ] Password history (prevent reuse)

### Account Security
- [ ] Email verification on signup
- [ ] Email change with verification
- [ ] Account lockout after failed attempts
- [ ] Suspicious login detection
- [ ] Login history & audit log

---

## 🏢 Multi-Tenancy

### Tenant Architecture
- [ ] **Organization-based tenancy** (Team/Workspace model)
- [ ] Single user can belong to multiple organizations
- [ ] Organization switcher in UI
- [ ] Subdomain support (optional: `acme.app.com`)
- [ ] Custom domains per organization (enterprise)

### Data Isolation
- [ ] Row-level security (RLS) with `organizationId`
- [ ] All queries automatically scoped to current org
- [ ] Cross-tenant data access prevention
- [ ] Audit logging for data access

### Organization Management
- [ ] Create organization
- [ ] Update organization profile (name, logo, settings)
- [ ] Delete organization (with confirmation, data retention policy)
- [ ] Organization-level settings
- [ ] Billing per organization

---

## 👥 User Management

### User Profile
- [ ] Profile picture upload
- [ ] Display name
- [ ] Bio/Description
- [ ] Timezone preference
- [ ] Language preference
- [ ] Theme preference (light/dark/system)

### Team/Organization Roles
```
Admin       → Full access: manage members, settings, billing, org management
Member      → Standard access to features (no admin capabilities)
```

### Role Permissions Matrix
| Permission | Admin | Member |
|------------|:-----:|:------:|
| View Dashboard | ✅ | ✅ |
| Use Core Features | ✅ | ✅ |
| View Team Members | ✅ | ✅ |
| Invite Members | ✅ | ❌ |
| Remove Members | ✅ | ❌ |
| Change Member Roles | ✅ | ❌ |
| Manage Billing | ✅ | ❌ |
| Update Org Settings | ✅ | ❌ |
| Delete Organization | ✅ | ❌ |
| Manage API Keys | ✅ | ❌ |
| View Audit Logs | ✅ | ❌ |

### Invitation System
- [ ] Invite by email
- [ ] Bulk invite (CSV upload)
- [ ] Invitation expiration (7 days default)
- [ ] Resend invitation
- [ ] Cancel pending invitation
- [ ] Accept/Decline invitation flow
- [ ] Auto-join via domain (e.g., anyone with @company.com)

### Member Management
- [ ] View all members (with role badges)
- [ ] Change member role (Admin ↔ Member)
- [ ] Remove member (with confirmation)
- [ ] Transfer admin rights
- [ ] Activity log per member

---

## 💳 Billing & Subscriptions

### Pricing Plans
```
Free        → Limited features, X users, Y storage
Pro         → $29/month - Full features, unlimited users
Enterprise  → Custom pricing - SSO, SLA, dedicated support
```

### Subscription Features
- [ ] Monthly & Annual billing (with discount)
- [ ] Free trial period (14 days)
- [ ] Plan comparison page
- [ ] Upgrade/Downgrade flows
- [ ] Proration on plan change
- [ ] Cancel subscription (with feedback)
- [ ] Pause subscription option
- [ ] Reactivate subscription

### Payment Methods
- [ ] Credit/Debit cards (via Stripe)
- [ ] Multiple payment methods per customer
- [ ] Default payment method selection
- [ ] Card update/removal

### Invoices & Receipts
- [ ] Invoice generation
- [ ] Invoice PDF download
- [ ] Invoice history
- [ ] Email receipts
- [ ] Billing address management

### Usage-Based Billing (Optional)
- [ ] Track usage metrics
- [ ] Usage limits per plan
- [ ] Overage charges
- [ ] Usage dashboard

### Webhooks
- [ ] Handle Stripe webhooks
  - [ ] `checkout.session.completed`
  - [ ] `customer.subscription.created`
  - [ ] `customer.subscription.updated`
  - [ ] `customer.subscription.deleted`
  - [ ] `invoice.payment_succeeded`
  - [ ] `invoice.payment_failed`

---

## 🎛 Admin Dashboard

### Super Admin Panel (Platform Owners)
- [ ] **Dashboard Overview**
  - [ ] Total users / organizations
  - [ ] MRR (Monthly Recurring Revenue)
  - [ ] Churn rate
  - [ ] Signups graph
  - [ ] Active users graph
  
- [ ] **User Management**
  - [ ] List all users
  - [ ] Search & filter users
  - [ ] View user details
  - [ ] Impersonate user (with audit log)
  - [ ] Ban/Suspend user
  - [ ] Delete user
  
- [ ] **Organization Management**
  - [ ] List all organizations
  - [ ] View organization details
  - [ ] Manage organization subscription
  - [ ] Delete organization
  
- [ ] **Subscription Management**
  - [ ] Active subscriptions
  - [ ] Subscription changes log
  - [ ] Manual subscription override
  
- [ ] **Feature Flags**
  - [ ] Enable/disable features globally
  - [ ] A/B testing configuration
  - [ ] Beta access management
  
- [ ] **System Health**
  - [ ] API response times
  - [ ] Error rates
  - [ ] Database metrics
  - [ ] Queue depths

### Organization Admin Panel (Customers)
- [ ] **Organization Settings**
  - [ ] Profile & branding
  - [ ] Team members
  - [ ] Billing & invoices
  - [ ] API keys
  - [ ] Integrations
  - [ ] Security settings
  - [ ] Audit log

---

## 🔌 API Design (NestJS)

### NestJS Architecture
```
api/
├── src/
│   ├── main.ts                    # Bootstrap
│   ├── app.module.ts              # Root module
│   ├── common/                    # Shared utilities
│   │   ├── decorators/            # Custom decorators
│   │   ├── filters/               # Exception filters
│   │   ├── guards/                # Auth guards
│   │   ├── interceptors/          # Response interceptors
│   │   ├── pipes/                 # Validation pipes
│   │   └── dto/                   # Common DTOs
│   ├── modules/
│   │   ├── auth/                  # Authentication module
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── strategies/        # Passport strategies
│   │   │   ├── guards/            # JWT, API Key guards
│   │   │   └── dto/
│   │   ├── users/                 # User management
│   │   ├── organizations/         # Multi-tenancy
│   │   ├── billing/               # Stripe integration
│   │   ├── notifications/         # Email & push
│   │   └── webhooks/              # Incoming webhooks
│   ├── jobs/                      # BullMQ background jobs
│   └── prisma/                    # Prisma module
├── prisma/
│   ├── schema.prisma
│   └── migrations/
└── test/
```

### API Versioning
- [ ] URL-based versioning (`/api/v1/`, `/api/v2/`)
- [ ] Version modules in NestJS
- [ ] Deprecation headers for old versions

### API Response Format
```typescript
// Success Response
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "hasMore": true
  }
}

// Error Response
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email format",
    "statusCode": 400,
    "details": [
      { "field": "email", "message": "Must be a valid email" }
    ]
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "path": "/api/v1/users"
}
```

### NestJS Features to Implement
- [ ] **Exception Filters** - Global exception handling
- [ ] **Validation Pipes** - DTO validation with class-validator
- [ ] **Interceptors** - Response transformation, logging
- [ ] **Guards** - Authentication, authorization, rate limiting
- [ ] **Decorators** - Custom decorators (@CurrentUser, @Roles, @Public)

### Authentication
- [ ] **JWT Access Tokens** (short-lived: 15 min)
- [ ] **Refresh Tokens** (long-lived: 7 days, stored in DB)
- [ ] **API Keys** (for server-to-server)
  - [ ] Create API key (hashed storage)
  - [ ] Revoke API key
  - [ ] API key scopes/permissions
  - [ ] API key expiration
- [ ] Passport strategies (Local, JWT, API Key)

### Rate Limiting
- [ ] @nestjs/throttler integration
- [ ] Redis-backed rate limiting
- [ ] Different limits per plan:
  - Free: 100 req/min
  - Pro: 1000 req/min
  - Enterprise: Custom
- [ ] Rate limit headers (`X-RateLimit-*`)
- [ ] Per-endpoint rate limits

### API Documentation
- [ ] **Swagger/OpenAPI** via @nestjs/swagger
- [ ] Auto-generated from DTOs and decorators
- [ ] Interactive Swagger UI at `/api/docs`
- [ ] API versioning in docs
- [ ] Example requests/responses

### Background Jobs (BullMQ)
- [ ] Email sending queue
- [ ] Webhook delivery queue
- [ ] Report generation
- [ ] Data cleanup jobs
- [ ] Bull Board UI for job monitoring

### Webhooks (Outgoing)
- [ ] Webhook endpoints configuration per org
- [ ] Event types selection
- [ ] Webhook signatures (HMAC-SHA256)
- [ ] Retry logic with exponential backoff
- [ ] Webhook delivery logs
- [ ] Webhook testing endpoint

### WebSocket Support
- [ ] @nestjs/websockets with Socket.IO
- [ ] Real-time notifications
- [ ] Live updates for dashboards
- [ ] JWT authentication for WebSocket
- [ ] Room-based subscriptions (per org)

---

## 🗄 Database Design

### Core Tables
```sql
-- Users
users
  id              UUID PRIMARY KEY
  email           VARCHAR UNIQUE NOT NULL
  emailVerified   TIMESTAMP
  passwordHash    VARCHAR
  name            VARCHAR
  image           VARCHAR
  createdAt       TIMESTAMP
  updatedAt       TIMESTAMP

-- Organizations (Tenants)
organizations
  id              UUID PRIMARY KEY
  name            VARCHAR NOT NULL
  slug            VARCHAR UNIQUE NOT NULL
  logo            VARCHAR
  createdAt       TIMESTAMP
  updatedAt       TIMESTAMP

-- Organization Membership
organization_members
  id              UUID PRIMARY KEY
  userId          UUID REFERENCES users
  organizationId  UUID REFERENCES organizations
  role            ENUM('admin', 'member')
  createdAt       TIMESTAMP

-- Invitations
invitations
  id              UUID PRIMARY KEY
  email           VARCHAR NOT NULL
  organizationId  UUID REFERENCES organizations
  role            ENUM
  token           VARCHAR UNIQUE
  expiresAt       TIMESTAMP
  invitedById     UUID REFERENCES users
  createdAt       TIMESTAMP

-- Subscriptions
subscriptions
  id              UUID PRIMARY KEY
  organizationId  UUID REFERENCES organizations
  stripeId        VARCHAR UNIQUE
  status          ENUM('active', 'canceled', 'past_due', 'trialing')
  plan            ENUM('free', 'pro', 'enterprise')
  currentPeriodStart  TIMESTAMP
  currentPeriodEnd    TIMESTAMP
  cancelAtPeriodEnd   BOOLEAN
  createdAt       TIMESTAMP
  updatedAt       TIMESTAMP

-- API Keys
api_keys
  id              UUID PRIMARY KEY
  organizationId  UUID REFERENCES organizations
  name            VARCHAR
  keyHash         VARCHAR NOT NULL
  keyPrefix       VARCHAR NOT NULL  -- Show first chars
  scopes          VARCHAR[]
  lastUsedAt      TIMESTAMP
  expiresAt       TIMESTAMP
  createdAt       TIMESTAMP

-- Audit Log
audit_logs
  id              UUID PRIMARY KEY
  organizationId  UUID REFERENCES organizations
  userId          UUID REFERENCES users
  action          VARCHAR NOT NULL
  entity          VARCHAR
  entityId        UUID
  metadata        JSONB
  ipAddress       VARCHAR
  userAgent       VARCHAR
  createdAt       TIMESTAMP

-- Sessions
sessions
  id              UUID PRIMARY KEY
  userId          UUID REFERENCES users
  token           VARCHAR UNIQUE NOT NULL
  expiresAt       TIMESTAMP
  ipAddress       VARCHAR
  userAgent       VARCHAR
  createdAt       TIMESTAMP

-- Notifications
notifications
  id              UUID PRIMARY KEY
  userId          UUID REFERENCES users
  type            VARCHAR
  title           VARCHAR
  message         TEXT
  read            BOOLEAN DEFAULT false
  metadata        JSONB
  createdAt       TIMESTAMP
```

### Database Best Practices
- [ ] UUIDs for primary keys
- [ ] Soft deletes where appropriate (`deletedAt`)
- [ ] Timestamps on all tables (`createdAt`, `updatedAt`)
- [ ] Indexes on foreign keys and frequently queried fields
- [ ] JSON columns for flexible metadata
- [ ] Database-level constraints

---

## 🛡 Security Features

### Input Validation
- [ ] Zod schemas for all inputs
- [ ] Sanitize HTML content
- [ ] SQL injection prevention (Prisma handles this)
- [ ] File upload validation (type, size)

### Rate Limiting
- [ ] Login attempts (5/minute)
- [ ] Password reset (3/hour)
- [ ] API endpoints (plan-based)
- [ ] Signup (10/hour per IP)

### Headers & CORS
- [ ] Strict CORS policy
- [ ] Security headers (via Next.js)
  - [ ] `X-Frame-Options`
  - [ ] `X-Content-Type-Options`
  - [ ] `Strict-Transport-Security`
  - [ ] `Content-Security-Policy`
  - [ ] `Referrer-Policy`

### Data Protection
- [ ] Encryption at rest (database level)
- [ ] Encryption in transit (TLS/HTTPS)
- [ ] Sensitive data masking in logs
- [ ] PII handling compliance
- [ ] Data export (GDPR)
- [ ] Data deletion (right to be forgotten)

### Audit Logging
- [ ] Authentication events
- [ ] Authorization failures
- [ ] Data changes (create, update, delete)
- [ ] Settings changes
- [ ] API access logs

---

## 📧 Email & Notifications

### Transactional Emails
- [ ] Welcome email
- [ ] Email verification
- [ ] Password reset
- [ ] Magic link login
- [ ] Invitation to organization
- [ ] Role changes
- [ ] Removed from organization
- [ ] Subscription confirmation
- [ ] Payment failed
- [ ] Invoice receipt
- [ ] Trial ending reminder
- [ ] Account deletion confirmation

### Email Templates
- [ ] Responsive HTML templates
- [ ] Plain text fallback
- [ ] Preview in development
- [ ] Template variables

### In-App Notifications
- [ ] Notification bell with count
- [ ] Notification dropdown/panel
- [ ] Mark as read (individual/all)
- [ ] Notification preferences
- [ ] Real-time updates (optional: WebSocket/SSE)

### Push Notifications (Future)
- [ ] Web push notifications
- [ ] PWA support

---

## 📁 File Storage

### File Upload
- [ ] Direct upload to cloud (presigned URLs)
- [ ] File type validation
- [ ] File size limits (per plan)
- [ ] Image optimization (on-the-fly resizing)
- [ ] Progress indicator

### Storage Management
- [ ] Usage tracking per organization
- [ ] Storage limits per plan
- [ ] File listing/browsing
- [ ] File deletion

### Supported Files
- [ ] Profile pictures
- [ ] Organization logos
- [ ] Document attachments (if needed)

---

## 📊 Analytics & Monitoring

### Product Analytics
- [ ] User signup tracking
- [ ] Feature usage tracking
- [ ] Funnel analysis
- [ ] Retention metrics
- [ ] Custom events

### Performance Monitoring
- [ ] API response times
- [ ] Error rates & error tracking
- [ ] Database query performance
- [ ] Core Web Vitals

### Alerting
- [ ] Error spike alerts
- [ ] Downtime alerts
- [ ] Payment failure alerts
- [ ] Usage threshold alerts

### Dashboards
- [ ] Real-time metrics
- [ ] Historical trends
- [ ] Custom reports

---

## 🧑‍💻 Developer Experience

### Code Quality
- [ ] ESLint configuration
- [ ] Prettier formatting
- [ ] Husky pre-commit hooks
- [ ] Lint-staged
- [ ] TypeScript strict mode
- [ ] Path aliases (@/ prefix)

### Testing
- [ ] Unit tests (Vitest)
- [ ] Integration tests
- [ ] E2E tests (Playwright)
- [ ] API tests
- [ ] Test coverage reports

### Documentation
- [ ] README with setup instructions
- [ ] Architecture documentation
- [ ] Component documentation (Storybook optional)
- [ ] API documentation
- [ ] Deployment guide

### Development Tools
- [ ] Docker Compose for local services
- [ ] Database seed scripts
- [ ] Prisma Studio for DB exploration
- [ ] Email preview (React Email)
- [ ] Environment variable validation

### Git Workflow
- [ ] Branch protection
- [ ] PR templates
- [ ] Conventional commits
- [ ] Automatic changelog
- [ ] CI/CD pipeline

---

## 🎨 UI/UX Components

### Layout Components
- [ ] App shell (sidebar + header + content)
- [ ] Auth layout (centered card)
- [ ] Marketing layout (header + footer)
- [ ] Dashboard layout

### Common Components
- [ ] Button (variants: primary, secondary, ghost, destructive)
- [ ] Input fields (text, email, password, textarea)
- [ ] Select/Dropdown
- [ ] Checkbox & Radio
- [ ] Switch/Toggle
- [ ] Date picker
- [ ] File upload
- [ ] Avatar
- [ ] Badge
- [ ] Card
- [ ] Modal/Dialog
- [ ] Drawer/Sheet
- [ ] Tabs
- [ ] Accordion
- [ ] Tooltip
- [ ] Popover
- [ ] Toast/Notifications
- [ ] Alert
- [ ] Progress bar
- [ ] Skeleton loaders
- [ ] Empty states
- [ ] Pagination
- [ ] Data table (sortable, filterable)
- [ ] Breadcrumbs
- [ ] Command palette (⌘K)

### Forms
- [ ] Form validation (React Hook Form + Zod)
- [ ] Error messages
- [ ] Success states
- [ ] Loading states
- [ ] Inline editing

### Navigation
- [ ] Sidebar (collapsible)
- [ ] Top navigation
- [ ] Mobile navigation (hamburger menu)
- [ ] Breadcrumbs
- [ ] User menu dropdown
- [ ] Organization switcher

### Themes
- [ ] Light mode
- [ ] Dark mode
- [ ] System preference detection
- [ ] Theme toggle
- [ ] CSS variables for theming

---

## 🚀 Deployment & Infrastructure

### Environments
```
Development  → Local machine
Staging      → staging.myapp.com
Production   → myapp.com
```

### CI/CD Pipeline
- [ ] Automated tests on PR
- [ ] Build validation
- [ ] Database migration check
- [ ] Preview deployments (Vercel)
- [ ] Production deploy on merge to main

### Environment Variables

#### API (NestJS) - `apps/api/.env`
```env
# App
NODE_ENV=development
PORT=3001
API_PREFIX=api/v1

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/saas_db

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Email (Resend)
RESEND_API_KEY=re_...
EMAIL_FROM=noreply@yourdomain.com

# Storage (S3/R2)
S3_BUCKET=
S3_REGION=
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_ENDPOINT=  # For Cloudflare R2

# Monitoring
SENTRY_DSN=
```

#### Web (Next.js) - `apps/web/.env`
```env
# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1

# Stripe (public key only)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Analytics
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com

# Sentry
SENTRY_DSN=
```

### Database Operations
- [ ] Automated migrations on deploy
- [ ] Database backups (daily)
- [ ] Point-in-time recovery
- [ ] Read replicas (scale)

### Scaling Considerations
- [ ] Serverless-first architecture
- [ ] Connection pooling (Prisma Accelerate/pgBouncer)
- [ ] CDN for static assets
- [ ] Edge functions where applicable
- [ ] Queue processing (background jobs)

---

## 🌐 Internationalization (i18n)

### Language Support
- [ ] Default: English
- [ ] Language detection (browser)
- [ ] Language switcher
- [ ] RTL support ready

### Implementation
- [ ] next-intl or similar
- [ ] Namespaced translations
- [ ] Date/time formatting
- [ ] Number formatting
- [ ] Currency formatting

---

## 🏠 Landing Page & Marketing

### Pages
- [ ] Home/Hero page
- [ ] Features page
- [ ] Pricing page
- [ ] About page
- [ ] Contact page
- [ ] Blog (optional)
- [ ] Changelog page
- [ ] Status page (link)
- [ ] Documentation (link)

### SEO
- [ ] Meta tags (title, description)
- [ ] Open Graph tags
- [ ] Twitter cards
- [ ] Sitemap.xml
- [ ] Robots.txt
- [ ] Canonical URLs
- [ ] Structured data (JSON-LD)

### Conversion
- [ ] Clear CTAs
- [ ] Social proof (testimonials, logos)
- [ ] FAQ section
- [ ] Demo/Trial signup
- [ ] Newsletter signup

---

## ⚖️ Legal & Compliance

### Legal Pages
- [ ] Terms of Service
- [ ] Privacy Policy
- [ ] Cookie Policy
- [ ] Refund Policy
- [ ] DPA (Data Processing Agreement) - Enterprise

### Compliance Features
- [ ] Cookie consent banner
- [ ] GDPR compliance
  - [ ] Data export
  - [ ] Data deletion
  - [ ] Consent management
- [ ] CCPA compliance (California)
- [ ] SOC 2 readiness (Enterprise)

### Data Handling
- [ ] Data retention policies
- [ ] Backup and recovery
- [ ] Incident response plan

---

## 📁 Project Structure (Monorepo)

```
saas-template/
├── apps/
│   ├── api/                           # 🔷 NestJS Backend
│   │   ├── src/
│   │   │   ├── main.ts                # Bootstrap application
│   │   │   ├── app.module.ts          # Root module
│   │   │   ├── common/
│   │   │   │   ├── decorators/        # @CurrentUser, @Roles, @Public
│   │   │   │   ├── filters/           # Exception filters
│   │   │   │   ├── guards/            # Auth, Role guards
│   │   │   │   ├── interceptors/      # Response transform, logging
│   │   │   │   ├── pipes/             # Validation pipes
│   │   │   │   └── dto/               # Common DTOs
│   │   │   ├── modules/
│   │   │   │   ├── auth/
│   │   │   │   │   ├── auth.module.ts
│   │   │   │   │   ├── auth.controller.ts
│   │   │   │   │   ├── auth.service.ts
│   │   │   │   │   ├── strategies/    # JWT, Local, API Key
│   │   │   │   │   ├── guards/
│   │   │   │   │   └── dto/
│   │   │   │   ├── users/
│   │   │   │   │   ├── users.module.ts
│   │   │   │   │   ├── users.controller.ts
│   │   │   │   │   ├── users.service.ts
│   │   │   │   │   └── dto/
│   │   │   │   ├── organizations/
│   │   │   │   │   ├── organizations.module.ts
│   │   │   │   │   ├── organizations.controller.ts
│   │   │   │   │   ├── organizations.service.ts
│   │   │   │   │   ├── members/       # Member management
│   │   │   │   │   ├── invitations/   # Invite flow
│   │   │   │   │   └── dto/
│   │   │   │   ├── billing/
│   │   │   │   │   ├── billing.module.ts
│   │   │   │   │   ├── billing.controller.ts
│   │   │   │   │   ├── billing.service.ts
│   │   │   │   │   ├── stripe.service.ts
│   │   │   │   │   └── dto/
│   │   │   │   ├── notifications/
│   │   │   │   │   ├── notifications.module.ts
│   │   │   │   │   ├── email.service.ts
│   │   │   │   │   └── push.service.ts
│   │   │   │   └── webhooks/
│   │   │   │       ├── webhooks.module.ts
│   │   │   │       └── stripe.webhook.ts
│   │   │   ├── jobs/                  # BullMQ processors
│   │   │   │   ├── email.processor.ts
│   │   │   │   └── webhook.processor.ts
│   │   │   ├── prisma/
│   │   │   │   ├── prisma.module.ts
│   │   │   │   └── prisma.service.ts
│   │   │   └── config/
│   │   │       └── configuration.ts
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── migrations/
│   │   │   └── seed.ts
│   │   ├── test/
│   │   ├── emails/                    # React Email templates
│   │   ├── nest-cli.json
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── web/                           # 🔶 Next.js 15 Frontend
│       ├── app/
│       │   ├── (auth)/                # Auth routes
│       │   │   ├── login/
│       │   │   │   └── page.tsx
│       │   │   ├── register/
│       │   │   │   └── page.tsx
│       │   │   ├── forgot-password/
│       │   │   │   └── page.tsx
│       │   │   └── verify-email/
│       │   │       └── page.tsx
│       │   ├── (dashboard)/           # Protected app routes
│       │   │   ├── layout.tsx         # Dashboard shell
│       │   │   ├── page.tsx           # Dashboard home
│       │   │   ├── settings/
│       │   │   │   ├── page.tsx       # Profile settings
│       │   │   │   ├── organization/
│       │   │   │   ├── billing/
│       │   │   │   └── team/
│       │   │   └── [feature]/         # Your app features here
│       │   ├── (marketing)/           # Public pages
│       │   │   ├── layout.tsx
│       │   │   ├── page.tsx           # Landing page
│       │   │   ├── pricing/
│       │   │   ├── features/
│       │   │   ├── about/
│       │   │   └── contact/
│       │   ├── api/                   # API routes (minimal)
│       │   │   └── auth/              # Auth callbacks only
│       │   ├── layout.tsx             # Root layout
│       │   └── globals.css
│       ├── components/
│       │   ├── ui/                    # shadcn/ui components
│       │   ├── forms/                 # Form components
│       │   ├── layout/                # Header, Sidebar, Footer
│       │   └── shared/                # Reusable components
│       ├── lib/
│       │   ├── api-client.ts          # API client (fetch wrapper)
│       │   ├── auth.ts                # Auth utilities
│       │   ├── utils.ts               # Utility functions
│       │   └── validations/           # Zod schemas (client-side)
│       ├── hooks/                     # Custom React hooks
│       ├── stores/                    # Zustand stores
│       ├── types/                     # TypeScript types
│       ├── public/
│       ├── middleware.ts              # Auth middleware
│       ├── next.config.ts
│       ├── tailwind.config.ts
│       ├── tsconfig.json
│       └── package.json
│
├── packages/
│   ├── shared/                        # 🔗 Shared code
│   │   ├── src/
│   │   │   ├── types/                 # Shared TypeScript types
│   │   │   │   ├── user.ts
│   │   │   │   ├── organization.ts
│   │   │   │   └── index.ts
│   │   │   ├── constants/             # Shared constants
│   │   │   │   ├── roles.ts           # Role definitions
│   │   │   │   └── plans.ts           # Plan definitions
│   │   │   ├── utils/                 # Shared utilities
│   │   │   └── index.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── eslint-config/                 # Shared ESLint config
│   │   └── package.json
│   │
│   └── typescript-config/             # Shared TS config
│       ├── base.json
│       ├── nextjs.json
│       ├── nestjs.json
│       └── package.json
│
├── docker/
│   ├── docker-compose.yml             # Local dev services
│   ├── docker-compose.prod.yml        # Production config
│   └── Dockerfile.api                 # NestJS Dockerfile
│
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                     # Test & lint on PR
│   │   ├── deploy-api.yml             # Deploy API to Railway
│   │   └── deploy-web.yml             # Deploy Web to Vercel
│   └── PULL_REQUEST_TEMPLATE.md
│
├── turbo.json                         # Turborepo config
├── pnpm-workspace.yaml                # pnpm workspace config
├── package.json                       # Root package.json
├── .env.example                       # Environment template
├── .gitignore
└── README.md
```

---

## 🗓 MVP Roadmap

### Phase 1: Foundation (Week 1-2)
- [ ] Project setup & configuration
- [ ] Database schema & Prisma setup
- [ ] Authentication (email/password, Google OAuth)
- [ ] User profile management
- [ ] Basic dashboard layout

### Phase 2: Multi-Tenancy (Week 3)
- [ ] Organization CRUD
- [ ] Organization switcher
- [ ] Invitation system
- [ ] Role-based access control

### Phase 3: Billing (Week 4)
- [ ] Stripe integration
- [ ] Subscription plans
- [ ] Checkout flow
- [ ] Customer portal
- [ ] Webhook handling

### Phase 4: Polish (Week 5)
- [ ] Email templates
- [ ] Settings pages
- [ ] Error handling
- [ ] Loading states
- [ ] Mobile responsiveness

### Phase 5: Launch Prep (Week 6)
- [ ] Landing page
- [ ] SEO optimization
- [ ] Legal pages
- [ ] Monitoring setup
- [ ] Documentation

---

## ✅ Success Criteria

The template is considered complete when:

1. ✨ **Authentication works** - Users can sign up, log in, reset password
2. 🏢 **Multi-tenancy works** - Users can create/switch organizations
3. 👥 **Team management works** - Invite, roles, remove members
4. 💰 **Payments work** - Subscribe, upgrade, cancel via Stripe
5. 🎨 **UI is polished** - Dark mode, responsive, accessible
6. 📧 **Emails send** - All transactional emails work
7. 🔒 **Security is solid** - Rate limiting, validation, audit logs
8. 📊 **Monitoring works** - Errors tracked, analytics running
9. 🚀 **Deploys cleanly** - CI/CD, preview deployments work
10. 📖 **Documented** - README, API docs, component docs

---

## 📚 References & Resources

### Backend (NestJS)
- [NestJS Documentation](https://docs.nestjs.com)
- [NestJS Recipes](https://docs.nestjs.com/recipes)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Passport.js](https://www.passportjs.org)
- [BullMQ](https://docs.bullmq.io)

### Frontend (Next.js)
- [Next.js 15 Documentation](https://nextjs.org/docs)
- [React 19 Documentation](https://react.dev)
- [TanStack Query](https://tanstack.com/query)
- [Zustand](https://zustand-demo.pmnd.rs)

### UI/Styling
- [shadcn/ui](https://ui.shadcn.com)
- [Tailwind CSS](https://tailwindcss.com)
- [Framer Motion](https://www.framer.com/motion)
- [Lucide Icons](https://lucide.dev)

### Payments & Email
- [Stripe Documentation](https://stripe.com/docs)
- [React Email](https://react.email)
- [Resend](https://resend.com)

### DevOps & Tooling
- [Turborepo](https://turbo.build/repo)
- [pnpm](https://pnpm.io)
- [Vercel](https://vercel.com)
- [Railway](https://railway.app)
- [Docker](https://docs.docker.com)

---

> **Note:** This is a living document. Features can be added, modified, or removed based on specific project requirements.
