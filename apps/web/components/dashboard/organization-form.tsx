"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Upload, Globe } from "lucide-react";
import {
    updateOrganizationSchema,
    type UpdateOrganizationInput,
} from "@saas/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { updateOrganizationAction } from "@/app/actions/tenant";
import type { OrganizationMembershipResponse } from "@saas/shared-types";
import type { Dictionary } from "@/lib/i18n/format";

/**
 * Organization settings form.
 *
 * A Server Action does the update and revalidates the page, so the header and
 * sidebar (rendered by the Server Component) pick up the new name — the client
 * never patches a cache.
 */
export function OrganizationForm({
    organization,
    dict,
}: {
    organization: OrganizationMembershipResponse;
    dict: Dictionary;
}) {
    const t = dict.dashboard.settings;
    const [isPending, startTransition] = useTransition();

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<UpdateOrganizationInput>({
        resolver: zodResolver(updateOrganizationSchema),
        defaultValues: { name: organization.name },
    });

    const getInitials = (name: string) =>
        name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);

    const onSubmit = (data: UpdateOrganizationInput) => {
        startTransition(async () => {
            const result = await updateOrganizationAction(data);
            if (result.error) {
                toast.error(result.error);
                return;
            }
            toast.success(t.organizationUpdated);
        });
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-6">
                <div className="flex items-center gap-6">
                    <Avatar className="h-20 w-20 border-2">
                        <AvatarImage src={organization.logo || undefined} />
                        <AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">
                            {getInitials(organization.name)}
                        </AvatarFallback>
                    </Avatar>
                    <div className="space-y-1">
                        <Button type="button" variant="outline" size="sm" disabled>
                            <Upload className="mr-2 h-4 w-4" />
                            {t.uploadLogo}
                        </Button>
                        <p className="text-xs text-muted-foreground">
                            {t.logoNotEnabled}
                        </p>
                    </div>
                </div>

                <Separator />

                <div className="space-y-2">
                    <Label htmlFor="name">{t.organizationName}</Label>
                    <Input
                        id="name"
                        placeholder={t.organizationNamePlaceholder}
                        {...register("name")}
                    />
                    {errors.name && (
                        <p className="text-sm text-destructive">
                            {errors.name.message}
                        </p>
                    )}
                </div>

                {/* Slug is read-only: the API has no slug update route, and a
                    URL identifier that silently changed would break links. */}
                <div className="space-y-2">
                    <Label htmlFor="slug">{t.organizationUrl}</Label>
                    <div className="flex items-center gap-2">
                        <div className="flex h-10 items-center rounded-md border bg-muted px-3 text-sm text-muted-foreground">
                            <Globe className="mr-2 h-4 w-4" />
                            yourdomain.com/
                        </div>
                        <Input
                            id="slug"
                            className="flex-1"
                            value={organization.slug}
                            disabled
                            readOnly
                        />
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {t.slugHint}
                    </p>
                </div>

                <Button type="submit" disabled={isPending}>
                    {isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {t.saveChanges}
                </Button>
            </div>
        </form>
    );
}
