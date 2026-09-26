import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LOGIN_PATH } from "@/lib/auth/rules";
import { getSession } from "@/lib/auth/session";
import { NewPasswordForm } from "@/modules/auth/components/new-password-form";

export const metadata: Metadata = { title: "Crear contraseña nueva" };

// Reached from the recovery e-mail link (which created the session)
export default async function ResetPasswordPage() {
  const session = await getSession();
  if (!session) redirect(LOGIN_PATH);

  return (
    <>
      <h1 className="mb-1 font-serif text-2xl font-semibold text-green-900">
        Crea tu contraseña nueva
      </h1>
      <p className="mb-6 text-sm text-ink-muted">
        Después te pediremos el código de tu app autenticadora, como siempre.
      </p>
      <NewPasswordForm />
    </>
  );
}
