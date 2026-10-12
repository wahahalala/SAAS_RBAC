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

const features = [
    {
        icon: Shield,
        title: "Enterprise Security",
        description: "Bank-grade encryption and SOC 2 compliant infrastructure to keep your data safe.",
    },
    {
        icon: Zap,
        title: "Lightning Fast",
        description: "Optimized performance with edge computing and global CDN for instant response times.",
    },
    {
        icon: Users,
        title: "Team Collaboration",
        description: "Built-in tools for seamless team collaboration with role-based access control.",
    },
    {
        icon: BarChart3,
        title: "Advanced Analytics",
        description: "Real-time insights and comprehensive dashboards to track your success.",
    },
    {
        icon: Lock,
        title: "SSO & OAuth",
        description: "Support for Google, GitHub, and enterprise SSO providers out of the box.",
    },
    {
        icon: Globe,
        title: "Multi-Tenancy",
        description: "Complete organization management with membership and billing per workspace.",
    },
];

const plans = [
    { name: "Free", price: 0, features: ["3 team members", "5 GB storage", "Basic analytics"] },
    { name: "Pro", price: 29, features: ["Unlimited members", "100 GB storage", "Advanced analytics", "SSO"], popular: true },
    { name: "Enterprise", price: 99, features: ["Everything in Pro", "Unlimited storage", "Dedicated support", "SLA"] },
];

export default function HomePage() {
    return (
        <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
            {/* Navigation */}
            <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="container flex h-16 items-center justify-between mx-auto px-4">
                    <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
                            S
                        </div>
                        <span className="font-semibold text-lg">SaaS Template</span>
                    </div>
                    <nav className="hidden md:flex items-center gap-6 text-sm">
                        <Link href="#features" className="text-muted-foreground hover:text-foreground transition-colors">
                            Features
                        </Link>
                        <Link href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors">
                            Pricing
                        </Link>
                        <Link href="/docs" className="text-muted-foreground hover:text-foreground transition-colors">
                            Docs
                        </Link>
                    </nav>
                    <div className="flex items-center gap-4">
                        <Link href="/login">
                            <Button variant="ghost">Sign In</Button>
                        </Link>
                        <Link href="/register">
                            <Button>Get Started</Button>
                        </Link>
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <section className="container mx-auto px-4 py-24 md:py-32 text-center">
                <div className="inline-flex items-center rounded-full border px-3 py-1 text-sm mb-6 bg-muted">
                    <span className="mr-2">🚀</span>
                    <span>Now available in beta</span>
                </div>
                <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight max-w-4xl mx-auto mb-6">
                    Build your SaaS{" "}
                    <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                        faster than ever
                    </span>
                </h1>
                <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
                    A production-ready SaaS template with authentication, multi-tenancy, billing,
                    and a beautiful UI. Start building your product today, not your infrastructure.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <Link href="/register">
                        <Button size="lg" className="gap-2">
                            Start Building Free
                            <ArrowRight className="h-4 w-4" />
                        </Button>
                    </Link>
                    <Link href="/docs">
                        <Button size="lg" variant="outline">
                            View Documentation
                        </Button>
                    </Link>
                </div>
                <p className="text-sm text-muted-foreground mt-4">
                    No credit card required • Free forever plan • Setup in 5 minutes
                </p>
            </section>

            {/* Features Section */}
            <section id="features" className="container mx-auto px-4 py-24">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-4xl font-bold mb-4">
                        Everything you need to build your SaaS
                    </h2>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        Skip months of development with our pre-built features and focus on what makes your product unique.
                    </p>
                </div>
                <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                    {features.map((feature) => (
                        <div
                            key={feature.title}
                            className="group relative rounded-2xl border p-6 bg-card hover:border-primary/50 hover:shadow-lg transition-all duration-300"
                        >
                            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                <feature.icon className="h-6 w-6" />
                            </div>
                            <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                            <p className="text-muted-foreground">{feature.description}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Pricing Section */}
            <section id="pricing" className="container mx-auto px-4 py-24">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-4xl font-bold mb-4">
                        Simple, transparent pricing
                    </h2>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        Choose the perfect plan for your needs. Upgrade or downgrade at any time.
                    </p>
                </div>
                <div className="grid gap-8 md:grid-cols-3 max-w-5xl mx-auto">
                    {plans.map((plan) => (
                        <div
                            key={plan.name}
                            className={`relative rounded-2xl border p-8 ${plan.popular
                                    ? "border-primary shadow-lg shadow-primary/10 scale-105"
                                    : "bg-card"
                                }`}
                        >
                            {plan.popular && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                    <span className="inline-flex items-center rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                                        Most Popular
                                    </span>
                                </div>
                            )}
                            <div className="mb-6">
                                <h3 className="text-xl font-semibold mb-2">{plan.name}</h3>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-4xl font-bold">${plan.price}</span>
                                    {plan.price > 0 && <span className="text-muted-foreground">/month</span>}
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
                                    variant={plan.popular ? "default" : "outline"}
                                >
                                    Get Started
                                </Button>
                            </Link>
                        </div>
                    ))}
                </div>
            </section>

            {/* CTA Section */}
            <section className="container mx-auto px-4 py-24">
                <div className="rounded-3xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border p-8 md:p-16 text-center">
                    <h2 className="text-3xl md:text-4xl font-bold mb-4">
                        Ready to get started?
                    </h2>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
                        Join thousands of developers who are building their SaaS products faster with our template.
                    </p>
                    <Link href="/register">
                        <Button size="lg" className="gap-2">
                            Start Building Today
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
                            <span className="font-semibold">SaaS Template</span>
                        </div>
                        <nav className="flex items-center gap-6 text-sm text-muted-foreground">
                            <Link href="/privacy" className="hover:text-foreground transition-colors">
                                Privacy
                            </Link>
                            <Link href="/terms" className="hover:text-foreground transition-colors">
                                Terms
                            </Link>
                            <Link href="/docs" className="hover:text-foreground transition-colors">
                                Docs
                            </Link>
                        </nav>
                        <p className="text-sm text-muted-foreground">
                            © {new Date().getFullYear()} SaaS Template. All rights reserved.
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
