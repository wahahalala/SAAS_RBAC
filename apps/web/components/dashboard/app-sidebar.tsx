"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import {
    Home,
    Settings,
    Users,
    Building2,
    CreditCard,
    LayoutDashboard,
    ChevronUp,
    Loader2,
} from "lucide-react";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { logoutAction } from "@/app/actions/auth";
import type {
    OrganizationMembershipResponse,
    UserResponse,
} from "@saas/shared-types";

const mainNavItems = [
    { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { title: "Team", href: "/dashboard/team", icon: Users },
    { title: "Settings", href: "/dashboard/settings", icon: Settings },
];

const orgNavItems = [
    { title: "Organization", href: "/dashboard/organization", icon: Building2 },
    { title: "Billing", href: "/dashboard/billing", icon: CreditCard },
];

/**
 * Sidebar.
 *
 * Still a Client Component, but only for INTERACTION: the active link comes from
 * `usePathname` and the footer holds a menu. The data it renders (user, tenants,
 * active organization) is passed in from the Server Component layout — this
 * component no longer fetches anything, which is what removes the loading state
 * and the extra round trips the old `useAuth`/`useCurrentOrganization` caused.
 */
export function AppSidebar({
    user,
    activeOrganization,
}: {
    user: UserResponse | null;
    organizations: OrganizationMembershipResponse[];
    activeOrganization: OrganizationMembershipResponse | null;
}) {
    const pathname = usePathname();
    const [isPending, startTransition] = useTransition();

    const getInitials = (name: string | null) => {
        if (!name) return "U";
        return name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
    };

    return (
        <Sidebar variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href="/dashboard">
                                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                                    <Home className="size-4" />
                                </div>
                                <div className="grid flex-1 text-left text-sm leading-tight">
                                    <span className="truncate font-semibold">SaaS Template</span>
                                    <span className="truncate text-xs text-muted-foreground">
                                        {activeOrganization?.name || "Personal"}
                                    </span>
                                </div>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>Navigation</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {mainNavItems.map((item) => (
                                <SidebarMenuItem key={item.href}>
                                    <SidebarMenuButton
                                        asChild
                                        isActive={pathname === item.href}
                                    >
                                        <Link href={item.href}>
                                            <item.icon className="size-4" />
                                            <span>{item.title}</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>

                <SidebarGroup>
                    <SidebarGroupLabel>Organization</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {orgNavItems.map((item) => (
                                <SidebarMenuItem key={item.href}>
                                    <SidebarMenuButton
                                        asChild
                                        isActive={pathname === item.href}
                                    >
                                        <Link href={item.href}>
                                            <item.icon className="size-4" />
                                            <span>{item.title}</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>

            <SidebarFooter>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <SidebarMenuButton
                                    size="lg"
                                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                                >
                                    <Avatar className="h-8 w-8 rounded-lg">
                                        <AvatarImage
                                            src={user?.image || undefined}
                                            alt={user?.name || ""}
                                        />
                                        <AvatarFallback className="rounded-lg">
                                            {getInitials(user?.name || null)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="grid flex-1 text-left text-sm leading-tight">
                                        <span className="truncate font-semibold">
                                            {user?.name || "User"}
                                        </span>
                                        <span className="truncate text-xs text-muted-foreground">
                                            {user?.email}
                                        </span>
                                    </div>
                                    <ChevronUp className="ml-auto size-4" />
                                </SidebarMenuButton>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                                side="top"
                                align="end"
                                sideOffset={4}
                            >
                                <DropdownMenuItem asChild>
                                    <Link href="/dashboard/settings">
                                        <Settings className="mr-2 size-4" />
                                        Settings
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    disabled={isPending}
                                    // A Server Action, not a client mutation: the
                                    // cookie clearing and redirect happen on the
                                    // server, so no token handling on the client.
                                    onClick={() =>
                                        startTransition(() => {
                                            void logoutAction();
                                        })
                                    }
                                    className="text-destructive focus:text-destructive"
                                >
                                    {isPending ? (
                                        <Loader2 className="mr-2 size-4 animate-spin" />
                                    ) : null}
                                    Log out
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
        </Sidebar>
    );
}
