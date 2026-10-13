import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ProfileForm } from "@/components/dashboard/profile-form";
import { AccountActions } from "@/components/dashboard/account-actions";
import { getTenantContext } from "@/lib/server/tenant";
import { getDictionary } from "@/lib/i18n";

/**
 * Settings page.
 *
 * A Server Component: the user is already available from the session, so the
 * profile form renders with its values filled in — no client fetch, and no
 * empty-then-populated flash. The two interactive pieces are Client Components.
 */
export default async function SettingsPage() {
    const [{ user }, dict] = await Promise.all([
        getTenantContext("/dashboard/settings"),
        getDictionary(),
    ]);
    const t = dict.dashboard.settings;

    const getInitials = (name: string | null) => {
        if (!name) return "U";
        return name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">{t.title}</h1>
                <p className="text-muted-foreground">{t.subtitle}</p>
            </div>

            <Tabs defaultValue="profile" className="space-y-6">
                <TabsList>
                    <TabsTrigger value="profile">{t.tabProfile}</TabsTrigger>
                    <TabsTrigger value="account">{t.tabAccount}</TabsTrigger>
                    <TabsTrigger value="notifications">{t.tabNotifications}</TabsTrigger>
                </TabsList>

                <TabsContent value="profile" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>{t.profileInformation}</CardTitle>
                            <CardDescription>
                                {t.profileInformationDescription}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center gap-4">
                                <Avatar className="h-20 w-20">
                                    <AvatarImage
                                        src={user.image || undefined}
                                        alt={user.name || ""}
                                    />
                                    <AvatarFallback className="text-lg">
                                        {getInitials(user.name)}
                                    </AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="text-sm text-muted-foreground">
                                        {t.avatarNotEnabled}
                                    </p>
                                </div>
                            </div>

                            <Separator />

                            <ProfileForm user={user} dict={dict} />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="account" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>{t.accountSecurity}</CardTitle>
                            <CardDescription>
                                {t.accountSecurityDescription}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium">{t.emailVerified}</p>
                                    <p className="text-sm text-muted-foreground">
                                        {user.emailVerified
                                            ? t.emailVerifiedTrue
                                            : t.emailVerifiedFalse}
                                    </p>
                                </div>
                                <span
                                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                        user.emailVerified
                                            ? "bg-primary/10 text-primary"
                                            : "bg-destructive/10 text-destructive"
                                    }`}
                                >
                                    {user.emailVerified ? t.verified : t.unverified}
                                </span>
                            </div>
                            <Separator />
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium">{t.password}</p>
                                    <p className="text-sm text-muted-foreground">
                                        {t.changePassword}
                                    </p>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {dict.common.notAvailableYet}
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-destructive">
                        <CardHeader>
                            <CardTitle className="text-destructive">
                                {t.dangerZone}
                            </CardTitle>
                            <CardDescription>
                                {t.dangerZoneDescription}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <AccountActions dict={dict} />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="notifications" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>{t.notificationPreferences}</CardTitle>
                            <CardDescription>
                                {t.notificationPreferencesDescription}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground">
                                {t.notificationsComingSoon}
                            </p>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
