import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { getLocale } from "@/lib/i18n/locale-cookie";
import { getDictionary } from "@/lib/i18n";

/**
 * Auth shell.
 *
 * Puts the language switcher in the top-right corner of the sign-in and sign-up
 * pages, so a visitor can read the form in their own language BEFORE they have
 * an account — which is exactly when the copy matters most.
 *
 * A Server Component: the active locale comes from the cookie, so the button
 * shows the right state on first paint.
 */
export default async function AuthLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);

    return (
        <div className="relative">
            <div className="absolute right-4 top-4 z-10">
                <LanguageSwitcher
                    currentLocale={locale}
                    label={dict.languageSwitcher.label}
                />
            </div>
            {children}
        </div>
    );
}
