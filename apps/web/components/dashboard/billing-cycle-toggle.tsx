"use client";

import { Badge } from "@/components/ui/badge";
import { useUiStore } from "@/lib/stores";
import type { Dictionary } from "@/lib/i18n/format";

/**
 * Monthly / yearly price toggle.
 *
 * A pure UI preference, so it lives in Zustand (the client store's job) rather
 * than in a Server Component. Extracted so the billing page itself can stay
 * server-rendered.
 */
export function BillingCycleToggle({ dict }: { dict: Dictionary }) {
    const billingCycle = useUiStore((state) => state.billingCycle);
    const setBillingCycle = useUiStore((state) => state.setBillingCycle);
    const t = dict.dashboard.billing;

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
                    {t.monthly}
                </button>
                <button
                    onClick={() => setBillingCycle("yearly")}
                    className={`flex items-center gap-2 ${base} ${
                        billingCycle === "yearly" ? active : inactive
                    }`}
                >
                    {t.yearly}
                    <Badge
                        variant="secondary"
                        className="bg-emerald-500/10 text-emerald-500 text-xs"
                    >
                        {t.savePercent}
                    </Badge>
                </button>
            </div>
        </div>
    );
}
