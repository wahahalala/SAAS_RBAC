import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
    ArrowRight,
    Shield,
    Zap,
    Users,
    BarChart3,
    Lock,
    Globe,
    Check
} from "lucide-react";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/locale-cookie";

/**
 * Feature/pricing tables carry DICTIONARY KEYS plus the values that do not
 * translate (icons, prices), so the layout stays in code and only the copy comes
 * from the dictionary.
 */
const featureKeys = [
    { icon: Shield, key: "security" },
    { icon: Zap, key: "fast" },
    { icon: Users, key: "collaboration" },
    { icon: BarChart3, key: "analytics" },
    { icon: Lock, key: "sso" },
    { icon: Globe, key: "multiTenancy" },
] as const;

const planKeys: ReadonlyArray<{
    key: "free" | "pro" | "enterprise";
    price: number;
    popular?: boolean;
}> = [
    { key: "free", price: 0 },
    { key: "pro", price: 29, popular: true },
    { key: "enterprise", price: 99 },
];

export default async function HomePage() {
    const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
    const t = dict.landing;
    return (
        <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
            {/* Navigation */}
            <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="container flex h-16 items-center justify-between mx-auto px-4">
                    <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
                            S
                        </div>
                        <span className="font-semibold text-lg">{dict.common.appName}</span>
                    </div>
                    <nav className="hidden md:flex items-center gap-6 text-sm">
                        <Link href="#features" className="text-muted-foreground hover:text-foreground transition-colors">
                            {t.nav.features}
                        </Link>
                        <Link href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors">
                            {t.nav.pricing}
                        </Link>
                        <Link href="/docs" className="text-muted-foreground hover:text-foreground transition-colors">
                            {t.nav.docs}
                        </Link>
                    </nav>
                    <div className="flex items-center gap-2">
                        <LanguageSwitcher
                            currentLocale={locale}
                            label={dict.languageSwitcher.label}
                        />
                        <Link href="/login">
                            <Button variant="ghost">{t.nav.signIn}</Button>
                        </Link>
                        <Link href="/register">
                            <Button>{t.nav.getStarted}</Button>
                        </Link>
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <section className="container mx-auto px-4 py-24 md:py-32 text-center">
                <div className="inline-flex items-center rounded-full border px-3 py-1 text-sm mb-6 bg-muted">
                    <span className="mr-2">🚀</span>
                    <span>{t.hero.badge}</span>
                </div>
                <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight max-w-4xl mx-auto mb-6">
                    {t.hero.titleStart}{" "}
                    <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                        {t.hero.titleHighlight}
                    </span>
                </h1>
                <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
                    {t.hero.subtitle}
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <Link href="/register">
                        <Button size="lg" className="gap-2">
                            {t.hero.ctaPrimary}
                            <ArrowRight className="h-4 w-4" />
                        </Button>
                    </Link>
                    <Link href="/docs">
                        <Button size="lg" variant="outline">
                            {t.hero.ctaSecondary}
                        </Button>
                    </Link>
                </div>
                <p className="text-sm text-muted-foreground mt-4">
                    {t.hero.note}
                </p>
            </section>

            {/* Features Section */}
            <section id="features" className="container mx-auto px-4 py-24">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-4xl font-bold mb-4">
                        {t.features.heading}
                    </h2>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        {t.features.subtitle}
                    </p>
                </div>
                <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                    {featureKeys.map(({ icon: Icon, key }) => {
                        const item = t.features.items[key];
                        return (
                            <div
                                key={key}
                                className="group relative rounded-2xl border p-6 bg-card hover:border-primary/50 hover:shadow-lg transition-all duration-300"
                            >
                                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                    <Icon className="h-6 w-6" />
                                </div>
                                <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                                <p className="text-muted-foreground">{item.description}</p>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* Pricing Section */}
            <section id="pricing" className="container mx-auto px-4 py-24">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-4xl font-bold mb-4">
                        {t.pricing.heading}
                    </h2>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        {t.pricing.subtitle}
                    </p>
                </div>
                <div className="grid gap-8 md:grid-cols-3 max-w-5xl mx-auto">
                    {planKeys.map(({ key, price, popular }) => {
                        const plan = t.pricing.plans[key];
                        return (
                        <div
                            key={key}
                            className={`relative rounded-2xl border p-8 ${popular
                                    ? "border-primary shadow-lg shadow-primary/10 scale-105"
                                    : "bg-card"
                                }`}
                        >
                            {popular && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                    <span className="inline-flex items-center rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                                        {t.pricing.popular}
                                    </span>
                                </div>
                            )}
                            <div className="mb-6">
                                <h3 className="text-xl font-semibold mb-2">{plan.name}</h3>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-4xl font-bold">${price}</span>
                                    {price > 0 && <span className="text-muted-foreground">{t.pricing.perMonth}</span>}
                                </div>
                            </div>
                            <ul className="space-y-3 mb-8">
                                {plan.features.map((feature) => (
                                    <li key={feature} className="flex items-center gap-3">
                                        <Check className="h-5 w-5 text-emerald-500" />
                                        <span>{feature}</span>
                                    </li>
                                ))}
                            </ul>
                            <Link href="/register">
                                <Button
                                    className="w-full"
                                    variant={popular ? "default" : "outline"}
                                >
                                    {t.pricing.cta}
                                </Button>
                            </Link>
                        </div>
                        );
                    })}
                </div>
            </section>

            {/* CTA Section */}
            <section className="container mx-auto px-4 py-24">
                <div className="rounded-3xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border p-8 md:p-16 text-center">
                    <h2 className="text-3xl md:text-4xl font-bold mb-4">
                        {t.cta.heading}
                    </h2>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
                        {t.cta.subtitle}
                    </p>
                    <Link href="/register">
                        <Button size="lg" className="gap-2">
                            {t.cta.button}
                            <ArrowRight className="h-4 w-4" />
                        </Button>
                    </Link>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t">
                <div className="container mx-auto px-4 py-12">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
                                S
                            </div>
                            <span className="font-semibold">{dict.common.appName}</span>
                        </div>
                        <nav className="flex items-center gap-6 text-sm text-muted-foreground">
                            <Link href="/privacy" className="hover:text-foreground transition-colors">
                                {t.footer.privacy}
                            </Link>
                            <Link href="/terms" className="hover:text-foreground transition-colors">
                                {t.footer.terms}
                            </Link>
                            <Link href="/docs" className="hover:text-foreground transition-colors">
                                {t.footer.docs}
                            </Link>
                        </nav>
                        <p className="text-sm text-muted-foreground">
                            © {new Date().getFullYear()} {dict.common.appName}. {t.footer.rights}
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
