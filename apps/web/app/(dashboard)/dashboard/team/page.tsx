import { Users, Crown, Shield } from "lucide-react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { InviteMemberDialog } from "@/components/dashboard/invite-member-dialog";
import { MemberRow } from "@/components/dashboard/member-row";
import { getTenantContextOrError } from "@/lib/server/tenant";
import { getDictionary, interpolate } from "@/lib/i18n";
import { serverFetch } from "@/lib/server/api";
import type { MemberResponse } from "@saas/shared-types";

/**
 * Team page.
 *
 * A Server Component: the member list is fetched during the render, so the table
 * arrives with the HTML. The two interactive pieces (the invite dialog and the
 * per-row action menu) are Client Components that call Server Actions.
 */
export default async function TeamPage() {
    const [context, dict] = await Promise.all([
        getTenantContextOrError("/dashboard/team"),
        getDictionary(),
    ]);
    const t = dict.dashboard.team;

    if (!context.hasTenant) {
        return (
            <div className="space-y-8">
                <h1 className="text-3xl font-bold tracking-tight">{t.title}</h1>
                <Card>
                    <CardHeader>
                        <CardTitle>{t.noOrganizationTitle}</CardTitle>
                        <CardDescription>
                            {t.noOrganizationDescription}
                        </CardDescription>
                    </CardHeader>
                </Card>
            </div>
        );
    }

    const membersResult = await serverFetch<MemberResponse[]>(
        `/organizations/${context.activeOrganization.slug}/members`,
    );

    const members = membersResult.data ?? [];

    const stats = [
        {
            title: t.totalMembers,
            value: members.length,
            icon: Users,
            color: "text-blue-500",
        },
        {
            title: t.admins,
            value: members.filter((m) => m.role === "admin").length,
            icon: Crown,
            color: "text-amber-500",
        },
        {
            title: t.members,
            value: members.filter((m) => m.role === "member").length,
            icon: Shield,
            color: "text-emerald-500",
        },
    ];

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{t.title}</h1>
                    <p className="text-muted-foreground">{t.subtitle}</p>
                </div>
                <InviteMemberDialog dict={dict} />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                {stats.map((stat) => (
                    <Card key={stat.title}>
                        <CardContent className="flex items-center gap-4 p-6">
                            <div className={`rounded-full bg-muted p-3 ${stat.color}`}>
                                <stat.icon className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">
                                    {stat.title}
                                </p>
                                <p className="text-2xl font-bold">{stat.value}</p>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>{t.membersTitle}</CardTitle>
                    <CardDescription>{t.membersDescription}</CardDescription>
                </CardHeader>
                <CardContent>
                    {membersResult.error ? (
                        // A failed fetch renders inside the page rather than
                        // replacing the whole route with an error boundary.
                        <p className="py-8 text-center text-sm text-destructive">
                            {interpolate(t.loadError, {
                                error: membersResult.error,
                            })}
                        </p>
                    ) : members.length > 0 ? (
                        <div className="divide-y">
                            {members.map((member) => (
                                <MemberRow
                                    key={member.id}
                                    member={member}
                                    dict={dict}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                            <Users className="h-12 w-12 text-muted-foreground/50" />
                            <h3 className="mt-4 font-semibold">
                                {t.emptyTitle}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                                {t.emptyDescription}
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
