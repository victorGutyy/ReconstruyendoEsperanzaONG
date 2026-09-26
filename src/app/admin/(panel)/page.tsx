import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { isAuthError } from "@/lib/auth/errors";
import { LOGIN_PATH, MFA_PATH } from "@/lib/auth/rules";
import { getCurrentProfile, requireAal2 } from "@/lib/auth/session";
import { SignOutButton } from "@/modules/auth/components/sign-out-button";

export const metadata: Metadata = { title: "Inicio" };

// Provisional panel home: the full shell (menu, dashboard) arrives in step 5.7.
export default async function AdminHomePage() {
  try {
    await requireAal2();
  } catch (error) {
    if (isAuthError(error)) redirect(error.code === "MFA_REQUIRED" ? MFA_PATH : LOGIN_PATH);
    throw error;
  }

  const profile = await getCurrentProfile();

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <p className="text-xs font-semibold tracking-[0.12em] text-gold-700 uppercase">Panel</p>
      <h1 className="mt-2 font-serif text-3xl font-semibold text-green-900">
        Hola, {profile?.fullName ?? "equipo"}
      </h1>
      <p className="mt-4 text-ink-muted">
        Entraste con verificación en dos pasos. El panel completo se construye en los próximos
        pasos.
      </p>
      <div className="mt-8">
        <SignOutButton />
      </div>
    </main>
  );
}
