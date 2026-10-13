"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { logoutAction } from "@/app/actions/auth";
import { deleteAccountAction } from "@/app/actions/account";

/**
 * Account actions (sign out, delete account).
 *
 * The only interactive parts of the settings page. Deleting an account is
 * irreversible, so it is confirmed first — the confirmation is UI state and
 * stays on the client, while the deletion itself is a Server Action.
 */
export function AccountActions() {
    const [isPending, startTransition] = useTransition();

    const handleDelete = () => {
        startTransition(async () => {
            const result = await deleteAccountAction();
            if (result?.error) {
                toast.error(result.error);
            }
            // On success the action redirects, so there is nothing to do here.
        });
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <p className="font-medium">Sign out</p>
                    <p className="text-sm text-muted-foreground">
                        Sign out from this device
                    </p>
                </div>
                <Button
                    variant="outline"
                    disabled={isPending}
                    onClick={() =>
                        startTransition(() => {
                            void logoutAction();
                        })
                    }
                >
                    Sign out
                </Button>
            </div>

            <div className="flex items-center justify-between">
                <div>
                    <p className="font-medium">Delete account</p>
                    <p className="text-sm text-muted-foreground">
                        Permanently delete your account and all data
                    </p>
                </div>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive" disabled={isPending}>
                            Delete account
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>
                                Delete your account?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                                This permanently deletes your account and the
                                memberships that link you to organizations. It
                                cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleDelete}
                                disabled={isPending}
                            >
                                {isPending && (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                )}
                                Delete account
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>
    );
}
