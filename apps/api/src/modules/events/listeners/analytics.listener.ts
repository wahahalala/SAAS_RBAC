import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { PrismaService } from "@/prisma/prisma.service";
import {
    DOMAIN_EVENTS,
    type ReportCompletedEvent,
    type RoleChangedEvent,
    type TenantCreatedEvent,
    type UserCreatedEvent,
} from "@saas/shared-types";

/**
 * Records domain events as metered usage.
 *
 * Analytics here means "countable facts per tenant", written to `UsageRecord`.
 * That choice is deliberate: the table already exists, is tenant-scoped, and is
 * the data source behind the usage report — so these events become visible in an
 * existing product surface instead of a log nobody reads, and they can later be
 * forwarded to a real analytics service without touching the emitters.
 *
 * Metrics are namespaced `event.<name>` so they cannot collide with the
 * application metrics (`api.calls`, `storage.bytes`) already written elsewhere.
 */
@Injectable()
export class AnalyticsListener {
    private readonly logger = new Logger(AnalyticsListener.name);

    constructor(private readonly prisma: PrismaService) {}

    @OnEvent(DOMAIN_EVENTS.USER_CREATED, { async: true })
    async onUserCreated(event: UserCreatedEvent): Promise<void> {
        await this.count(event.tenantId, "event.user.created");
    }

    @OnEvent(DOMAIN_EVENTS.TENANT_CREATED, { async: true })
    async onTenantCreated(event: TenantCreatedEvent): Promise<void> {
        await this.count(event.tenantId, "event.tenant.created");
    }

    @OnEvent(DOMAIN_EVENTS.ROLE_CHANGED, { async: true })
    async onRoleChanged(event: RoleChangedEvent): Promise<void> {
        await this.count(event.tenantId, "event.role.changed");
    }

    @OnEvent(DOMAIN_EVENTS.REPORT_COMPLETED, { async: true })
    async onReportCompleted(event: ReportCompletedEvent): Promise<void> {
        // Success and failure are counted separately: a spike in `report.failed`
        // is the signal worth alerting on.
        await this.count(
            event.tenantId,
            event.status === "completed"
                ? "event.report.completed"
                : "event.report.failed",
        );
    }

    private async count(
        tenantId: string | null,
        metric: string,
    ): Promise<void> {
        // UsageRecord.tenantId is non-null: a tenant-less fact cannot be metered
        // per tenant, and inventing a tenant would corrupt the usage report.
        if (!tenantId) return;

        try {
            // Usage is attributable only while the tenant exists; a deleted
            // tenant must not throw.
            const tenant = await this.prisma.tenant.findUnique({
                where: { id: tenantId },
                select: { id: true },
            });

            if (!tenant) return;

            await this.prisma.usageRecord.create({
                data: { tenantId, metric, quantity: 1 },
            });
        } catch (error) {
            this.logger.error(
                `Failed to record usage "${metric}": ${
                    error instanceof Error ? error.message : String(error)
                }`,
            );
        }
    }
}
