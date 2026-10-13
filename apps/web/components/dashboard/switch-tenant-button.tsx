"use client";

import { useTransition } from "react";
import { ArrowUpRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { switchTenantAction } from "@/app/actions/tenant";
import type { Dictionary } from "@/lib/i18n/format";

/**
 * Switch the active organization.
 *
 * The one interactive piece of the (otherwise server-rendered) dashboard page:
 * it runs the Server Action that sets the tenant cookie and revalidates, so the
 * server re-renders every scoped page. Keeping it a separate component is what
 * lets the page itself stay a Server Component.
 *
 * The two labels it renders come in as a prop rather than being hardcoded, so
 * the button follows the active language without becoming a translation owner.
 */
export function SwitchTenantButton({
    tenantId,
    isActive,
    dict,
}: {
    tenantId: string;
    isActive: boolean;
    dict: Dictionary["dashboard"]["overview"];
}) {
    const [isPending, startTransition] = useTransition();

    if (isActive) {
        return (
            <span className="text-sm text-muted-foreground">
                {dict.activeTenant}
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
            {dict.switchTo}
            <ArrowUpRight className="h-3 w-3" />
        </button>
    );
}
