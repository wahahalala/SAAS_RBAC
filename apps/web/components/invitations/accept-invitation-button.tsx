"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
    const router = useRouter();
    const [isPending, setIsPending] = useState(false);

    return (
        <Button
            className="w-full"
            disabled={isPending}
            onClick={() => {
                setIsPending(true);
                void acceptInvitationAction(token)
                    .then((result) => {
                        if (result?.error) {
                            // Errors are server-rendered via the status card on
                            // revalidation; a hard reload surfaces them reliably.
                            router.refresh();
                        } else if (result?.redirectTo) {
                            router.push(result.redirectTo);
                            router.refresh();
                        }
                    })
                    .finally(() => setIsPending(false));
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
