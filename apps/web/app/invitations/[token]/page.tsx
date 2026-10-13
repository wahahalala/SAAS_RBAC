import Link from "next/link";
import {
    AlertTriangle,
    CheckCircle2,
    Clock,
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
import { AcceptInvitationButton } from "@/components/invitations/accept-invitation-button";
import { selfOrigin } from "@/lib/server/origin";
import { getServerSession } from "@/lib/server/session";
import { getDictionary, interpolate } from "@/lib/i18n";
import type { InvitationPreviewResponse } from "@saas/shared-types";

/**
 * Invitation accept page.
 *
 * A Server Component: the preview is fetched during the render, so the page shows
 * who invited them on first paint. It is a PUBLIC route, so the fetch carries no
 * credentials (the token in the URL is the credential) — the "accept" button is
 * the only part that needs a session, and it is a Client Component calling a
 * Server Action.
 */

/** Preview endpoint is public, so no auth header is sent. */
async function fetchPreview(
    token: string,
): Promise<InvitationPreviewResponse | null> {
    try {
        const response = await fetch(
            `${selfOrigin()}/api/v1/invitations/${token}`,
            { cache: "no-store" },
        );
        if (!response.ok) return null;
        return (await response.json()) as InvitationPreviewResponse;
    } catch {
        return null;
    }
}

export default async function InvitationPage({
    params,
}: {
    params: Promise<{ token: string }>;
}) {
    const { token } = await params;

    const [preview, session, dict] = await Promise.all([
        fetchPreview(token),
        getServerSession(),
        getDictionary(),
    ]);
    const t = dict.invitation;

    const redirectTarget = encodeURIComponent(`/invitations/${token}`);
    const loginHref = `/login?redirect=${redirectTarget}`;
    const registerHref = `/register?redirect=${redirectTarget}`;

    if (!preview) {
        return (
            <Shell>
                <StatusCard
                    icon={<MailX className="h-10 w-10 text-destructive" />}
                    title={t.notFound.title}
                    description={t.notFound.description}
                />
            </Shell>
        );
    }

    if (preview.status === "expired") {
        return (
            <Shell>
                <StatusCard
                    icon={<Clock className="h-10 w-10 text-muted-foreground" />}
                    title={t.expired.title}
                    description={interpolate(t.expired.description, {
                        organization: preview.organizationName,
                    })}
                />
            </Shell>
        );
    }

    if (preview.status === "canceled") {
        return (
            <Shell>
                <StatusCard
                    icon={
                        <AlertTriangle className="h-10 w-10 text-muted-foreground" />
                    }
                    title={t.revoked.title}
                    description={interpolate(t.revoked.description, {
                        organization: preview.organizationName,
                    })}
                />
            </Shell>
        );
    }

    if (preview.status === "accepted") {
        return (
            <Shell>
                <StatusCard
                    icon={<CheckCircle2 className="h-10 w-10 text-primary" />}
                    title={t.accepted.title}
                    description={interpolate(t.accepted.description, {
                        organization: preview.organizationName,
                    })}
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
                        {interpolate(t.joinTitle, {
                            organization: preview.organizationName,
                        })}
                    </CardTitle>
                    <CardDescription>
                        {preview.invitedByName
                            ? interpolate(t.invitedBy, {
                                  name: preview.invitedByName,
                              })
                            : t.invitedGeneric}
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-5">
                    <div className="space-y-3 rounded-lg border p-4 text-sm">
                        <Row label={t.organization}>
                            {preview.organizationName}
                        </Row>
                        <Separator />
                        <Row label={t.invitedEmail}>{preview.email}</Row>
                        <Separator />
                        <Row label={t.role}>
                            <Badge
                                variant={
                                    preview.role === "admin"
                                        ? "default"
                                        : "secondary"
                                }
                                className="capitalize"
                            >
                                {preview.role}
                            </Badge>
                        </Row>
                    </div>

                    {session ? (
                        <AcceptInvitationButton token={token} dict={t} />
                    ) : (
                        <div className="space-y-3">
                            <p className="text-sm text-muted-foreground">
                                {preview.accountExists
                                    ? t.signInToAccept
                                    : t.createAccountToAccept}
                            </p>
                            <Button className="w-full" asChild>
                                <Link href={loginHref}>{t.signInButton}</Link>
                            </Button>
                            <Button variant="outline" className="w-full" asChild>
                                <Link href={registerHref}>
                                    {t.createAccountButton}
                                </Link>
                            </Button>
                        </div>
                    )}

                    <p className="text-center text-xs text-muted-foreground">
                        {interpolate(t.expires, {
                            date: new Date(
                                preview.expiresAt,
                            ).toLocaleDateString(),
                        })}
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
