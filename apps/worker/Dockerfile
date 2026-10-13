# apps/worker Dockerfile
# Builds the BullMQ worker as a standalone production image.
FROM node:20-alpine AS base
RUN corepack enable

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/worker/package.json apps/worker/package.json
COPY packages/ ./packages/
# Only install the worker's dependency graph (workspace root + worker).
RUN pnpm install --filter worker --frozen-lockfile

FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/worker/node_modules ./apps/worker/node_modules
COPY . .
RUN pnpm --filter worker build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

# Non-root user: the worker needs write access ONLY to REPORTS_DIR, which the
# Compose file mounts as a shared volume. Create that directory owned by the
# unprivileged user so a fresh Docker-managed volume (root-owned) doesn't make
# report writes fail.
RUN addgroup -S app && adduser -S app -G app \
    && mkdir -p /app/storage/reports && chown -R app:app /app/storage

COPY --from=build /app/apps/worker/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/worker/package.json ./package.json

USER app

CMD ["node", "dist/main.js"]
