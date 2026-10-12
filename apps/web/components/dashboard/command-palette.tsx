"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
    CreditCard,
    Laptop,
    Moon,
    Search,
    Settings,
    Sun,
    User,
    Users,
    Building2,
    LayoutDashboard,
    LogOut,
    FileText,
    HelpCircle,
    Command,
} from "lucide-react";
import { useTheme } from "next-themes";
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
    CommandShortcut,
} from "@/components/ui/command";
import { useLogout } from "@/hooks";

const navigationItems = [
    { icon: LayoutDashboard, title: "Dashboard", href: "/dashboard", shortcut: "D" },
    { icon: Users, title: "Team", href: "/dashboard/team", shortcut: "T" },
    { icon: Building2, title: "Organization", href: "/dashboard/organization", shortcut: "O" },
    { icon: CreditCard, title: "Billing", href: "/dashboard/billing", shortcut: "B" },
    { icon: Settings, title: "Settings", href: "/dashboard/settings", shortcut: "S" },
];

const quickActions = [
    { icon: User, title: "Profile", description: "View your profile" },
    { icon: FileText, title: "Documentation", description: "Read the docs" },
    { icon: HelpCircle, title: "Help & Support", description: "Get help" },
];

export function CommandPalette() {
    const [open, setOpen] = useState(false);
    const router = useRouter();
    const { setTheme, theme } = useTheme();
    const logout = useLogout();

    // Toggle with keyboard shortcut
    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setOpen((open) => !open);
            }
        };

        document.addEventListener("keydown", down);
        return () => document.removeEventListener("keydown", down);
    }, []);

    const runCommand = useCallback((command: () => void) => {
        setOpen(false);
        command();
    }, []);

    return (
        <>
            {/* Trigger Button */}
            <button
                onClick={() => setOpen(true)}
                className="inline-flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
                <Search className="h-4 w-4" />
                <span className="hidden md:inline">Search...</span>
                <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 md:flex">
                    <Command className="h-3 w-3" />K
                </kbd>
            </button>

            <CommandDialog open={open} onOpenChange={setOpen}>
                <CommandInput placeholder="Type a command or search..." />
                <CommandList>
                    <CommandEmpty>No results found.</CommandEmpty>

                    {/* Navigation */}
                    <CommandGroup heading="Navigation">
                        {navigationItems.map((item) => (
                            <CommandItem
                                key={item.href}
                                onSelect={() => runCommand(() => router.push(item.href))}
                            >
                                <item.icon className="mr-2 h-4 w-4" />
                                <span>{item.title}</span>
                                <CommandShortcut>⌘{item.shortcut}</CommandShortcut>
                            </CommandItem>
                        ))}
                    </CommandGroup>

                    <CommandSeparator />

                    {/* Quick Actions */}
                    <CommandGroup heading="Quick Actions">
                        {quickActions.map((action) => (
                            <CommandItem key={action.title}>
                                <action.icon className="mr-2 h-4 w-4" />
                                <span>{action.title}</span>
                            </CommandItem>
                        ))}
                    </CommandGroup>

                    <CommandSeparator />

                    {/* Theme */}
                    <CommandGroup heading="Theme">
                        <CommandItem onSelect={() => runCommand(() => setTheme("light"))}>
                            <Sun className="mr-2 h-4 w-4" />
                            <span>Light</span>
                            {theme === "light" && (
                                <span className="ml-auto text-xs text-muted-foreground">Active</span>
                            )}
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => setTheme("dark"))}>
                            <Moon className="mr-2 h-4 w-4" />
                            <span>Dark</span>
                            {theme === "dark" && (
                                <span className="ml-auto text-xs text-muted-foreground">Active</span>
                            )}
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => setTheme("system"))}>
                            <Laptop className="mr-2 h-4 w-4" />
                            <span>System</span>
                            {theme === "system" && (
                                <span className="ml-auto text-xs text-muted-foreground">Active</span>
                            )}
                        </CommandItem>
                    </CommandGroup>

                    <CommandSeparator />

                    {/* Account */}
                    <CommandGroup heading="Account">
                        <CommandItem
                            onSelect={() => runCommand(() => logout.mutate())}
                            className="text-destructive"
                        >
                            <LogOut className="mr-2 h-4 w-4" />
                            <span>Log out</span>
                        </CommandItem>
                    </CommandGroup>
                </CommandList>
            </CommandDialog>
        </>
    );
}
