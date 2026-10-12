# apps/worker

NestJS background job worker backed by BullMQ (Redis).

## Queues & jobs

| Queue | Jobs |
|-------|------|
| `emailQueue` | `welcome-email`, `invite-email` |
| `reportQueue` | `generate-report` |
| `notificationQueue` | `send-notification` |

All queues share a retry/backoff policy: `attempts: 5`, exponential backoff
(1s → 2s → 4s → 8s). Failed jobs are kept (not removed) so they can be
inspected via `JobStatusService.getFailed()`.

## Architecture

- `src/queue/` — `QueueModule` (producers) + job types + queue constants
- `src/worker/` — `WorkerModule` (processors) + `JobStatusService` (status query)
- `src/processors/` — email/report/notification processors, each with
  `@OnWorkerEvent("completed"/"failed")` logging

## Run locally

```bash
# from the repo root
pnpm --filter worker dev
# or
cd apps/worker && pnpm dev
```

Requires Redis (root `docker-compose.yml`):

```bash
docker compose up -d redis
```

## Run in Docker

```bash
docker compose up -d --build worker
```

## Environment

Copy `.env.example` to `apps/worker/.env`; override `REDIS_HOST`/`REDIS_PORT`
as needed.
