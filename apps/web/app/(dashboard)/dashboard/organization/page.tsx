import { Building2, Network, Shield, Users } from "lucide-react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { OrganizationForm } from "@/components/dashboard/organization-form";
import { getTenantContext } from "@/lib/server/tenant";
import { getDictionary } from "@/lib/i18n";

/**
 * Organization page.
 *
 * A Server Component: the organization (name, slug, plan, member count, the
 * caller's role) is rendered from server data. Only the settings form is a
 * Client Component, because it needs form state.
 */
export default async function OrganizationPage() {
    const [{ activeOrganization: org }, dict] = await Promise.all([
        getTenantContext("/dashboard/organization"),
        getDictionary(),
    ]);
    const t = dict.dashboard.organization;

    if (!org) {
        return (
            <div className="space-y-8">
                <h1 className="text-3xl font-bold tracking-tight">{t.title}</h1>
                <Card>
                    <CardHeader>
                        <CardTitle>{t.emptyTitle}</CardTitle>
                        <CardDescription>{t.emptyDescription}</CardDescription>
                    </CardHeader>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">{t.title}</h1>
                <p className="text-muted-foreground">{t.subtitle}</p>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>{t.generalSettings}</CardTitle>
                            <CardDescription>
                                {t.generalSettingsDescription}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <OrganizationForm organization={org} dict={dict} />
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">
                                {t.details}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">
                                    {t.plan}
                                </span>
                                <Badge variant="secondary" className="capitalize">
                                    {org.plan}
                                </Badge>
                            </div>
                            <Separator />
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">
                                    {t.members}
                                </span>
                                <span className="font-medium">
                                    {org.memberCount}
                                </span>
                            </div>
                            <Separator />
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">
                                    {t.yourRole}
                                </span>
                                <Badge variant="outline" className="capitalize">
                                    <Shield className="mr-1 h-3 w-3" />
                                    {org.role}
                                </Badge>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">{t.quickLinks}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <Button
                                variant="ghost"
                                className="w-full justify-start"
                                asChild
                            >
                                <a href="/dashboard/team">
                                    <Users className="mr-2 h-4 w-4" />
                                    {t.manageTeam}
                                </a>
                            </Button>
                            <Button
                                variant="ghost"
                                className="w-full justify-start"
                                asChild
                            >
                                <a href="/dashboard/billing">
                                    <Building2 className="mr-2 h-4 w-4" />
                                    {t.billing}
                                </a>
                            </Button>
                            <Button
                                variant="ghost"
                                className="w-full justify-start"
                                asChild
                            >
                                <a href="/dashboard/settings">
                                    <Network className="mr-2 h-4 w-4" />
                                    {t.accountSettings}
                                </a>
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
