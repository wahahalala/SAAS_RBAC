"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
import { inviteMemberSchema, type InviteMemberInput } from "@saas/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { inviteMemberAction } from "@/app/actions/tenant";

/**
 * Invite a member.
 *
 * The mutation is a Server Action: it authenticates server-side, calls the API,
 * and revalidates the team page — so the new invitation appears because the
 * Server Component re-rendered, not because a client cache was patched.
 */
export function InviteMemberDialog() {
    const [isOpen, setIsOpen] = useState(false);
    const [isPending, startTransition] = useTransition();

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<InviteMemberInput>({
        resolver: zodResolver(inviteMemberSchema),
        defaultValues: { role: "member" },
    });

    const onSubmit = (data: InviteMemberInput) => {
        startTransition(async () => {
            const result = await inviteMemberAction(data);

            if (result.error) {
                toast.error(result.error);
                return;
            }

            toast.success(`Invitation sent to ${data.email}`);
            setIsOpen(false);
            reset();
        });
    };

    return (
        <Dialog
            open={isOpen}
            onOpenChange={(open) => {
                setIsOpen(open);
                if (!open) reset();
            }}
        >
            <DialogTrigger asChild>
                <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Invite Member
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Invite Team Member</DialogTitle>
                    <DialogDescription>
                        Send an invitation to join your organization
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="email">Email address</Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="colleague@example.com"
                            {...register("email")}
                        />
                        {errors.email && (
                            <p className="text-sm text-destructive">
                                {errors.email.message}
                            </p>
                        )}
                    </div>
                    <div className="space-y-2">
                        <Label>Role</Label>
                        <div className="grid grid-cols-2 gap-4">
                            <label className="relative flex cursor-pointer rounded-lg border p-4 hover:bg-muted/50 [&:has(:checked)]:border-primary [&:has(:checked)]:bg-primary/5">
                                <input
                                    type="radio"
                                    value="member"
                                    {...register("role")}
                                    className="sr-only"
                                />
                                <div className="flex flex-col">
                                    <span className="font-medium">Member</span>
                                    <span className="text-xs text-muted-foreground">
                                        Can view and edit
                                    </span>
                                </div>
                            </label>
                            <label className="relative flex cursor-pointer rounded-lg border p-4 hover:bg-muted/50 [&:has(:checked)]:border-primary [&:has(:checked)]:bg-primary/5">
                                <input
                                    type="radio"
                                    value="admin"
                                    {...register("role")}
                                    className="sr-only"
                                />
                                <div className="flex flex-col">
                                    <span className="font-medium">Admin</span>
                                    <span className="text-xs text-muted-foreground">
                                        Full access
                                    </span>
                                </div>
                            </label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isPending}>
                            {isPending && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            Send Invitation
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
