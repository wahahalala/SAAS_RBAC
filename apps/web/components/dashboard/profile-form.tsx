"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
    updateProfileSchema,
    type UpdateProfileInput,
} from "@saas/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProfileAction } from "@/app/actions/tenant";
import type { UserResponse } from "@saas/shared-types";

/**
 * Profile form.
 *
 * A Server Action rather than a client mutation: the request is authenticated
 * server-side and the action revalidates the layout, so the name shown in the
 * sidebar updates without any client cache manipulation.
 *
 * `defaultValues` come from the Server Component, which already fetched the user.
 */
export function ProfileForm({ user }: { user: UserResponse }) {
    const [isPending, startTransition] = useTransition();

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<UpdateProfileInput>({
        resolver: zodResolver(updateProfileSchema),
        defaultValues: { name: user.name ?? "" },
    });

    const onSubmit = (data: UpdateProfileInput) => {
        startTransition(async () => {
            const result = await updateProfileAction(data);
            if (result.error) {
                toast.error(result.error);
                return;
            }
            toast.success("Profile updated successfully");
        });
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="name">Display name</Label>
                <Input id="name" placeholder="Your name" {...register("name")} />
                {errors.name && (
                    <p className="text-sm text-destructive">
                        {errors.name.message}
                    </p>
                )}
            </div>

            <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={user.email} disabled readOnly />
                <p className="text-xs text-muted-foreground">
                    Your email is used to sign in and cannot be changed here.
                </p>
            </div>

            <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save changes
            </Button>
        </form>
    );
}
