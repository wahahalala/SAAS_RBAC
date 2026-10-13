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
import { logoutAction } from "@/app/actions/auth";
import type { Dictionary } from "@/lib/i18n/format";

/**
 * Entries carry dictionary keys (resolved at render), so the same tables serve
 * every locale — see the sidebar for the same pattern.
 */
const navigationItems = [
    { icon: LayoutDashboard, labelKey: "dashboard", href: "/dashboard", shortcut: "D" },
    { icon: Users, labelKey: "team", href: "/dashboard/team", shortcut: "T" },
    { icon: Building2, labelKey: "organization", href: "/dashboard/organization", shortcut: "O" },
    { icon: CreditCard, labelKey: "billing", href: "/dashboard/billing", shortcut: "B" },
    { icon: Settings, labelKey: "settings", href: "/dashboard/settings", shortcut: "S" },
] as const;

const quickActions = [
    { icon: User, titleKey: "profile", descriptionKey: "profileDescription" },
    { icon: FileText, titleKey: "documentation", descriptionKey: "documentationDescription" },
    { icon: HelpCircle, titleKey: "help", descriptionKey: "helpDescription" },
] as const;

const themeOptions = [
    { icon: Sun, theme: "light", labelKey: "light" },
    { icon: Moon, theme: "dark", labelKey: "dark" },
    { icon: Laptop, theme: "system", labelKey: "system" },
] as const;

export function CommandPalette({
    dict,
    nav,
}: {
    dict: Dictionary["dashboard"]["commandPalette"];
    /** Sidebar nav labels are shared with this palette, so they are passed in. */
    nav: Dictionary["dashboard"]["nav"];
}) {
    const t = dict;
    const [open, setOpen] = useState(false);
    const router = useRouter();
    const { setTheme, theme } = useTheme();

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
                <span className="hidden md:inline">{t.trigger}</span>
                <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 md:flex">
                    <Command className="h-3 w-3" />K
                </kbd>
            </button>

            <CommandDialog open={open} onOpenChange={setOpen}>
                <CommandInput placeholder={t.placeholder} />
                <CommandList>
                    <CommandEmpty>{t.empty}</CommandEmpty>

                    {/* Navigation */}
                    <CommandGroup heading={t.navigation}>
                        {navigationItems.map((item) => (
                            <CommandItem
                                key={item.href}
                                onSelect={() => runCommand(() => router.push(item.href))}
                            >
                                <item.icon className="mr-2 h-4 w-4" />
                                <span>{nav[item.labelKey]}</span>
                                <CommandShortcut>⌘{item.shortcut}</CommandShortcut>
                            </CommandItem>
                        ))}
                    </CommandGroup>

                    <CommandSeparator />

                    {/* Quick Actions */}
                    <CommandGroup heading={t.quickActions}>
                        {quickActions.map((action) => (
                            <CommandItem key={action.titleKey}>
                                <action.icon className="mr-2 h-4 w-4" />
                                <span>{t[action.titleKey]}</span>
                                <span className="ml-auto text-xs text-muted-foreground">
                                    {t[action.descriptionKey]}
                                </span>
                            </CommandItem>
                        ))}
                    </CommandGroup>

                    <CommandSeparator />

                    {/* Theme */}
                    <CommandGroup heading={t.theme}>
                        {themeOptions.map((option) => (
                            <CommandItem
                                key={option.theme}
                                onSelect={() => runCommand(() => setTheme(option.theme))}
                            >
                                <option.icon className="mr-2 h-4 w-4" />
                                <span>{t[option.labelKey]}</span>
                                {theme === option.theme && (
                                    <span className="ml-auto text-xs text-muted-foreground">
                                        {t.active}
                                    </span>
                                )}
                            </CommandItem>
                        ))}
                    </CommandGroup>

                    <CommandSeparator />

                    {/* Account */}
                    <CommandGroup heading={t.account}>
                        <CommandItem
                            onSelect={() => runCommand(() => logoutAction().then((r) => { if (r?.redirectTo) window.location.href = r.redirectTo; }))}
                            className="text-destructive"
                        >
                            <LogOut className="mr-2 h-4 w-4" />
                            <span>{t.logOut}</span>
                        </CommandItem>
                    </CommandGroup>
                </CommandList>
            </CommandDialog>
        </>
    );
}
