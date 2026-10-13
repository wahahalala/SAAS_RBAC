"use client";

import { useTransition } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { acceptInvitationAction } from "@/app/actions/invitations";

/**
 * Accept button.
 *
 * The mutation is a Server Action, so the session token is never touched by
 * client code; on success it redirects to the organization that was just joined.
 */
export function AcceptInvitationButton({ token }: { token: string }) {
    const [isPending, startTransition] = useTransition();

    return (
        <Button
            className="w-full"
            disabled={isPending}
            onClick={() => {
                startTransition(async () => {
                    // The action redirects on success, so there is nothing to do
                    // with the result here.
                    await acceptInvitationAction(token);
                });
            }}
        >
            {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
            )}
            Accept invitation
        </Button>
    );
}
