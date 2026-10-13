import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Building2, Activity } from "lucide-react";
import { getTenantContext } from "@/lib/server/tenant";
import { getDictionary, interpolate } from "@/lib/i18n";
import { SwitchTenantButton } from "@/components/dashboard/switch-tenant-button";

/**
 * Dashboard overview.
 *
 * A Server Component: the user and their organizations are fetched on the
 * server, so the first paint already contains the numbers. Previously this was a
 * client component that rendered three skeleton cards and then filled them in
 * after a browser fetch.
 *
 * The only interactive part — switching the active organization — is a small
 * Client Component, so the page itself stays server-rendered.
 */
export default async function DashboardPage() {
    const [{ user, organizations, activeOrganization }, dict] = await Promise.all([
        getTenantContext("/dashboard"),
        getDictionary(),
    ]);
    const t = dict.dashboard.overview;

    const stats = [
        {
            title: t.organizations,
            value: organizations.length,
            description: t.organizationsDescription,
            icon: Building2,
        },
        {
            title: t.teamMembers,
            value: organizations.reduce((acc, org) => acc + org.memberCount, 0),
            description: t.teamMembersDescription,
            icon: Users,
        },
        {
            title: t.yourPlan,
            value: activeOrganization?.plan || "Free",
            description: t.yourPlanDescription,
            icon: Activity,
        },
    ];

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">
                    {interpolate(t.title, {
                        name: user.name?.split(" ")[0] || "there",
                    })}
                </h1>
                <p className="text-muted-foreground">{t.subtitle}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                {stats.map((stat) => (
                    <Card key={stat.title}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                {stat.title}
                            </CardTitle>
                            <stat.icon className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold capitalize">
                                {stat.value}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {stat.description}
                            </p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div>
                <h2 className="text-xl font-semibold mb-4">{t.yourOrganizations}</h2>

                {organizations.length > 0 ? (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {organizations.map((org) => {
                            const isActive =
                                org.tenantId === activeOrganization?.tenantId;

                            return (
                                <Card
                                    key={org.id}
                                    className={`transition-colors ${
                                        isActive
                                            ? "border-primary"
                                            : "hover:border-primary/50"
                                    }`}
                                >
                                    <CardHeader>
                                        <div className="flex items-center justify-between">
                                            <CardTitle className="text-lg">
                                                {org.name}
                                            </CardTitle>
                                            <Badge
                                                variant={
                                                    org.plan === "free"
                                                        ? "secondary"
                                                        : "default"
                                                }
                                            >
                                                {org.plan}
                                            </Badge>
                                        </div>
                                        <CardDescription className="flex items-center gap-4">
                                            <span className="flex items-center gap-1">
                                                <Users className="h-3 w-3" />
                                                {interpolate(
                                                    org.memberCount === 1
                                                        ? t.memberCount
                                                        : t.memberCountPlural,
                                                    { count: org.memberCount },
                                                )}
                                            </span>
                                            <span className="capitalize text-xs">
                                                {org.role}
                                            </span>
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <SwitchTenantButton
                                            tenantId={org.tenantId}
                                            isActive={isActive}
                                            dict={dict.dashboard.overview}
                                        />
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                ) : (
                    <Card>
                        <CardHeader>
                            <CardTitle>{t.emptyTitle}</CardTitle>
                            <CardDescription>{t.emptyDescription}</CardDescription>
                        </CardHeader>
                    </Card>
                )}
            </div>
        </div>
    );
}
