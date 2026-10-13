"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
    Clock,
    Crown,
    Loader2,
    Mail,
    MoreHorizontal,
    Shield,
    UserMinus,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { removeMemberAction, updateMemberRoleAction } from "@/app/actions/tenant";
import type { MemberResponse } from "@saas/shared-types";
import { interpolate, type Dictionary } from "@/lib/i18n/format";

/**
 * One row of the team list plus its actions.
 *
 * Client-side for the menu and the confirmation dialog; every action is a Server
 * Action, so the mutations and their revalidation stay on the server. The member
 * data itself is a prop — the list is fetched by the Server Component page.
 */
export function MemberRow({
    member,
    dict,
}: {
    member: MemberResponse;
    dict: Dictionary;
}) {
    const t = dict.dashboard.team;
    const [isPending, startTransition] = useTransition();
    const [isRemoveOpen, setIsRemoveOpen] = useState(false);

    const getInitials = (name: string | null) => {
        if (!name) return "?";
        return name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
    };

    const nextRole = member.role === "admin" ? "member" : "admin";

    const changeRole = () => {
        startTransition(async () => {
            const result = await updateMemberRoleAction(member.id, nextRole);
            if (result.error) {
                toast.error(result.error);
                return;
            }
            toast.success(
                interpolate(t.roleChangedTo, {
                    role: nextRole === "admin" ? t.roleAdmin : t.roleMember,
                }),
            );
        });
    };

    const remove = () => {
        startTransition(async () => {
            const result = await removeMemberAction(member.id);
            if (result.error) {
                toast.error(result.error);
                return;
            }
            toast.success(t.memberRemoved);
            setIsRemoveOpen(false);
        });
    };

    return (
        <>
            <div className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
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
                                {member.user.name || t.unnamed}
                            </p>
                            {member.role === "admin" && (
                                <Badge variant="secondary" className="text-xs">
                                    <Crown className="mr-1 h-3 w-3" />
                                    {t.roleAdmin}
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
                            {t.joined}{" "}
                            {new Date(member.createdAt).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                            })}
                        </div>
                    </div>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={isPending}>
                                {isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <MoreHorizontal className="h-4 w-4" />
                                )}
                                <span className="sr-only">{t.openMenu}</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                                <a href={`mailto:${member.user.email}`}>
                                    <Mail className="mr-2 h-4 w-4" />
                                    {t.sendEmail}
                                </a>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={changeRole}>
                                <Shield className="mr-2 h-4 w-4" />
                                {nextRole === "admin"
                                    ? t.changeToAdmin
                                    : t.changeToMember}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setIsRemoveOpen(true)}
                            >
                                <UserMinus className="mr-2 h-4 w-4" />
                                {t.remove}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            <AlertDialog open={isRemoveOpen} onOpenChange={setIsRemoveOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t.removeMemberTitle}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {interpolate(t.removeMemberWarning, {
                                name: member.user.name || member.user.email,
                            })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{dict.common.cancel}</AlertDialogCancel>
                        <AlertDialogAction onClick={remove} disabled={isPending}>
                            {isPending && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            {t.remove}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
