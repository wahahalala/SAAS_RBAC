import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { PrismaService } from "@/prisma/prisma.service";
import {
    AUDIT_ACTIONS,
    DOMAIN_EVENTS,
    type DataExportedEvent,
    type ReportCompletedEvent,
    type RoleChangedEvent,
    type SessionEvent,
    type TenantCreatedEvent,
    type UserCreatedEvent,
    type UserDeletedEvent,
} from "@saas/shared-types";

/**
 * Writes an audit trail row for every domain event.
 *
 * `AuditLog` existed in the schema with no writer anywhere; this listener is
 * what finally populates it.
 *
 * Two properties matter here:
 *
 *  - **The tenant comes from the payload**, not from `TenantContext`. Listeners
 *    run asynchronously, after the request's AsyncLocalStorage context has been
 *    torn down (and provisioning has no tenant context at all), so reading it
 *    ambiently would mis-attribute rows.
 *  - **Users are validated before being referenced.** `AuditLog.userId` is a
 *    foreign key with `onDelete: SetNull`; an OAuth/system actor id that does not
 *    resolve to a row would make the insert fail and lose the audit entry
 *    entirely, so an unknown actor is recorded as null rather than rejected.
 */
@Injectable()
export class AuditListener {
    private readonly logger = new Logger(AuditListener.name);

    constructor(private readonly prisma: PrismaService) {}

    @OnEvent(DOMAIN_EVENTS.USER_CREATED, { async: true })
    async onUserCreated(event: UserCreatedEvent): Promise<void> {
        await this.record({
            tenantId: event.tenantId,
            userId: event.userId,
            action: AUDIT_ACTIONS.CREATE_USER,
            request: event.request,
            entity: "User",
            entityId: event.userId,
            metadata: { email: event.email, source: event.source },
        });
    }

    @OnEvent(DOMAIN_EVENTS.TENANT_CREATED, { async: true })
    async onTenantCreated(event: TenantCreatedEvent): Promise<void> {
        // The tenant itself is the subject; attribute the action to its owner.
        // A tenant-created event always carries the tenant it just created.
        await this.record({
            tenantId: event.tenantId,
            userId: event.actorId ?? event.ownerId,
            action: AUDIT_ACTIONS.CREATE_TENANT,
            request: event.request,
            entity: "Tenant",
            entityId: event.tenantId,
            metadata: { name: event.tenantName, slug: event.tenantSlug },
        });
    }

    @OnEvent(DOMAIN_EVENTS.ROLE_CHANGED, { async: true })
    async onRoleChanged(event: RoleChangedEvent): Promise<void> {
        await this.record({
            tenantId: event.tenantId,
            userId: event.actorId,
            action: AUDIT_ACTIONS.CHANGE_ROLE,
            request: event.request,
            entity: "Membership",
            entityId: event.membershipId,
            metadata: {
                targetUserId: event.targetUserId,
                previousRoleKey: event.previousRoleKey,
                newRoleKey: event.newRoleKey,
            },
        });
    }

    @OnEvent(DOMAIN_EVENTS.REPORT_COMPLETED, { async: true })
    async onReportCompleted(event: ReportCompletedEvent): Promise<void> {
        await this.record({
            tenantId: event.tenantId,
            userId: event.requestedById,
            action: AUDIT_ACTIONS.REPORT_COMPLETED,
            request: event.request,
            entity: "Report",
            entityId: event.reportId,
            metadata: {
                type: event.reportType,
                format: event.format,
                rowCount: event.rowCount,
                fileSize: event.fileSize,
                error: event.error ?? null,
            },
        });
    }

    @OnEvent(DOMAIN_EVENTS.USER_DELETED, { async: true })
    async onUserDeleted(event: UserDeletedEvent): Promise<void> {
        // Identity is taken from the event, not looked up: the row is gone, and
        // the FK will null it out on the audit row's `userId`.
        await this.record({
            tenantId: event.tenantId,
            userId: event.actorId,
            action: AUDIT_ACTIONS.DELETE_USER,
            request: event.request,
            entity: "User",
            entityId: event.userId,
            metadata: { email: event.email, name: event.name },
        });
    }

    @OnEvent(DOMAIN_EVENTS.USER_LOGGED_IN, { async: true })
    async onLoggedIn(event: SessionEvent): Promise<void> {
        await this.record({
            tenantId: event.tenantId,
            userId: event.userId,
            action: AUDIT_ACTIONS.LOGIN,
            request: event.request,
            entity: "User",
            entityId: event.userId,
            metadata: {
                email: event.email,
                method: event.method ?? null,
                device: event.device ?? null,
            },
        });
    }

    @OnEvent(DOMAIN_EVENTS.USER_LOGGED_OUT, { async: true })
    async onLoggedOut(event: SessionEvent): Promise<void> {
        await this.record({
            tenantId: event.tenantId,
            userId: event.userId,
            action: AUDIT_ACTIONS.LOGOUT,
            request: event.request,
            entity: "User",
            entityId: event.userId,
            metadata: {
                email: event.email,
                allDevices: event.allDevices ?? false,
            },
        });
    }

    @OnEvent(DOMAIN_EVENTS.DATA_EXPORTED, { async: true })
    async onDataExported(event: DataExportedEvent): Promise<void> {
        // Export auditing is the point of this action: data left the system.
        await this.record({
            tenantId: event.tenantId,
            userId: event.userId,
            action: AUDIT_ACTIONS.EXPORT_DATA,
            request: event.request,
            entity: "Report",
            entityId: event.reportId,
            metadata: {
                type: event.reportType,
                format: event.format,
                fileName: event.fileName,
            },
        });
    }

    private async record(entry: {
        tenantId: string | null;
        userId?: string | null;
        action: string;
        entity: string;
        entityId: string;
        metadata: Record<string, unknown>;
        /** Request metadata carried by the event (absent for worker facts). */
        request?: { ipAddress?: string; userAgent?: string };
    }): Promise<void> {
        try {
            // `tenantId` is nullable: a fact with no tenant (a fresh
            // registration, before the user belongs to any tenant) is recorded
            // with tenantId null rather than dropped — a missing audit row for
            // account creation is worse than one without a tenant.
            const tenantId = await this.resolveTenantId(entry.tenantId);

            const userId = await this.resolveUserId(entry.userId);

            await this.prisma.auditLog.create({
                data: {
                    tenantId,
                    userId,
                    action: entry.action,
                    entity: entry.entity,
                    entityId: entry.entityId,
                    metadata: entry.metadata as object,
                    ipAddress: entry.request?.ipAddress ?? null,
                    userAgent: entry.request?.userAgent ?? null,
                },
            });
        } catch (error) {
            // Audit must never break the business flow that triggered it.
            this.logger.error(
                `Failed to write audit "${entry.action}": ${
                    error instanceof Error ? error.message : String(error)
                }`,
            );
        }
    }

    /**
     * Resolve the tenant for the audit row.
     *
     * An event with no tenant stays null. An event naming a tenant that no
     * longer exists also becomes null: the FK would reject the id, and dropping
     * the row over it would lose the audit entry entirely.
     */
    private async resolveTenantId(
        tenantId: string | null,
    ): Promise<string | null> {
        if (!tenantId) return null;

        const tenant = await this.prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { id: true },
        });

        return tenant?.id ?? null;
    }

    /** Null out an actor that has no user row, so the insert cannot fail on the FK. */
    private async resolveUserId(
        userId: string | null | undefined,
    ): Promise<string | null> {
        if (!userId) return null;

        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true },
        });

        return user?.id ?? null;
    }
}
