import type { Metadata } from "next";
import Link from "next/link";

import { LOGIN_PATH } from "@/lib/auth/rules";
import { RecoveryForm } from "@/modules/auth/components/recovery-form";

export const metadata: Metadata = { title: "Recuperar contraseña" };

export default async function RecoveryPage({ searchParams }: PageProps<"/admin/recuperar">) {
  const { enlace } = await searchParams;

  return (
    <>
      <h1 className="mb-1 font-serif text-2xl font-semibold text-green-900">
        ¿Olvidaste tu contraseña?
      </h1>
      <p className="mb-6 text-sm text-ink-muted">
        Escribe el correo de tu cuenta y te enviaremos un enlace para crear una nueva.
      </p>

      {enlace === "invalido" ? (
        <p role="alert" className="mb-5 rounded-md bg-paper-2 p-3 text-sm text-ink">
          El enlace venció o ya se usó. Pide uno nuevo.
        </p>
      ) : null}

      <RecoveryForm />

      <p className="mt-6 text-center text-sm">
        <Link href={LOGIN_PATH} className="font-medium text-green-700 underline underline-offset-4">
          Volver a entrar
        </Link>
      </p>
    </>
  );
}
