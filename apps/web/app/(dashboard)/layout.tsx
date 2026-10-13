import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { AppSidebar, UserNav, CommandPalette } from "@/components/dashboard";
import { getTenantContext } from "@/lib/server/tenant";

/**
 * Dashboard shell.
 *
 * A Server Component: the session is resolved (and redirects if absent) before
 * anything is sent to the browser, so there is no "spinner, then redirect" flash
 * and no client-side auth effect. The data the chrome needs — user, tenants,
 * active tenant — is fetched once HERE and passed down, rather than re-fetched by
 * each of the sidebar, switcher and user menu as the old client components did.
 */
export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { user, organizations, activeOrganization } = await getTenantContext(
        "/dashboard",
    );

    return (
        <SidebarProvider>
            <AppSidebar
                user={user}
                organizations={organizations}
                activeOrganization={activeOrganization}
            />
            <SidebarInset>
                <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
                    <SidebarTrigger className="-ml-1" />
                    <Separator orientation="vertical" className="mr-2 h-4" />
                    <CommandPalette />
                    <div className="flex-1" />
                    <UserNav user={user} />
                </header>
                <main className="flex-1 overflow-auto p-6">{children}</main>
            </SidebarInset>
        </SidebarProvider>
    );
}
