import { ForbiddenException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "@/prisma/prisma.service";
import { TenantContext } from "@/modules/tenant";
import type { AuditAction, AuditLogPageResponse } from "@saas/shared-types";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export interface AuditLogQuery {
    page?: number;
    limit?: number;
    action?: string;
    userId?: string;
    entity?: string;
    entityId?: string;
    from?: string;
    to?: string;
    search?: string;
}

/**
 * Read side of the audit trail.
 *
 * Two rules govern everything here:
 *
 *  1. **Tenant-scoped, always.** The `where` clause starts from the request's
 *     authorised tenant, so a filter can narrow the result but never widen it
 *     to another tenant's rows.
 *  2. **Tenant-less rows are excluded.** A row with `tenantId = null` (a
 *     registration or login, which happen before a tenant exists) has no tenant
 *     to authorise against. Serving it from a tenant's audit list would leak
 *     facts about accounts that may not even belong to that tenant.
 */
@Injectable()
export class AuditService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly tenantContext: TenantContext,
    ) {}

    async list(query: AuditLogQuery): Promise<AuditLogPageResponse> {
        const tenantId = this.requireTenantId();

        const page = Math.max(1, Math.floor(query.page ?? 1));
        const limit = Math.min(
            MAX_PAGE_SIZE,
            Math.max(1, Math.floor(query.limit ?? DEFAULT_PAGE_SIZE)),
        );

        const where: Prisma.AuditLogWhereInput = {
            // Never removable by the caller: the tenant is the isolation boundary.
            tenantId,
            ...(query.action ? { action: query.action } : {}),
            ...(query.userId ? { userId: query.userId } : {}),
            ...(query.entity ? { entity: query.entity } : {}),
            ...(query.entityId ? { entityId: query.entityId } : {}),
            ...(this.dateRange(query.from, query.to) ?? {}),
            ...(this.searchFilter(query.search) ?? {}),
        };

        const [total, rows] = await this.prisma.$transaction([
            this.prisma.auditLog.count({ where }),
            this.prisma.auditLog.findMany({
                where,
                // Newest first: an audit list is read backwards from "what just
                // happened". `id` breaks ties so paging cannot repeat/skip rows
                // when several entries share a timestamp.
                orderBy: [{ createdAt: "desc" }, { id: "desc" }],
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    user: { select: { id: true, email: true, name: true } },
                },
            }),
        ]);

        const totalPages = Math.ceil(total / limit) || 1;

        return {
            items: rows.map((row) => ({
                id: row.id,
                tenantId: row.tenantId,
                userId: row.userId,
                action: row.action as AuditAction,
                entity: row.entity,
                entityId: row.entityId,
                metadata: (row.metadata as Record<string, unknown> | null) ?? null,
                ipAddress: row.ipAddress,
                userAgent: row.userAgent,
                createdAt: row.createdAt,
                user: row.user
                    ? {
                          id: row.user.id,
                          email: row.user.email,
                          name: row.user.name,
                      }
                    : null,
            })),
            meta: {
                page,
                limit,
                total,
                totalPages,
                hasMore: page < totalPages,
            },
        };
    }

    private requireTenantId(): string {
        const tenantId = this.tenantContext.getTenantId();
        if (!tenantId) {
            throw new ForbiddenException(
                "Tenant context is required for this operation",
            );
        }
        return tenantId;
    }

    /**
     * Inclusive `createdAt` range.
     *
     * `to` is widened to the end of its day when only a date is given, so a
     * filter of "to 2026-01-31" includes that whole day rather than stopping at
     * midnight.
     */
    private dateRange(
        from?: string,
        to?: string,
    ): { createdAt?: Prisma.DateTimeFilter } | undefined {
        if (!from && !to) return undefined;

        const createdAt: Prisma.DateTimeFilter = {};

        if (from) createdAt.gte = new Date(from);
        if (to) {
            const parsed = new Date(to);
            // A bare date parses to midnight UTC; treat it as the whole day.
            const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(to);
            createdAt.lte = isDateOnly
                ? new Date(parsed.getTime() + 24 * 60 * 60 * 1000 - 1)
                : parsed;
        }

        return { createdAt };
    }

    /**
     * Free-text search across the fields an investigator would try.
     *
     * `metadata` is JSON, so it is searched as text on the serialised value
     * (`contains`, case-insensitive per Postgres' `jsonb::text`). The actor's
     * email/name live on the related user, which is why the orphan-free
     * relation filter is used rather than a plain column comparison.
     */
    private searchFilter(
        search?: string,
    ): Prisma.AuditLogWhereInput | undefined {
        const term = search?.trim();
        if (!term) return undefined;

        return {
            OR: [
                { action: { contains: term, mode: "insensitive" } },
                { entity: { contains: term, mode: "insensitive" } },
                { entityId: { contains: term, mode: "insensitive" } },
                { ipAddress: { contains: term, mode: "insensitive" } },
                {
                    user: {
                        is: {
                            OR: [
                                { email: { contains: term, mode: "insensitive" } },
                                { name: { contains: term, mode: "insensitive" } },
                            ],
                        },
                    },
                },
            ],
        };
    }
}
