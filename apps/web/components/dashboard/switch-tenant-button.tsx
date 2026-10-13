"use client";

import { useTransition } from "react";
import { ArrowUpRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { switchTenantAction } from "@/app/actions/tenant";

/**
 * Switch the active organization.
 *
 * The one interactive piece of the (otherwise server-rendered) dashboard page:
 * it runs the Server Action that sets the tenant cookie and revalidates, so the
 * server re-renders every scoped page. Keeping it a separate component is what
 * lets the page itself stay a Server Component.
 */
export function SwitchTenantButton({
    tenantId,
    isActive,
}: {
    tenantId: string;
    isActive: boolean;
}) {
    const [isPending, startTransition] = useTransition();

    if (isActive) {
        return (
            <span className="text-sm text-muted-foreground">
                Active tenant
            </span>
        );
    }

    return (
        <button
            type="button"
            disabled={isPending}
            onClick={() =>
                startTransition(async () => {
                    const result = await switchTenantAction(tenantId);
                    if (result.error) toast.error(result.error);
                })
            }
            className="text-sm text-primary hover:underline flex items-center gap-1 disabled:opacity-50"
        >
            {isPending && <Loader2 className="h-3 w-3 animate-spin" />}
            Switch to this organization
            <ArrowUpRight className="h-3 w-3" />
        </button>
    );
}
