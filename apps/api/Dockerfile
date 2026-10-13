# apps/api Dockerfile
#
# Multi-stage production image for the NestJS API.
#
# Build strategy (same shape as the worker) installs ONLY the API's workspace
# dependency graph with pnpm, copies the source, compiles with Nest, then copies
# the runtime JS + production deps into a slim `node:20-alpine` runner.
#
# Prisma engines are generated in the `build` stage (they run the platform-
# specific binaries there), so the schema + generated client must be part of the
# build — which is why the full `apps/api/prisma` directory is copied to the
# runner and `prisma generate` runs at image build time.

FROM node:20-alpine AS base
RUN corepack enable

# ---------------------------------------------------------------- dependencies
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/ ./packages/
# Only install the API's dependency graph (workspace root + api + shared packages).
RUN pnpm install --filter api --frozen-lockfile

# ------------------------------------------------------------------------ build
FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY . .

# Prisma client for the target platform (musl x64 on alpine), then compile.
RUN pnpm --filter api prisma generate
RUN pnpm --filter api build

# ------------------------------------------------------------------------ prune
# Production-only node_modules: drop devDependencies so the runner carries only
# what it executes.
FROM base AS pruned
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/ ./packages/
RUN pnpm install --filter api --prod --frozen-lockfile

# ----------------------------------------------------------------------- runner
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

# Non-root user: the API only writes to REPORTS_DIR (mounted volume) and reads
# the schema; run unprivileged and pre-create the reports directory owned by the
# unprivileged user so a fresh Docker-managed volume doesn't break downloads.
RUN addgroup -S app && adduser -S app -G app \
    && mkdir -p /app/storage/reports && chown -R app:app /app/storage

COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/prisma ./prisma
COPY --from=build /app/apps/api/package.json ./package.json
COPY --from=pruned /app/node_modules ./node_modules
COPY --from=pruned /app/apps/api/node_modules ./apps/api/node_modules

USER app
EXPOSE 3001

CMD ["node", "dist/main.js"]
