import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { EmailQueueService } from "@/modules/queue";
import { PrismaService } from "@/prisma/prisma.service";
import {
    DOMAIN_EVENTS,
    type RoleChangedEvent,
    type UserCreatedEvent,
} from "@saas/shared-types";

/**
 * Turns domain events into emails.
 *
 * The listener ENQUEUES rather than sending: delivery is the worker's job, with
 * retries and backoff. That also keeps this off the request path, so a slow or
 * unreachable mail transport cannot slow down registration.
 *
 * `USER_CREATED` from the "invitation" source is skipped on purpose — that user
 * already receives the invitation email, and a second welcome message would be
 * noise.
 */
@Injectable()
export class EmailListener {
    private readonly logger = new Logger(EmailListener.name);

    constructor(
        private readonly emailQueue: EmailQueueService,
        private readonly prisma: PrismaService,
    ) {}

    @OnEvent(DOMAIN_EVENTS.USER_CREATED, { async: true })
    async onUserCreated(event: UserCreatedEvent): Promise<void> {
        if (event.source === "invitation") return;

        try {
            await this.emailQueue.enqueueWelcomeEmail({
                to: event.email,
                name: event.name ?? event.email,
            });
        } catch (error) {
            this.logger.error(
                `Could not queue welcome email for ${event.email}: ${
                    error instanceof Error ? error.message : String(error)
                }`,
            );
        }
    }

    @OnEvent(DOMAIN_EVENTS.ROLE_CHANGED, { async: true })
    async onRoleChanged(event: RoleChangedEvent): Promise<void> {
        try {
            // The notification needs the member's address, which the event does
            // not carry (it is not the event's subject).
            const user = await this.prisma.user.findUnique({
                where: { id: event.targetUserId },
                select: { email: true },
            });

            if (!user) return;

            this.logger.log(
                `Role for ${user.email} changed ${event.previousRoleKey} -> ${event.newRoleKey} in tenant ${event.tenantId}`,
            );

            // No dedicated "role changed" email job exists yet; enqueueing the
            // welcome template would be wrong, so this stays a log line until a
            // template/admin-notification job is defined.
        } catch (error) {
            this.logger.error(
                `Could not process role-changed notification: ${
                    error instanceof Error ? error.message : String(error)
                }`,
            );
        }
    }
}
