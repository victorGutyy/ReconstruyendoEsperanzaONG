import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LOGIN_PATH, MFA_PATH, RESET_PASSWORD_PATH } from "@/lib/auth/rules";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { NewPasswordForm } from "@/modules/auth/components/new-password-form";

export const metadata: Metadata = { title: "Crear contraseña nueva" };

// Reached from the recovery or invitation e-mail link (which created the session)
export default async function ResetPasswordPage() {
  const session = await getSession();
  if (!session) redirect(LOGIN_PATH);

  // Someone who already set up the authenticator app must give its code
  // first: Supabase refuses to change the password of an account with MFA
  // from a password-only session ("insufficient_aal"). Found on staging.
  // People who were just invited have no app yet and set the password first.
  const { data } = await (await createClient()).auth.mfa.getAuthenticatorAssuranceLevel();
  const codeFirst = data?.currentLevel === "aal1" && data.nextLevel === "aal2";
  if (codeFirst) redirect(`${MFA_PATH}?next=${encodeURIComponent(RESET_PASSWORD_PATH)}`);

  return (
    <>
      <h1 className="mb-1 font-serif text-2xl font-semibold text-green-900">
        Crea tu contraseña nueva
      </h1>
      <p className="mb-6 text-sm text-ink-muted">
        {session.aal === "aal2"
          ? "Ya confirmaste tu código. Escribe tu contraseña nueva."
          : "Después te pediremos el código de tu app autenticadora. Si es tu primera vez, te ayudaremos a configurarla."}
      </p>
      <NewPasswordForm />
    </>
  );
}
