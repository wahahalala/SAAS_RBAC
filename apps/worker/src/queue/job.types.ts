/**
 * Job payloads shared between enqueue sites (producers) and processors.
 *
 * The canonical definitions live in `@saas/shared-types` (also used by the API
 * producer). Re-exported here so worker code keeps a stable local import path
 * without duplicating the shapes.
 */
export type {
    WelcomeEmailJob,
    InviteEmailJob,
    GenerateReportJob,
    SendNotificationJob,
    AnyJobData,
} from "@saas/shared-types";
