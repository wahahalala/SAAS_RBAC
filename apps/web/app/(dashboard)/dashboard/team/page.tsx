"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
    Plus,
    MoreHorizontal,
    Mail,
    Shield,
    UserMinus,
    Loader2,
    Users,
    Crown,
    Clock
} from "lucide-react";import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { apiClient } from "@/lib/api-client";
import { useCurrentOrganization } from "@/hooks";
import { inviteMemberSchema, type InviteMemberInput } from "@saas/validation";

export default function TeamPage() {
    const [isInviteOpen, setIsInviteOpen] = useState(false);
    const [memberToRemove, setMemberToRemove] = useState<string | null>(null);
    const queryClient = useQueryClient();
    const { organization: org } = useCurrentOrganization();

    const { data: members, isLoading } = useQuery({
        queryKey: ["members", org?.slug],
        queryFn: () => apiClient.getOrganizationMembers(org!.slug),
        enabled: !!org?.slug,
    });

    const inviteMutation = useMutation({
        mutationFn: (data: InviteMemberInput) =>
            apiClient.inviteMember(org!.slug, data),
        onSuccess: () => {
            toast.success("Invitation sent successfully");
            setIsInviteOpen(false);
            queryClient.invalidateQueries({ queryKey: ["members", org?.slug] });
        },
        onError: (error: Error) => {
            toast.error(error.message || "Failed to send invitation");
        },
    });

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<InviteMemberInput>({
        resolver: zodResolver(inviteMemberSchema),
        defaultValues: {
            role: "member",
        },
    });

    const onSubmit = (data: InviteMemberInput) => {
        inviteMutation.mutate(data);
    };

    const getInitials = (name: string | null) => {
        if (!name) return "?";
        return name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
    };

    const formatDate = (dateString: string | Date) => {
        return new Date(dateString).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    };

    const stats = [
        {
            title: "Total Members",
            value: members?.length || 0,
            icon: Users,
            color: "text-blue-500",
        },
        {
            title: "Admins",
            value: members?.filter((m) => m.role === "admin").length || 0,
            icon: Crown,
            color: "text-amber-500",
        },
        {
            title: "Members",
            value: members?.filter((m) => m.role === "member").length || 0,
            icon: Shield,
            color: "text-emerald-500",
        },
    ];

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Team</h1>
                    <p className="text-muted-foreground">
                        Manage your team members and their roles
                    </p>
                </div>
                <Dialog open={isInviteOpen} onOpenChange={(open) => {
                    setIsInviteOpen(open);
                    if (!open) reset();
                }}>
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
                                    <p className="text-sm text-destructive">{errors.email.message}</p>
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
                                    onClick={() => setIsInviteOpen(false)}
                                >
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={inviteMutation.isPending}>
                                    {inviteMutation.isPending && (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    )}
                                    Send Invitation
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-3">
                {stats.map((stat) => (
                    <Card key={stat.title}>
                        <CardContent className="flex items-center gap-4 p-6">
                            <div className={`rounded-full bg-muted p-3 ${stat.color}`}>
                                <stat.icon className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">{stat.title}</p>
                                <p className="text-2xl font-bold">{stat.value}</p>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Members List */}
            <Card>
                <CardHeader>
                    <CardTitle>Team Members</CardTitle>
                    <CardDescription>
                        People with access to this organization
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : members && members.length > 0 ? (
                        <div className="divide-y">
                            {members.map((member) => (
                                <div
                                    key={member.id}
                                    className="flex items-center justify-between py-4 first:pt-0 last:pb-0"
                                >
                                    <div className="flex items-center gap-4">
                                        <Avatar className="h-10 w-10 border">
                                            <AvatarImage src={member.user.image || undefined} />
                                            <AvatarFallback className="text-sm">
                                                {getInitials(member.user.name)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="font-medium">
                                                    {member.user.name || "Unnamed"}
                                                </p>
                                                {member.role === "admin" && (
                                                    <Badge variant="secondary" className="text-xs">
                                                        <Crown className="mr-1 h-3 w-3" />
                                                        Admin
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-sm text-muted-foreground">
                                                {member.user.email}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="hidden text-right md:block">
                                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                <Clock className="h-3 w-3" />
                                                Joined {formatDate(member.createdAt)}
                                            </div>
                                        </div>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                    <span className="sr-only">Open menu</span>
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem>
                                                    <Mail className="mr-2 h-4 w-4" />
                                                    Send email
                                                </DropdownMenuItem>
                                                <DropdownMenuItem>
                                                    <Shield className="mr-2 h-4 w-4" />
                                                    Change role
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    className="text-destructive focus:text-destructive"
                                                    onClick={() => setMemberToRemove(member.id)}
                                                >
                                                    <UserMinus className="mr-2 h-4 w-4" />
                                                    Remove member
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                            <Users className="h-12 w-12 text-muted-foreground/50" />
                            <h3 className="mt-4 font-semibold">No team members yet</h3>
                            <p className="text-sm text-muted-foreground">
                                Invite your first team member to get started
                            </p>
                            <Button
                                className="mt-4"
                                onClick={() => setIsInviteOpen(true)}
                            >
                                <Plus className="mr-2 h-4 w-4" />
                                Invite Member
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Remove Member Dialog */}
            <AlertDialog
                open={!!memberToRemove}
                onOpenChange={(open) => !open && setMemberToRemove(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove team member?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently remove the
                            member from your organization.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Remove
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
