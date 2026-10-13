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
import { getDictionary } from "@/lib/i18n";

export default async function BillingPage() {
    const [{ activeOrganization: org }, permissions, dict] = await Promise.all([
        getTenantContext("/dashboard/billing"),
        getServerPermissions(),
        getDictionary(),
    ]);
    const t = dict.dashboard.billing;
    const currentPlan = org?.plan || "free";
    // Decided on the server: permissions are tenant-scoped and the page already
    // has them, so the panel does not have to ask again from the browser.
    const canManageReports = permissions.has("billing.manage");

    return (
        <TooltipProvider>
            <div className="space-y-8">
                {/* Header */}
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{t.title}</h1>
                    <p className="text-muted-foreground">{t.subtitle}</p>
                </div>

                {/* Current Plan Status */}
                <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                    <CardContent className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-6">
                        <div className="flex items-center gap-4">
                            <div className="rounded-full bg-primary/10 p-3">
                                <Zap className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">{t.currentPlan}</p>
                                <p className="text-xl font-bold capitalize">{currentPlan}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="text-right hidden md:block">
                                <p className="text-sm text-muted-foreground">{t.nextBillingDate}</p>
                                <p className="font-medium">
                                    {currentPlan === "free" ? "—" : "Jan 31, 2025"}
                                </p>
                            </div>
                            {currentPlan !== "free" && (
                                <Button variant="outline">{t.manageSubscription}</Button>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <BillingCycleToggle dict={dict} />

                <PricingCards currentPlan={currentPlan} dict={dict} />

                {/* Reports (async export) */}
                <ReportsPanel canManage={canManageReports} dict={dict} />

                {/* FAQ Section */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <HelpCircle className="h-5 w-5" />
                            {t.faqTitle}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-2">
                        {t.faqs.map((faq) => (
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
