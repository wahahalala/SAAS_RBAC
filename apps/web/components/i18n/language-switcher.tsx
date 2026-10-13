"use client";

import { useTransition } from "react";
import { Check, Globe, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setLocaleAction } from "@/app/actions/locale";
import { LOCALES, LOCALE_LABELS, LOCALE_SHORT, type Locale } from "@/lib/i18n/config";

/**
 * Language switcher.
 *
 * A Client Component, but only for INTERACTION: which language is active is
 * decided on the server (the locale cookie) and passed in as a prop, so the
 * button renders the correct label in the initial HTML. Picking a language runs
 * a Server Action, which writes the cookie and revalidates — the server then
 * re-renders every page with the new dictionary. There is no client-side
 * language store, for the same reason there is no client tenant store: a second
 * source of truth would drift from what the server rendered.
 */
export function LanguageSwitcher({
    currentLocale,
    label,
    compact = false,
}: {
    currentLocale: Locale;
    label: string;
    /** Icon-only, for tight headers (e.g. the auth pages). */
    compact?: boolean;
}) {
    const [isPending, startTransition] = useTransition();

    const handleSelect = (locale: Locale) => {
        if (locale === currentLocale) return;
        startTransition(async () => {
            await setLocaleAction(locale);
        });
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size={compact ? "icon" : "sm"}
                    disabled={isPending}
                    aria-label={label}
                    title={label}
                    className={compact ? "h-8 w-8" : "h-8 gap-2 px-2"}
                >
                    {isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Globe className="h-4 w-4" />
                    )}
                    {!compact && (
                        <span className="text-sm font-medium">
                            {LOCALE_SHORT[currentLocale]}
                        </span>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuLabel>{label}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {LOCALES.map((locale) => (
                    <DropdownMenuItem
                        key={locale}
                        disabled={isPending}
                        onClick={() => handleSelect(locale)}
                        // Each option is labelled in its OWN language, which is
                        // what makes the menu usable to someone who cannot read
                        // the current one.
                        lang={locale}
                    >
                        <span className="flex-1">{LOCALE_LABELS[locale]}</span>
                        {locale === currentLocale && (
                            <Check className="ml-2 h-4 w-4 text-primary" />
                        )}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
