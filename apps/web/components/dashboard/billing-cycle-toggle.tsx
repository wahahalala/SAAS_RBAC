"use client";

import { Badge } from "@/components/ui/badge";
import { useUiStore } from "@/lib/stores";

/**
 * Monthly / yearly price toggle.
 *
 * A pure UI preference, so it lives in Zustand (the client store's job) rather
 * than in a Server Component. Extracted so the billing page itself can stay
 * server-rendered.
 */
export function BillingCycleToggle() {
    const billingCycle = useUiStore((state) => state.billingCycle);
    const setBillingCycle = useUiStore((state) => state.setBillingCycle);

    const base = "rounded-full px-4 py-2 text-sm font-medium transition-colors";
    const active = "bg-background text-foreground shadow-sm";
    const inactive = "text-muted-foreground hover:text-foreground";

    return (
        <div className="flex justify-center">
            <div className="inline-flex items-center rounded-full border p-1 bg-muted">
                <button
                    onClick={() => setBillingCycle("monthly")}
                    className={`${base} ${billingCycle === "monthly" ? active : inactive}`}
                >
                    Monthly
                </button>
                <button
                    onClick={() => setBillingCycle("yearly")}
                    className={`flex items-center gap-2 ${base} ${
                        billingCycle === "yearly" ? active : inactive
                    }`}
                >
                    Yearly
                    <Badge
                        variant="secondary"
                        className="bg-emerald-500/10 text-emerald-500 text-xs"
                    >
                        Save 20%
                    </Badge>
                </button>
            </div>
        </div>
    );
}
