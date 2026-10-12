/**
 * Queue and job name constants shared across producers, processors and status
 * queries.
 */
export const EMAIL_QUEUE = "emailQueue";
export const REPORT_QUEUE = "reportQueue";
export const NOTIFICATION_QUEUE = "notificationQueue";

export const JOBS = {
    WELCOME_EMAIL: "welcome-email",
    INVITE_EMAIL: "invite-email",
    GENERATE_REPORT: "generate-report",
    SEND_NOTIFICATION: "send-notification",
} as const;

export type JobName = (typeof JOBS)[keyof typeof JOBS];

/**
 * Retry/backoff policy shared by all queues.
 *
 * - attempts: 5 total (1 initial + 4 retries)
 * - backoff: `exponential` 1s -> 2s -> 4s -> 8s, capped at 30s
 */
export const DEFAULT_JOB_OPTIONS = {
    attempts: 5,
    backoff: {
        type: "exponential" as const,
        delay: 1000,
    },
    removeOnComplete: false,
    removeOnFail: false,
};
