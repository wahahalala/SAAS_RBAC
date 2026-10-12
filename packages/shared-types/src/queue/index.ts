/**
 * BullMQ queue + job contracts.
 *
 * Single source of truth shared by the API (producer) and the worker
 * (consumer): queue names, job names, retry policy and job payloads.
 * Duplicating any of these across the two apps silently breaks delivery —
 * a renamed job would simply never be handled — so they live here.
 */

/**
 * Queue names registered by the API producer and consumed by the worker.
 */
export const QUEUES = {
    EMAIL: "emailQueue",
    REPORT: "reportQueue",
    NOTIFICATION: "notificationQueue",
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

/**
 * Job names. The producer passes these to `queue.add(name, data)` and the
 * worker switches on them in `WorkerHost.process()`.
 */
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
 * - completed/failed jobs are retained so they stay inspectable
 *   (see the worker's JobStatusService).
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

export interface WelcomeEmailJob {
    type: "welcome-email";
    to: string;
    name: string;
}

export interface InviteEmailJob {
    type: "invite-email";
    to: string;
    inviterName: string;
    organizationName: string;
    /** Opaque invitation token; the accept route is `POST /invitations/:token/accept`. */
    inviteToken: string;
    /** Absolute invite link, built by the API from FRONTEND_URL. */
    inviteUrl: string;
}

/**
 * A report generation job.
 *
 * Carries `reportId` (the `Report` row the API already created) so the worker
 * can advance that row's status, and `format` so it knows which artifact to
 * build. `requestedBy` is kept for logging/audit.
 */
export interface GenerateReportJob {
    type: "generate-report";
    reportId: string;
    tenantId: string;
    reportType: ReportTypeName;
    format: ReportFormatName;
    requestedBy: string;
}

export type ReportTypeName = "usage" | "members" | "billing";
export type ReportFormatName = "csv" | "pdf";
export type ReportStateName = "pending" | "processing" | "completed" | "failed";

export interface SendNotificationJob {
    type: "send-notification";
    userId: string;
    title: string;
    message?: string;
    channel: "in-app" | "email" | "push";
}

export type AnyJobData =
    | WelcomeEmailJob
    | InviteEmailJob
    | GenerateReportJob
    | SendNotificationJob;
