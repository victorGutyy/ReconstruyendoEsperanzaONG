import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { authorizePage } from "@/lib/auth/guard";
import { CreateConsentForm } from "@/modules/consents/components/create-consent-form";
import { NoPermission } from "@/modules/panel/components/no-permission";

export const metadata: Metadata = { title: "Registrar autorización" };

export default async function NewConsentPage() {
  const authorized = await authorizePage("consent.manage");
  if (!authorized) {
    return (
      <NoPermission reason="Solo las personas con rol de Editor o Administrador manejan las autorizaciones de imagen." />
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link
        href="/admin/autorizaciones"
        className="inline-flex min-h-11 items-center gap-2 font-medium text-green-700 underline"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Volver a autorizaciones
      </Link>
      <h1 className="mt-4 font-serif text-3xl font-semibold text-green-900">
        Registrar autorización
      </h1>
      <p className="mt-2 text-ink-muted">
        Registra solo lo que dice el formato firmado. No se guardan cédula, teléfono, dirección ni
        correo.
      </p>
      <div className="mt-8 rounded-lg border bg-card p-5">
        <CreateConsentForm />
      </div>
    </div>
  );
}
