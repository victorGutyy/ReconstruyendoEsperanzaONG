import type { Metadata } from "next";

import { safeNextPath } from "@/lib/auth/rules";
import { LoginForm } from "@/modules/auth/components/login-form";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: PageProps<"/admin/login">) {
  const { next } = await searchParams;
  const safeNext = safeNextPath(typeof next === "string" ? next : null);

  return (
    <>
      <h1 className="mb-1 font-serif text-2xl font-semibold text-green-900">Entrar al panel</h1>
      <p className="mb-6 text-sm text-ink-muted">
        Solo para el equipo de la organización. Las cuentas se crean por invitación.
      </p>
      <LoginForm next={safeNext} />
    </>
  );
}
