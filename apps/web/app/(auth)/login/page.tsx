import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { getDictionary } from "@/lib/i18n";

/**
 * Sign-in page.
 *
 * A Server Component shell: the form itself is a Client Component (it owns input
 * state), but the page is not — which keeps `?redirect=` readable on the server
 * and avoids shipping the route's whole tree to the browser.
 *
 * The translated dictionary is resolved HERE (server-side, from the locale
 * cookie) and handed to the form, so no translation data is fetched on the
 * client.
 */
export default async function LoginPage() {
    const dict = await getDictionary();

    return (
        <Suspense fallback={null}>
            <LoginForm dict={dict.auth.login} />
        </Suspense>
    );
}
