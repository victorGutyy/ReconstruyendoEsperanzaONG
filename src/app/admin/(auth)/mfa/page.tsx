import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";

import { ADMIN_HOME, LOGIN_PATH, safeNextPath } from "@/lib/auth/rules";
import { getSession } from "@/lib/auth/session";
import { MfaForm } from "@/modules/auth/components/mfa-form";
import { SignOutButton } from "@/modules/auth/components/sign-out-button";
import { getMfaState } from "@/modules/auth/queries";

export const metadata: Metadata = { title: "Verificación en dos pasos" };

export default async function MfaPage({ searchParams }: PageProps<"/admin/mfa">) {
  const session = await getSession();
  if (!session) redirect(LOGIN_PATH);

  const { next } = await searchParams;
  const safeNext = safeNextPath(typeof next === "string" ? next : null);
  if (session.aal === "aal2") redirect(safeNext ?? ADMIN_HOME);

  const state = await getMfaState();

  return (
    <>
      {state.mode === "enroll" ? (
        <>
          <h1 className="mb-1 font-serif text-2xl font-semibold text-green-900">
            Protege tu cuenta
          </h1>
          <p className="mb-4 text-sm text-ink-muted">
            El panel exige un segundo paso. Instala una app autenticadora (Google Authenticator,
            Microsoft Authenticator o Aegis), escanea este código y escribe los 6 números que te
            muestre.
          </p>
          <Image
            src={state.qrCode}
            alt="Código QR para agregar esta cuenta a tu app autenticadora"
            width={200}
            height={200}
            unoptimized
            className="mx-auto mb-3 rounded-md border bg-white p-2"
          />
          <details className="mb-5 text-sm">
            <summary className="cursor-pointer font-medium text-green-700">
              ¿No puedes escanear? Escribe esta clave
            </summary>
            <code
              data-testid="mfa-secret"
              className="mt-2 block rounded bg-paper-2 p-2 font-mono text-sm break-all"
            >
              {state.secret}
            </code>
          </details>
          <MfaForm factorId={state.factorId} next={safeNext} submitLabel="Activar y entrar" />
        </>
      ) : (
        <>
          <h1 className="mb-1 font-serif text-2xl font-semibold text-green-900">
            Verificación en dos pasos
          </h1>
          <p className="mb-6 text-sm text-ink-muted">
            Escribe el código de 6 números de tu app autenticadora.
          </p>
          <MfaForm factorId={state.factorId} next={safeNext} submitLabel="Entrar" />
        </>
      )}

      <div className="mt-6 flex justify-center border-t pt-4">
        <SignOutButton />
      </div>
    </>
  );
}
