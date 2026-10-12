import { Injectable } from "@nestjs/common";
import { PrismaService } from "@/prisma";
import type { ReportTypeName } from "@saas/shared-types";

/**
 * A report is a flat table: a header row plus data rows. Keeping this shape
 * (rather than handing Prisma models to the writers) is what lets the CSV and
 * PDF writers stay format-only and share one definition of each report.
 */
export interface ReportTable {
    title: string;
    columns: string[];
    rows: Array<Array<string | number | null>>;
}

/**
 * Builds the tabular data for each report type.
 *
 * Every query is scoped to `tenantId`, which comes from the job payload (the API
 * set it from an authorised request). The worker has no request context, so
 * these filters are the isolation boundary — do not remove them.
 */
@Injectable()
export class ReportDataService {
    constructor(private readonly prisma: PrismaService) {}

    async build(
        type: ReportTypeName,
        tenantId: string,
    ): Promise<ReportTable> {
        switch (type) {
            case "usage":
                return this.buildUsage(tenantId);
            case "members":
                return this.buildMembers(tenantId);
            case "billing":
                return this.buildBilling(tenantId);
            default:
                // Exhaustiveness: a new ReportType must be handled here.
                throw new Error(`Unsupported report type: ${String(type)}`);
        }
    }

    /** Metered usage, aggregated per metric. */
    private async buildUsage(tenantId: string): Promise<ReportTable> {
        const grouped = await this.prisma.usageRecord.groupBy({
            by: ["metric"],
            where: { tenantId },
            _sum: { quantity: true },
            _count: { _all: true },
            orderBy: { metric: "asc" },
        });

        return {
            title: "Usage Report",
            columns: ["Metric", "Total Quantity", "Records"],
            rows: grouped.map((row) => [
                row.metric,
                row._sum.quantity ?? 0,
                row._count._all,
            ]),
        };
    }

    /** Team roster: who is in the tenant and with which role. */
    private async buildMembers(tenantId: string): Promise<ReportTable> {
        const memberships = await this.prisma.membership.findMany({
            where: { tenantId },
            include: {
                user: { select: { email: true, name: true, createdAt: true } },
                role: { select: { key: true } },
            },
            orderBy: { createdAt: "asc" },
        });

        return {
            title: "Members Report",
            columns: ["Name", "Email", "Role", "Joined At"],
            rows: memberships.map((membership) => [
                membership.user.name ?? "",
                membership.user.email,
                membership.role.key,
                this.formatDate(membership.createdAt),
            ]),
        };
    }

    /** Billing snapshot from the tenant's subscription. */
    private async buildBilling(tenantId: string): Promise<ReportTable> {
        const subscriptions = await this.prisma.subscription.findMany({
            where: { tenantId },
            orderBy: { createdAt: "desc" },
        });

        return {
            title: "Billing Report",
            columns: [
                "Plan",
                "Status",
                "Cancel At Period End",
                "Current Period Start",
                "Current Period End",
                "Created At",
            ],
            rows: subscriptions.map((subscription) => [
                subscription.plan,
                subscription.status,
                subscription.cancelAtPeriodEnd ? "yes" : "no",
                this.formatDate(subscription.currentPeriodStart),
                this.formatDate(subscription.currentPeriodEnd),
                this.formatDate(subscription.createdAt),
            ]),
        };
    }

    private formatDate(value: Date | null): string {
        return value ? value.toISOString().slice(0, 10) : "";
    }
}
