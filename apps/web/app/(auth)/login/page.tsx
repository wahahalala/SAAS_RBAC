import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";

/**
 * Sign-in page.
 *
 * A Server Component shell: the form itself is a Client Component (it owns input
 * state), but the page is not — which keeps `?redirect=` readable on the server
 * and avoids shipping the route's whole tree to the browser.
 */
export default function LoginPage() {
    return (
        <Suspense fallback={null}>
            <LoginForm />
        </Suspense>
    );
}
