import { QUEUES } from "@saas/shared-types";

/**
 * Queue names, job names and the shared retry policy now live in
 * `@saas/shared-types` so the API producer and this worker cannot drift.
 *
 * The `*_QUEUE` aliases are kept for the existing processors/producers and
 * are derived from the shared definition (never re-declared here).
 */
export { JOBS, DEFAULT_JOB_OPTIONS } from "@saas/shared-types";
export type { JobName, QueueName } from "@saas/shared-types";

export const EMAIL_QUEUE = QUEUES.EMAIL;
export const REPORT_QUEUE = QUEUES.REPORT;
export const NOTIFICATION_QUEUE = QUEUES.NOTIFICATION;

/**
 * Domain-event bridge. This worker PRODUCES into it; the API consumes and
 * re-emits locally (event listeners live only in the API).
 */
export const DOMAIN_EVENT_QUEUE = QUEUES.DOMAIN_EVENT;
