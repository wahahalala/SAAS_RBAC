"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
    Building2,
    Save,
    Loader2,
    Upload,
    Trash2,
    AlertTriangle,
    Link2,
    Globe,
    Shield
} from "lucide-react";
import { updateOrganizationSchema, type UpdateOrganizationInput } from "@saas/validation";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
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
import { useCurrentOrganization } from "@/hooks";

const orgSchema = updateOrganizationSchema;

type OrgFormData = UpdateOrganizationInput;

export default function OrganizationPage() {
    const { organization: org, isLoading } = useCurrentOrganization();
    const [isUpdating, setIsUpdating] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors, isDirty },
    } = useForm<OrgFormData>({
        resolver: zodResolver(orgSchema),
        values: {
            name: org?.name || "",
        },
    });

    const onSubmit = async (_data: OrgFormData) => {
        setIsUpdating(true);
        try {
            // In real app, call updateOrganization API
            await new Promise((resolve) => setTimeout(resolve, 1000));
            toast.success("Organization updated successfully");
        } catch {
            toast.error("Failed to update organization");
        } finally {
            setIsUpdating(false);
        }
    };

    const getInitials = (name: string) => {
        return name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Organization</h1>
                <p className="text-muted-foreground">
                    Manage your organization settings and details
                </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Main Settings */}
                <div className="lg:col-span-2 space-y-6">
                    {/* General Settings */}
                    <Card>
                        <CardHeader>
                            <CardTitle>General Settings</CardTitle>
                            <CardDescription>
                                Update your organization's profile information
                            </CardDescription>
                        </CardHeader>
                        <form onSubmit={handleSubmit(onSubmit)}>
                            <CardContent className="space-y-6">
                                {/* Logo Upload */}
                                <div className="flex items-center gap-6">
                                    <Avatar className="h-20 w-20 border-2">
                                        <AvatarImage src={org?.logo || undefined} />
                                        <AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">
                                            {org ? getInitials(org.name) : "?"}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="space-y-1">
                                        <Button type="button" variant="outline" size="sm">
                                            <Upload className="mr-2 h-4 w-4" />
                                            Upload Logo
                                        </Button>
                                        <p className="text-xs text-muted-foreground">
                                            Recommended: 256x256px, PNG or JPG
                                        </p>
                                    </div>
                                </div>

                                <Separator />

                                {/* Name */}
                                <div className="space-y-2">
                                    <Label htmlFor="name">Organization Name</Label>
                                    <Input
                                        id="name"
                                        placeholder="Acme Inc."
                                        {...register("name")}
                                    />
                                    {errors.name && (
                                        <p className="text-sm text-destructive">{errors.name.message}</p>
                                    )}
                                </div>

                                {/* Slug (read-only: the API has no slug update route) */}
                                <div className="space-y-2">
                                    <Label htmlFor="slug">Organization URL</Label>
                                    <div className="flex items-center gap-2">
                                        <div className="flex h-10 items-center rounded-md border bg-muted px-3 text-sm text-muted-foreground">
                                            <Globe className="mr-2 h-4 w-4" />
                                            yourdomain.com/
                                        </div>
                                        <Input
                                            id="slug"
                                            className="flex-1"
                                            placeholder="acme-inc"
                                            value={org?.slug || ""}
                                            disabled
                                            readOnly
                                        />
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        This is your organization's unique URL identifier and cannot be changed here
                                    </p>
                                </div>
                            </CardContent>
                            <CardFooter className="border-t pt-6">
                                <Button type="submit" disabled={isUpdating || !isDirty}>
                                    {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    <Save className="mr-2 h-4 w-4" />
                                    Save Changes
                                </Button>
                            </CardFooter>
                        </form>
                    </Card>

                    {/* Danger Zone */}
                    <Card className="border-destructive/50">
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-destructive" />
                                <CardTitle className="text-destructive">Danger Zone</CardTitle>
                            </div>
                            <CardDescription>
                                Irreversible and destructive actions
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between rounded-lg border border-destructive/20 bg-destructive/5 p-4">
                                <div>
                                    <p className="font-medium">Delete Organization</p>
                                    <p className="text-sm text-muted-foreground">
                                        Permanently delete this organization and all its data
                                    </p>
                                </div>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="destructive" size="sm">
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Delete
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                This action cannot be undone. This will permanently delete
                                                your organization <span className="font-semibold">{org?.name}</span> and
                                                remove all associated data including members and settings.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                                Delete Organization
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Quick Stats */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Organization Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Plan</span>
                                <Badge variant="secondary" className="capitalize">
                                    {org?.plan || "Free"}
                                </Badge>
                            </div>
                            <Separator />
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Members</span>
                                <span className="font-medium">{org?.memberCount || 0}</span>
                            </div>
                            <Separator />
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Your Role</span>
                                <Badge variant="outline" className="capitalize">
                                    <Shield className="mr-1 h-3 w-3" />
                                    {org?.role || "Admin"}
                                </Badge>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Quick Links */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Quick Links</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <Button variant="ghost" className="w-full justify-start" asChild>
                                <a href="/dashboard/team">
                                    <Building2 className="mr-2 h-4 w-4" />
                                    Manage Team
                                </a>
                            </Button>
                            <Button variant="ghost" className="w-full justify-start" asChild>
                                <a href="/dashboard/billing">
                                    <Link2 className="mr-2 h-4 w-4" />
                                    Billing & Plans
                                </a>
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
