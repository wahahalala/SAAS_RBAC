import { HelpCircle, Zap } from "lucide-react";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    TooltipProvider,
} from "@/components/ui/tooltip";
import {
    BillingCycleToggle,
    PricingCards,
    ReportsPanel,
} from "@/components/dashboard";
import { getServerPermissions, getTenantContext } from "@/lib/server/tenant";

export default async function BillingPage() {
    const [{ activeOrganization: org }, permissions] = await Promise.all([
        getTenantContext("/dashboard/billing"),
        getServerPermissions(),
    ]);
    const currentPlan = org?.plan || "free";
    // Decided on the server: permissions are tenant-scoped and the page already
    // has them, so the panel does not have to ask again from the browser.
    const canManageReports = permissions.has("billing.manage");

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

                <BillingCycleToggle />

                <PricingCards currentPlan={currentPlan} />

                {/* Reports (async export) */}
                <ReportsPanel canManage={canManageReports} />

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
