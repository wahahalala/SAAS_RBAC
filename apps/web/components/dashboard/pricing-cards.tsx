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

const plans = [
    {
        id: "free",
        name: "Free",
        description: "For individuals and small projects",
        price: 0,
        features: [
            "Up to 3 team members",
            "5 GB storage",
            "Basic analytics",
            "Community support",
            "API access",
        ],
        icon: Zap,
        popular: false,
    },
    {
        id: "pro",
        name: "Pro",
        description: "For growing teams and businesses",
        price: 29,
        features: [
            "Unlimited team members",
            "100 GB storage",
            "Advanced analytics",
            "Priority support",
            "API access",
            "Custom branding",
            "SSO authentication",
            "Audit logs",
        ],
        icon: Sparkles,
        popular: true,
    },
    {
        id: "enterprise",
        name: "Enterprise",
        description: "For large organizations",
        price: 99,
        features: [
            "Everything in Pro",
            "Unlimited storage",
            "Dedicated support",
            "Custom integrations",
            "SLA guarantee",
            "On-premise option",
            "Advanced security",
            "Custom contracts",
        ],
        icon: Building2,
        popular: false,
    },
];

/**
 * Pricing cards.
 *
 * Client-side because the displayed price depends on the monthly/yearly toggle —
 * UI state held in Zustand. `currentPlan` is passed down from the Server
 * Component, which fetched the organization.
 */
export function PricingCards({ currentPlan }: { currentPlan: string }) {
    const billingCycle = useUiStore((state) => state.billingCycle);

    return (
        <div className="grid gap-6 md:grid-cols-3">
            {plans.map((plan) => {
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
                                <Badge className="bg-primary">Most Popular</Badge>
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
                                <CardTitle>{plan.name}</CardTitle>
                            </div>
                            <CardDescription>{plan.description}</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1">
                            <div className="mb-6">
                                <div className="flex items-baseline gap-1">
                                    <span className="text-4xl font-bold">
                                        ${displayPrice}
                                    </span>
                                    {plan.price > 0 && (
                                        <span className="text-muted-foreground">
                                            /month
                                        </span>
                                    )}
                                </div>
                                {billingCycle === "yearly" && plan.price > 0 && (
                                    <p className="text-sm text-muted-foreground mt-1">
                                        ${yearlyPrice} billed yearly
                                    </p>
                                )}
                            </div>
                            <ul className="space-y-3">
                                {plan.features.map((feature) => (
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
                                    ? "Current Plan"
                                    : `Upgrade to ${plan.name}`}
                            </Button>
                        </CardFooter>
                    </Card>
                );
            })}
        </div>
    );
}
