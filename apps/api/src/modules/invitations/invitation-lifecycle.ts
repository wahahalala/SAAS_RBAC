import { InvitationStatus } from "@saas/shared-types";

/**
 * Invitation lifecycle rules, kept as pure functions so they can be unit
 * tested without a database.
 *
 *   PENDING ──accept──> ACCEPTED
 *      │
 *      ├──expiresAt passed──> EXPIRED   (applied lazily on read/write)
 *      └──admin revokes─────> CANCELED
 *
 * Expiry is *lazy*: nothing schedules a job to flip rows, so every read path
 * must derive the status from `expiresAt` before deciding what a caller may
 * do. That keeps a stale `pending` row from being acceptable.
 */

export interface InvitationLifecycleInput {
    status: InvitationStatus | string;
    expiresAt: Date;
}

/** The status a row should be *presented* as right now. */
export function effectiveStatus(
    invitation: InvitationLifecycleInput,
    now: Date = new Date(),
): InvitationStatus {
    if (invitation.status !== "pending") {
        // accepted / canceled / expired are terminal for acceptance purposes.
        return invitation.status as InvitationStatus;
    }

    return invitation.expiresAt <= now ? "expired" : "pending";
}

export function isExpired(
    invitation: InvitationLifecycleInput,
    now: Date = new Date(),
): boolean {
    return effectiveStatus(invitation, now) === "expired";
}

/** Can this invitation still be accepted by someone? */
export function isAcceptable(
    invitation: InvitationLifecycleInput,
    now: Date = new Date(),
): boolean {
    return effectiveStatus(invitation, now) === "pending";
}
