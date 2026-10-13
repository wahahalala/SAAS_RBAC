# apps/web Dockerfile
#
# Multi-stage production image for the Next.js frontend.
#
# `next.config.ts` sets `output: "standalone"`, so `next build` emits a
# self-contained `server.js` plus ONLY the traced runtime files into
# `.next/standalone`. The runner stage therefore needs no full `node_modules` —
# it copies the standalone tree, the static assets and the public resources, and
# runs `node server.js` directly (no `next` CLI dependency).

FROM node:20-alpine AS base
RUN corepack enable

# ---------------------------------------------------------------- dependencies
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/ ./packages/
# Only install the web app's dependency graph.
RUN pnpm install --filter web --frozen-lockfile

# ------------------------------------------------------------------------ build
# Next needs the source tree and the standalone tracer needs the runtime files.
FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY . .

# Build-time variables (public, safe to embed in client bundles):
#   1. NEXT_PUBLIC_API_URL — browser-facing API path (kept empty: the app talks
#      to its own origin through the /api/v1 rewrite, so no cross-origin URL).
#   2. API_ORIGIN — where the Next.js SERVER calls the NestJS API. In Compose
#      this is the internal service name `api`, resolved on the default network.
ENV NEXT_TELEMETRY_DISABLED=1 NEXT_PUBLIC_API_URL= API_ORIGIN=http://api:3001

RUN pnpm --filter web build

# ----------------------------------------------------------------------- runner
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000 HOSTNAME=0.0.0.0

RUN addgroup -S app && adduser -S app -G app

# The standalone build carries its own minimal node_modules; static assets and
# public files live next to `server.js` (Next serves both from the CWD).
COPY --from=build --chown=app:app /app/apps/web/.next/standalone ./
COPY --from=build --chown=app:app /app/apps/web/.next/static ./.next/static
COPY --from=build --chown=app:app /app/apps/web/public ./public

USER app
EXPOSE 3000

CMD ["node", "server.js"]
