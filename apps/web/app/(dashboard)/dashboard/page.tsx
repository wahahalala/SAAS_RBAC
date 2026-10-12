"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth, useActiveTenant } from "@/hooks";
import { Users, Building2, Activity, ArrowUpRight } from "lucide-react";

export default function DashboardPage() {
    const { user } = useAuth();
    const { organizations, activeOrganization, isLoading, setActiveTenant } =
        useActiveTenant();

    const stats = [
        {
            title: "Organizations",
            value: organizations.length,
            description: "Active organizations",
            icon: Building2,
        },
        {
            title: "Team Members",
            value: organizations.reduce((acc, org) => acc + org.memberCount, 0),
            description: "Across all organizations",
            icon: Users,
        },
        {
            title: "Your Plan",
            value: activeOrganization?.plan || "Free",
            description: "Active organization plan",
            icon: Activity,
        },
    ];

    return (
        <div className="space-y-8">
            {/* Welcome Header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight">
                    Welcome back, {user?.name?.split(" ")[0] || "there"}!
                </h1>
                <p className="text-muted-foreground">
                    Here&apos;s what&apos;s happening with your account today.
                </p>
            </div>

            {/* Stats Grid */}
            <div className="grid gap-4 md:grid-cols-3">
                {stats.map((stat) => (
                    <Card key={stat.title}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                            <stat.icon className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold capitalize">{stat.value}</div>
                            <p className="text-xs text-muted-foreground">{stat.description}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Organizations List */}
            <div>
                <h2 className="text-xl font-semibold mb-4">Your Organizations</h2>
                {isLoading ? (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {[1, 2, 3].map((i) => (
                            <Card key={i} className="animate-pulse">
                                <CardHeader>
                                    <div className="h-4 w-32 bg-muted rounded" />
                                    <div className="h-3 w-24 bg-muted rounded mt-2" />
                                </CardHeader>
                            </Card>
                        ))}
                    </div>
                ) : organizations.length > 0 ? (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {organizations.map((org) => (
                            <Card
                                key={org.id}
                                className={`transition-colors cursor-pointer ${
                                    org.tenantId === activeOrganization?.tenantId
                                        ? "border-primary"
                                        : "hover:border-primary/50"
                                }`}
                            >
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-lg">{org.name}</CardTitle>
                                        <Badge variant={org.plan === "free" ? "secondary" : "default"}>
                                            {org.plan}
                                        </Badge>
                                    </div>
                                    <CardDescription className="flex items-center gap-4">
                                        <span className="flex items-center gap-1">
                                            <Users className="h-3 w-3" />
                                            {org.memberCount} member{org.memberCount !== 1 ? "s" : ""}
                                        </span>
                                        <span className="capitalize text-xs">
                                            {org.role}
                                        </span>
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <button
                                        type="button"
                                        onClick={() => setActiveTenant(org.tenantId)}
                                        className="text-sm text-primary hover:underline flex items-center gap-1"
                                    >
                                        {org.tenantId === activeOrganization?.tenantId
                                            ? "Active tenant"
                                            : "Switch to this organization"}
                                        <ArrowUpRight className="h-3 w-3" />
                                    </button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <Card>
                        <CardHeader>
                            <CardTitle>No organizations yet</CardTitle>
                            <CardDescription>
                                Create your first organization to get started with team collaboration.
                            </CardDescription>
                        </CardHeader>
                    </Card>
                )}
            </div>
        </div>
    );
}
