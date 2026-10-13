import { Suspense } from "react";
import { RegisterForm } from "@/components/auth/register-form";
import { getDictionary } from "@/lib/i18n";

/**
 * Registration page.
 *
 * A Server Component shell around a Client Component form (see login page for
 * the same reasoning). The dictionary is resolved on the server from the locale
 * cookie and passed down.
 */
export default async function RegisterPage() {
    const dict = await getDictionary();

    return (
        <Suspense fallback={null}>
            <RegisterForm dict={dict.auth.register} common={dict.auth.login} />
        </Suspense>
    );
}
