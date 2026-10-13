import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { getLocale } from "@/lib/i18n/locale-cookie";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: {
        default: "SaaS Template",
        template: "%s | SaaS Template",
    },
    description: "A modern SaaS template built with Next.js and NestJS",
    keywords: ["SaaS", "Next.js", "NestJS", "React", "TypeScript"],
};

export default async function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    // `lang` must match the rendered copy for screen readers and correct font
    // selection, and it is only knowable on the server (the locale cookie).
    const locale = await getLocale();

    return (
        <html lang={locale} suppressHydrationWarning>
            <body className={inter.className}>
                <ThemeProvider
                    attribute="class"
                    defaultTheme="system"
                    enableSystem
                    disableTransitionOnChange
                >
                    <QueryProvider>{children}</QueryProvider>
                </ThemeProvider>
            </body>
        </html>
    );
}
