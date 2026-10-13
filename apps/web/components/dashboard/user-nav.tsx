"use client";

import Link from "next/link";
import { Settings, LogOut, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTransition } from "react";
import { logoutAction } from "@/app/actions/auth";
import type { Dictionary } from "@/lib/i18n/format";
import type { UserResponse } from "@saas/shared-types";

/**
 * User menu.
 *
 * Interaction only: the user is passed in from the Server Component layout, and
 * signing out runs a Server Action (which clears the cookie server-side).
 */
export function UserNav({
    user,
    dict,
}: {
    user: UserResponse | null;
    dict: Dictionary["dashboard"]["userMenu"];
}) {
    const [isPending, startTransition] = useTransition();

    const getInitials = (name: string | null) => {
        if (!name) return "U";
        return name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                        <AvatarImage src={user?.image || undefined} alt={user?.name || ""} />
                        <AvatarFallback>{getInitials(user?.name || null)}</AvatarFallback>
                    </Avatar>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{user?.name || "User"}</p>
                        <p className="text-xs leading-none text-muted-foreground">
                            {user?.email}
                        </p>
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                    <Link href="/dashboard/settings">
                        <User className="mr-2 h-4 w-4" />
                        {dict.profile}
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                    <Link href="/dashboard/settings">
                        <Settings className="mr-2 h-4 w-4" />
                        {dict.settings}
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    disabled={isPending}
                    onClick={() =>
                        startTransition(() => {
                            void logoutAction().then((result) => {
                                if (result?.redirectTo) window.location.href = result.redirectTo;
                            });
                        })
                    }
                    className="text-destructive focus:text-destructive"
                >
                    <LogOut className="mr-2 h-4 w-4" />
                    {dict.logOut}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
