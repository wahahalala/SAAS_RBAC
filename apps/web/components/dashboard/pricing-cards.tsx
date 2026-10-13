"use client";

import { Check, Sparkles, Zap, Building2 } from "lucide-react";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useUiStore } from "@/lib/stores";
import { interpolate, type Dictionary } from "@/lib/i18n/format";

/**
 * The plan table carries only what does NOT translate — id, price, icon and the
 * "popular" flag. Name, description and feature list are looked up from the
 * dictionary by `id`, so the layout stays here and the copy lives in `en.ts` /
 * `zh.ts`.
 */
const plans = [
    { id: "free", price: 0, icon: Zap, popular: false },
    { id: "pro", price: 29, icon: Sparkles, popular: true },
    { id: "enterprise", price: 99, icon: Building2, popular: false },
] as const;

/**
 * Pricing cards.
 *
 * Client-side because the displayed price depends on the monthly/yearly toggle —
 * UI state held in Zustand. `currentPlan` and the dictionary are passed down from
 * the Server Component.
 */
export function PricingCards({
    currentPlan,
    dict,
}: {
    currentPlan: string;
    dict: Dictionary;
}) {
    const billingCycle = useUiStore((state) => state.billingCycle);
    const t = dict.dashboard.billing.pricing;

    return (
        <div className="grid gap-6 md:grid-cols-3">
            {plans.map((plan) => {
                const copy = t[plan.id];
                const isCurrentPlan = plan.id === currentPlan;
                const yearlyPrice = Math.round(plan.price * 0.8 * 12);
                const displayPrice =
                    billingCycle === "yearly" && plan.price > 0
                        ? Math.round(plan.price * 0.8)
                        : plan.price;

                return (
                    <Card
                        key={plan.id}
                        className={`relative flex flex-col ${
                            plan.popular
                                ? "border-primary shadow-lg shadow-primary/10"
                                : ""
                        }`}
                    >
                        {plan.popular && (
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                <Badge className="bg-primary">{t.popular}</Badge>
                            </div>
                        )}
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <div
                                    className={`rounded-lg p-2 ${
                                        plan.popular ? "bg-primary/10" : "bg-muted"
                                    }`}
                                >
                                    <plan.icon
                                        className={`h-5 w-5 ${
                                            plan.popular
                                                ? "text-primary"
                                                : "text-muted-foreground"
                                        }`}
                                    />
                                </div>
                                <CardTitle>{copy.name}</CardTitle>
                            </div>
                            <CardDescription>{copy.description}</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1">
                            <div className="mb-6">
                                <div className="flex items-baseline gap-1">
                                    <span className="text-4xl font-bold">
                                        ${displayPrice}
                                    </span>
                                    {plan.price > 0 && (
                                        <span className="text-muted-foreground">
                                            {t.perMonth}
                                        </span>
                                    )}
                                </div>
                                {billingCycle === "yearly" && plan.price > 0 && (
                                    <p className="text-sm text-muted-foreground mt-1">
                                        {interpolate(t.billedYearly, {
                                            amount: yearlyPrice,
                                        })}
                                    </p>
                                )}
                            </div>
                            <ul className="space-y-3">
                                {copy.features.map((feature) => (
                                    <li
                                        key={feature}
                                        className="flex items-start gap-3"
                                    >
                                        <Check className="h-5 w-5 shrink-0 text-emerald-500" />
                                        <span className="text-sm">{feature}</span>
                                    </li>
                                ))}
                            </ul>
                        </CardContent>
                        <CardFooter>
                            <Button
                                className="w-full"
                                variant={
                                    isCurrentPlan
                                        ? "outline"
                                        : plan.popular
                                          ? "default"
                                          : "secondary"
                                }
                                disabled={isCurrentPlan}
                            >
                                {isCurrentPlan
                                    ? t.currentPlan
                                    : interpolate(t.upgradeTo, { plan: copy.name })}
                            </Button>
                        </CardFooter>
                    </Card>
                );
            })}
        </div>
    );
}
