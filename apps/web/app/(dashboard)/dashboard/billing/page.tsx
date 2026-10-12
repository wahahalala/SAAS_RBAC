"use client";

import { useState } from "react";
import { Check, Sparkles, Zap, Building2, HelpCircle } from "lucide-react";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    TooltipProvider,
} from "@/components/ui/tooltip";
import { useCurrentOrganization } from "@/hooks";
import { ReportsPanel } from "@/components/dashboard";

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

export default function BillingPage() {
    const { organization: org } = useCurrentOrganization();
    const currentPlan = org?.plan || "free";
    const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

    return (
        <TooltipProvider>
            <div className="space-y-8">
                {/* Header */}
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Billing</h1>
                    <p className="text-muted-foreground">
                        Manage your subscription and billing details
                    </p>
                </div>

                {/* Current Plan Status */}
                <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                    <CardContent className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-6">
                        <div className="flex items-center gap-4">
                            <div className="rounded-full bg-primary/10 p-3">
                                <Zap className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Current Plan</p>
                                <p className="text-xl font-bold capitalize">{currentPlan}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="text-right hidden md:block">
                                <p className="text-sm text-muted-foreground">Next billing date</p>
                                <p className="font-medium">
                                    {currentPlan === "free" ? "—" : "Jan 31, 2025"}
                                </p>
                            </div>
                            {currentPlan !== "free" && (
                                <Button variant="outline">Manage Subscription</Button>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Billing Cycle Toggle */}
                <div className="flex justify-center">
                    <div className="inline-flex items-center rounded-full border p-1 bg-muted">
                        <button
                            onClick={() => setBillingCycle("monthly")}
                            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${billingCycle === "monthly"
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                                }`}
                        >
                            Monthly
                        </button>
                        <button
                            onClick={() => setBillingCycle("yearly")}
                            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${billingCycle === "yearly"
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                                }`}
                        >
                            Yearly
                            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 text-xs">
                                Save 20%
                            </Badge>
                        </button>
                    </div>
                </div>

                {/* Pricing Cards */}
                <div className="grid gap-6 md:grid-cols-3">
                    {plans.map((plan) => {
                        const isCurrentPlan = plan.id === currentPlan;
                        const yearlyPrice = Math.round(plan.price * 0.8 * 12);
                        const displayPrice = billingCycle === "yearly" && plan.price > 0
                            ? Math.round(plan.price * 0.8)
                            : plan.price;

                        return (
                            <Card
                                key={plan.id}
                                className={`relative flex flex-col ${plan.popular
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
                                        <div className={`rounded-lg p-2 ${plan.popular ? "bg-primary/10" : "bg-muted"
                                            }`}>
                                            <plan.icon className={`h-5 w-5 ${plan.popular ? "text-primary" : "text-muted-foreground"
                                                }`} />
                                        </div>
                                        <CardTitle>{plan.name}</CardTitle>
                                    </div>
                                    <CardDescription>{plan.description}</CardDescription>
                                </CardHeader>
                                <CardContent className="flex-1">
                                    <div className="mb-6">
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-4xl font-bold">${displayPrice}</span>
                                            {plan.price > 0 && (
                                                <span className="text-muted-foreground">/month</span>
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
                                            <li key={feature} className="flex items-start gap-3">
                                                <Check className="h-5 w-5 shrink-0 text-emerald-500" />
                                                <span className="text-sm">{feature}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </CardContent>
                                <CardFooter>
                                    <Button
                                        className="w-full"
                                        variant={isCurrentPlan ? "outline" : plan.popular ? "default" : "secondary"}
                                        disabled={isCurrentPlan}
                                    >
                                        {isCurrentPlan ? "Current Plan" : `Upgrade to ${plan.name}`}
                                    </Button>
                                </CardFooter>
                            </Card>
                        );
                    })}
                </div>

                {/* Reports (async export) */}
                <ReportsPanel />

                {/* FAQ Section */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <HelpCircle className="h-5 w-5" />
                            Frequently Asked Questions
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-2">
                        {[
                            {
                                q: "Can I change plans at any time?",
                                a: "Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately.",
                            },
                            {
                                q: "What payment methods do you accept?",
                                a: "We accept all major credit cards (Visa, Mastercard, Amex) and PayPal.",
                            },
                            {
                                q: "Is there a free trial?",
                                a: "Yes, all paid plans come with a 14-day free trial. No credit card required.",
                            },
                            {
                                q: "Can I get a refund?",
                                a: "We offer a 30-day money-back guarantee on all paid plans.",
                            },
                        ].map((faq) => (
                            <div key={faq.q} className="space-y-2">
                                <h4 className="font-medium">{faq.q}</h4>
                                <p className="text-sm text-muted-foreground">{faq.a}</p>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </div>
        </TooltipProvider>
    );
}
