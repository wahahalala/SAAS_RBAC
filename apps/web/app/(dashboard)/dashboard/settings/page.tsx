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

/**
 * Settings page.
 *
 * A Server Component: the user is already available from the session, so the
 * profile form renders with its values filled in — no client fetch, and no
 * empty-then-populated flash. The two interactive pieces are Client Components.
 */
export default async function SettingsPage() {
    const { user } = await getTenantContext("/dashboard/settings");

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
                <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                <p className="text-muted-foreground">
                    Manage your account settings and preferences.
                </p>
            </div>

            <Tabs defaultValue="profile" className="space-y-6">
                <TabsList>
                    <TabsTrigger value="profile">Profile</TabsTrigger>
                    <TabsTrigger value="account">Account</TabsTrigger>
                    <TabsTrigger value="notifications">Notifications</TabsTrigger>
                </TabsList>

                <TabsContent value="profile" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Profile Information</CardTitle>
                            <CardDescription>
                                Update your personal information.
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
                                        Avatar upload is not enabled yet.
                                    </p>
                                </div>
                            </div>

                            <Separator />

                            <ProfileForm user={user} />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="account" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Account Security</CardTitle>
                            <CardDescription>
                                Manage your account security settings.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium">Email verified</p>
                                    <p className="text-sm text-muted-foreground">
                                        {user.emailVerified
                                            ? "Your email is verified"
                                            : "Please verify your email"}
                                    </p>
                                </div>
                                <span
                                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                        user.emailVerified
                                            ? "bg-primary/10 text-primary"
                                            : "bg-destructive/10 text-destructive"
                                    }`}
                                >
                                    {user.emailVerified ? "Verified" : "Unverified"}
                                </span>
                            </div>
                            <Separator />
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium">Password</p>
                                    <p className="text-sm text-muted-foreground">
                                        Change your password
                                    </p>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Not available yet
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-destructive">
                        <CardHeader>
                            <CardTitle className="text-destructive">
                                Danger Zone
                            </CardTitle>
                            <CardDescription>
                                Irreversible actions for your account.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <AccountActions />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="notifications" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Notification Preferences</CardTitle>
                            <CardDescription>
                                Choose how you want to be notified.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground">
                                Notification settings coming soon.
                            </p>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
