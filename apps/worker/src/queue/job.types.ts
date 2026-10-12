/**
 * Job payloads shared between enqueue sites (producers) and processors.
 */

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
    inviteToken: string;
}

export interface GenerateReportJob {
    type: "generate-report";
    tenantId: string;
    reportType: "usage" | "members" | "billing";
    requestedBy: string;
}

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
