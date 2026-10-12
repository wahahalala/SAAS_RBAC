/**
 * Queue + job contracts for the API producer.
 *
 * Re-exported from `@saas/shared-types`, which is the single source of truth
 * shared with the worker (apps/worker). Never redeclare queue or job names
 * locally — a mismatch means jobs are enqueued but never processed.
 */
import { QUEUES } from "@saas/shared-types";

export {
    QUEUES,
    JOBS,
    DEFAULT_JOB_OPTIONS,
} from "@saas/shared-types";

export type {
    QueueName,
    JobName,
    WelcomeEmailJob,
    InviteEmailJob,
    GenerateReportJob,
    SendNotificationJob,
    AnyJobData,
} from "@saas/shared-types";

/** Queue names, derived from the shared definition (never re-typed). */
export const EMAIL_QUEUE = QUEUES.EMAIL;
export const REPORT_QUEUE = QUEUES.REPORT;
export const NOTIFICATION_QUEUE = QUEUES.NOTIFICATION;
