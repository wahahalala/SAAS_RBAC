import { Suspense } from "react";
import { RegisterForm } from "@/components/auth/register-form";

/**
 * Registration page.
 *
 * A Server Component shell around a Client Component form (see login page for
 * the same reasoning).
 */
export default function RegisterPage() {
    return (
        <Suspense fallback={null}>
            <RegisterForm />
        </Suspense>
    );
}
