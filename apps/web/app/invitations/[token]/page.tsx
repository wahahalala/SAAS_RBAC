"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    AlertTriangle,
    CheckCircle2,
    Clock,
    Loader2,
    MailX,
    ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/lib/stores";
import { useSessionBootstrap } from "@/hooks";

/**
 * Invitation accept page.
 *
 * Flow: the invited user follows the emailed link, sees who invited them and to
 * what, signs in (or creates an account) if needed, then accepts - which
 * creates their Membership. Acceptance requires the token only; the signed-in
 * email is deliberately not required to match the invited address.
 */
export default function InvitationPage() {
    const params = useParams<{ token: string }>();
    const token = params?.token ?? "";
    const router = useRouter();
    const queryClient = useQueryClient();

    const { isAuthenticated, isLoading: isAuthLoading } = useAuthStore();
    const [acceptError, setAcceptError] = useState<string | null>(null);

    // Restore the session from the refresh cookie, same as the dashboard does.
    useSessionBootstrap();

    const preview = useQuery({
        queryKey: ["invitation", token],
        queryFn: () => apiClient.getInvitation(token),
        enabled: Boolean(token),
        retry: false,
    });

    const accept = useMutation({
        mutationFn: () => apiClient.acceptInvitation(token),
        onSuccess: (result) => {
            // The new membership changes the user's tenant list; without this
            // the dashboard would keep showing the pre-invitation state.
            queryClient.invalidateQueries({ queryKey: ["organizations"] });
            queryClient.invalidateQueries({ queryKey: ["permissions"] });
            router.push(
                `/dashboard?joined=${encodeURIComponent(result.organizationSlug)}`,
            );
        },
        onError: (error: Error) => {
            setAcceptError(error.message || "Could not accept the invitation");
        },
    });

    // Clear a stale error whenever the auth state changes (after signing in).
    useEffect(() => {
        setAcceptError(null);
    }, [isAuthenticated]);

    const redirectTarget = encodeURIComponent(`/invitations/${token}`);
    const loginHref = `/login?redirect=${redirectTarget}`;
    const registerHref = `/register?redirect=${redirectTarget}`;

    if (preview.isLoading || isAuthLoading) {
        return (
            <Shell>
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
            </Shell>
        );
    }

    if (preview.isError || !preview.data) {
        return (
            <Shell>
                <StatusCard
                    icon={<MailX className="h-10 w-10 text-destructive" />}
                    title="Invitation not found"
                    description="This invitation link is invalid or has been removed. Ask an administrator to send a new one."
                />
            </Shell>
        );
    }

    const invitation = preview.data;

    if (invitation.status === "expired") {
        return (
            <Shell>
                <StatusCard
                    icon={<Clock className="h-10 w-10 text-muted-foreground" />}
                    title="Invitation expired"
                    description={`The invitation to join ${invitation.organizationName} expired. Ask an administrator for a new invitation.`}
                />
            </Shell>
        );
    }

    if (invitation.status === "canceled") {
        return (
            <Shell>
                <StatusCard
                    icon={
                        <AlertTriangle className="h-10 w-10 text-muted-foreground" />
                    }
                    title="Invitation revoked"
                    description={`An administrator revoked this invitation to ${invitation.organizationName}.`}
                />
            </Shell>
        );
    }

    if (invitation.status === "accepted") {
        return (
            <Shell>
                <StatusCard
                    icon={<CheckCircle2 className="h-10 w-10 text-primary" />}
                    title="Invitation already accepted"
                    description={`This invitation to ${invitation.organizationName} has already been used.`}
                />
            </Shell>
        );
    }

    return (
        <Shell>
            <Card className="w-full max-w-md">
                <CardHeader className="space-y-2 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                        <ShieldCheck className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle className="text-2xl font-bold">
                        Join {invitation.organizationName}
                    </CardTitle>
                    <CardDescription>
                        {invitation.invitedByName
                            ? `${invitation.invitedByName} invited you to collaborate.`
                            : "You have been invited to collaborate."}
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-5">
                    <div className="space-y-3 rounded-lg border p-4 text-sm">
                        <Row label="Organization">
                            {invitation.organizationName}
                        </Row>
                        <Separator />
                        <Row label="Invited email">{invitation.email}</Row>
                        <Separator />
                        <Row label="Role">
                            <Badge
                                variant={
                                    invitation.role === "admin"
                                        ? "default"
                                        : "secondary"
                                }
                                className="capitalize"
                            >
                                {invitation.role}
                            </Badge>
                        </Row>
                    </div>

                    {acceptError && (
                        <p className="text-sm text-destructive">{acceptError}</p>
                    )}

                    {isAuthenticated ? (
                        <Button
                            className="w-full"
                            onClick={() => accept.mutate()}
                            disabled={accept.isPending}
                        >
                            {accept.isPending ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                            )}
                            Accept invitation
                        </Button>
                    ) : (
                        <div className="space-y-3">
                            <p className="text-sm text-muted-foreground">
                                {invitation.accountExists
                                    ? "Sign in to accept this invitation."
                                    : "Create an account to accept this invitation."}
                            </p>
                            <Button className="w-full" asChild>
                                <Link href={loginHref}>Sign in to accept</Link>
                            </Button>
                            <Button variant="outline" className="w-full" asChild>
                                <Link href={registerHref}>
                                    Create an account
                                </Link>
                            </Button>
                        </div>
                    )}

                    <p className="text-center text-xs text-muted-foreground">
                        Invitation expires{" "}
                        {new Date(invitation.expiresAt).toLocaleDateString()}
                    </p>
                </CardContent>
            </Card>
        </Shell>
    );
}

function Shell({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/50 p-4">
            {children}
        </div>
    );
}

function Row({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">{label}</span>
            <span className="truncate font-medium">{children}</span>
        </div>
    );
}

function StatusCard({
    icon,
    title,
    description,
}: {
    icon: React.ReactNode;
    title: string;
    description: string;
}) {
    return (
        <Card className="w-full max-w-md">
            <CardHeader className="space-y-2 text-center">
                <div className="mx-auto">{icon}</div>
                <CardTitle className="text-xl font-bold">{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
        </Card>
    );
}
