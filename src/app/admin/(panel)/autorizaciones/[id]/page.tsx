import { ArrowLeft, FileText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { authorizePage } from "@/lib/auth/guard";
import { EditConsentForm } from "@/modules/consents/components/edit-consent-form";
import { RevokeConsentForm } from "@/modules/consents/components/revoke-consent-form";
import { getConsent } from "@/modules/consents/queries";
import {
  CHANNEL_LABELS,
  consentStatus,
  idSchema,
  MINOR_OPINION_LABELS,
  SIGNER_LABELS,
  STATUS_LABELS,
} from "@/modules/consents/schema";
import { NoPermission } from "@/modules/panel/components/no-permission";

export const metadata: Metadata = { title: "Autorización" };

const dateFormat = new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeZone: "UTC" });
const formatDate = (isoDate: string) => dateFormat.format(new Date(`${isoDate}T00:00:00Z`));
const dateTimeFormat = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "America/Bogota",
});

export default async function ConsentPage({ params }: PageProps<"/admin/autorizaciones/[id]">) {
  const authorized = await authorizePage("consent.manage");
  if (!authorized) {
    return (
      <NoPermission reason="Solo las personas con rol de Editor o Administrador manejan las autorizaciones de imagen." />
    );
  }

  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();
  const consent = await getConsent(id);
  if (!consent) notFound();

  const status = consentStatus(consent);

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
        {consent.subjectName}
      </h1>
      <p
        className={
          status === "active"
            ? "mt-2 font-semibold text-green-700"
            : "mt-2 font-semibold text-danger"
        }
      >
        {STATUS_LABELS[status]}
      </p>

      <dl className="mt-6 grid gap-3 rounded-lg border bg-card p-5 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-semibold">Menor de edad</dt>
          <dd>{consent.isMinor ? "Sí" : "No"}</dd>
        </div>
        {consent.isMinor && consent.minorOpinion ? (
          <div>
            <dt className="font-semibold">Opinión del menor</dt>
            <dd>{MINOR_OPINION_LABELS[consent.minorOpinion]}</dd>
          </div>
        ) : null}
        <div>
          <dt className="font-semibold">Firmó</dt>
          <dd>
            {SIGNER_LABELS[consent.signerType]}
            {consent.signerName ? `: ${consent.signerName}` : ""}
          </dd>
        </div>
        <div>
          <dt className="font-semibold">Fecha de firma</dt>
          <dd>{formatDate(consent.grantedOn)}</dd>
        </div>
        <div>
          <dt className="font-semibold">Válida hasta</dt>
          <dd>
            {consent.validUntil ? formatDate(consent.validUntil) : "Sin fecha de vencimiento"}
          </dd>
        </div>
        <div>
          <dt className="font-semibold">Formato</dt>
          <dd>
            {CHANNEL_LABELS[consent.channel]} · versión {consent.formVersion}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="font-semibold">Qué cubre</dt>
          <dd>{consent.scopeDescription}</dd>
        </div>
        <div>
          <dt className="font-semibold">Fotos vinculadas</dt>
          <dd>{consent.photoCount}</dd>
        </div>
        {consent.revokedAt ? (
          <div className="sm:col-span-2">
            <dt className="font-semibold">Revocación</dt>
            <dd>
              {dateTimeFormat.format(new Date(consent.revokedAt))}. {consent.revocationNote}
            </dd>
          </div>
        ) : null}
      </dl>

      <a
        href={`/admin/autorizaciones/${consent.id}/formato`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex min-h-11 items-center gap-2 font-medium text-green-700 underline"
      >
        <FileText aria-hidden="true" className="size-4" />
        Ver el formato firmado (se abre en otra pestaña; el enlace dura 5 minutos)
      </a>

      {consent.revokedAt ? null : (
        <>
          <section aria-labelledby="edit-title" className="mt-10">
            <h2 id="edit-title" className="mb-4 font-serif text-xl font-semibold text-green-900">
              Corregir datos
            </h2>
            <div className="rounded-lg border bg-card p-5">
              <EditConsentForm
                id={consent.id}
                values={{
                  subjectName: consent.subjectName,
                  isMinor: consent.isMinor,
                  minorOpinion: consent.minorOpinion,
                  signerType: consent.signerType,
                  signerName: consent.signerName,
                  scopeDescription: consent.scopeDescription,
                  grantedOn: consent.grantedOn,
                  validUntil: consent.validUntil,
                  channel: consent.channel,
                  formVersion: consent.formVersion,
                }}
              />
            </div>
          </section>

          <section aria-labelledby="revoke-title" className="mt-10">
            <h2 id="revoke-title" className="mb-4 font-serif text-xl font-semibold text-green-900">
              Revocar
            </h2>
            <RevokeConsentForm id={consent.id} photoCount={consent.photoCount} />
          </section>
        </>
      )}
    </div>
  );
}
