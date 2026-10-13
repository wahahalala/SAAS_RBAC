"use client";

import { useState, useTransition } from "react";
import {
    Check,
    ChevronsUpDown,
    Plus,
    Building2,
    Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { switchTenantAction, createOrganizationAction } from "@/app/actions/tenant";
import type { OrganizationMembershipResponse } from "@saas/shared-types";

interface OrgSwitcherProps {
    collapsed?: boolean;
    organizations: OrganizationMembershipResponse[];
    activeOrganization: OrganizationMembershipResponse | null;
}

/**
 * Organization switcher.
 *
 * The tenant list and the active tenant arrive as props from the Server
 * Component layout. Switching or creating runs a Server Action, which writes the
 * tenant cookie and revalidates — the server then re-renders every page with the
 * new scope. Nothing here reads or writes storage, so there is no client/server
 * disagreement about which tenant is active.
 */
export function OrgSwitcher({
    collapsed = false,
    organizations,
    activeOrganization,
}: OrgSwitcherProps) {
    const [isPending, startTransition] = useTransition();
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newOrgName, setNewOrgName] = useState("");
    const [error, setError] = useState<string | null>(null);

    const selectedOrg = activeOrganization;
    const activeTenantId = activeOrganization?.tenantId ?? null;

    const getInitials = (name: string) => {
        return name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
    };

    const handleCreateOrg = () => {
        if (!newOrgName.trim()) return;
        setError(null);

        startTransition(async () => {
            const result = await createOrganizationAction({ name: newOrgName });
            if (result.error) {
                // Surfaced inline: the API's message ("slug already exists")
                // is more useful than a generic failure toast.
                setError(result.error);
                return;
            }
            setIsCreateOpen(false);
            setNewOrgName("");
        });
    };

    const handleSwitch = (tenantId: string) => {
        if (tenantId === activeTenantId) return;
        startTransition(async () => {
            const result = await switchTenantAction(tenantId);
            if (result.error) setError(result.error);
        });
    };

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="outline"
                        className={`justify-between ${collapsed ? "w-10 p-0" : "w-full"}`}
                    >
                        <div className="flex items-center gap-2 truncate">
                            <Avatar className="h-6 w-6 shrink-0">
                                <AvatarImage src={selectedOrg?.logo || undefined} />
                                <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                    {selectedOrg ? getInitials(selectedOrg.name) : "?"}
                                </AvatarFallback>
                            </Avatar>
                            {!collapsed && (
                                <span className="truncate font-medium">
                                    {selectedOrg?.name || "Select organization"}
                                </span>
                            )}
                        </div>
                        {!collapsed && <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                    <DropdownMenuLabel>Organizations</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {organizations.length > 0 ? (
                        organizations.map((org) => (
                            <DropdownMenuItem
                                key={org.id}
                                disabled={isPending}
                                onClick={() => handleSwitch(org.tenantId)}
                                className="flex items-center gap-2"
                            >
                                <Avatar className="h-6 w-6">
                                    <AvatarImage src={org.logo || undefined} />
                                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                        {getInitials(org.name)}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 truncate">
                                    <p className="font-medium truncate">{org.name}</p>
                                    <p className="text-xs text-muted-foreground capitalize">
                                        {org.role} • {org.plan}
                                    </p>
                                </div>
                                {org.tenantId === activeTenantId && (
                                    <Check className="h-4 w-4 text-primary" />
                                )}
                            </DropdownMenuItem>
                        ))
                    ) : (
                        <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                            <Building2 className="mx-auto h-8 w-8 mb-2 opacity-50" />
                            No organizations yet
                        </div>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setIsCreateOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Create Organization
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Create Organization Dialog */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Create Organization</DialogTitle>
                        <DialogDescription>
                            Create a new organization to collaborate with your team
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="org-name">Organization Name</Label>
                            <Input
                                id="org-name"
                                placeholder="Acme Inc."
                                value={newOrgName}
                                onChange={(e) => setNewOrgName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        handleCreateOrg();
                                    }
                                }}
                            />
                            {error && (
                                <p className="text-sm text-destructive">{error}</p>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleCreateOrg}
                            disabled={!newOrgName.trim() || isPending}
                        >
                            {isPending && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            Create Organization
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
