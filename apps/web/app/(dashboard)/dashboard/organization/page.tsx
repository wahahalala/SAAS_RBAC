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

/**
 * Organization page.
 *
 * A Server Component: the organization (name, slug, plan, member count, the
 * caller's role) is rendered from server data. Only the settings form is a
 * Client Component, because it needs form state.
 */
export default async function OrganizationPage() {
    const { activeOrganization: org } = await getTenantContext(
        "/dashboard/organization",
    );

    if (!org) {
        return (
            <div className="space-y-8">
                <h1 className="text-3xl font-bold tracking-tight">Organization</h1>
                <Card>
                    <CardHeader>
                        <CardTitle>No organization yet</CardTitle>
                        <CardDescription>
                            Create an organization to manage its settings.
                        </CardDescription>
                    </CardHeader>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Organization</h1>
                <p className="text-muted-foreground">
                    Manage your organization settings and details
                </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>General Settings</CardTitle>
                            <CardDescription>
                                Update your organization&apos;s profile information
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <OrganizationForm organization={org} />
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">
                                Organization Details
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">
                                    Plan
                                </span>
                                <Badge variant="secondary" className="capitalize">
                                    {org.plan}
                                </Badge>
                            </div>
                            <Separator />
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">
                                    Members
                                </span>
                                <span className="font-medium">
                                    {org.memberCount}
                                </span>
                            </div>
                            <Separator />
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">
                                    Your Role
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
                            <CardTitle className="text-base">Quick Links</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <Button
                                variant="ghost"
                                className="w-full justify-start"
                                asChild
                            >
                                <a href="/dashboard/team">
                                    <Users className="mr-2 h-4 w-4" />
                                    Manage team
                                </a>
                            </Button>
                            <Button
                                variant="ghost"
                                className="w-full justify-start"
                                asChild
                            >
                                <a href="/dashboard/billing">
                                    <Building2 className="mr-2 h-4 w-4" />
                                    Billing
                                </a>
                            </Button>
                            <Button
                                variant="ghost"
                                className="w-full justify-start"
                                asChild
                            >
                                <a href="/dashboard/settings">
                                    <Network className="mr-2 h-4 w-4" />
                                    Account settings
                                </a>
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
