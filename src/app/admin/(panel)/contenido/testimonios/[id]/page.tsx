import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { authorizePage } from "@/lib/auth/guard";
import { hasPermission } from "@/lib/auth/rules";
import { CONSENT_STATUS_LABELS, getPersonConsent } from "@/modules/consents";
import { getContentCover, listOwnerOptions } from "@/modules/content";
import {
  ContentReview,
  CoverField,
  ownerValue,
  ReviewNote,
  statusLabel,
  StatusActions,
} from "@/modules/content/client";
import { NoPermission } from "@/modules/panel/components/no-permission";
import {
  publishTestimonial,
  setTestimonialPhoto,
  submitTestimonial,
} from "@/modules/testimonials/actions";
import { TestimonialEditor } from "@/modules/testimonials/components/testimonial-editor";
import { getTestimonial } from "@/modules/testimonials/queries";
import { reviewTestimonial, TESTIMONIALS_PATH } from "@/modules/testimonials/schema";

export const metadata: Metadata = { title: "Editar testimonio" };

export default async function EditTestimonialPage({
  params,
}: PageProps<"/admin/contenido/testimonios/[id]">) {
  const authorized = await authorizePage("consent.manage");
  if (!authorized || !hasPermission(authorized.profile, "content.read")) {
    return <NoPermission reason="Los testimonios los gestiona quien maneja las autorizaciones." />;
  }

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const testimonial = await getTestimonial(id);
  if (!testimonial) notFound();

  const { profile, user } = authorized;
  const publisher = hasPermission(profile, "content.publish");
  // Mirrors the RLS: the database decides for real when saving
  const canEdit =
    !testimonial.inTrash &&
    (hasPermission(profile, "content.update_any") ||
      (hasPermission(profile, "content.update_own") &&
        testimonial.createdBy === user.id &&
        (testimonial.status === "draft" || testimonial.status === "review")));

  const [consent, cover, owners] = await Promise.all([
    getPersonConsent(testimonial.consentId),
    getContentCover(testimonial.coverMediaId),
    listOwnerOptions({ activityId: testimonial.activityId, projectId: testimonial.projectId }),
  ]);
  const consentUsable = consent?.status === "active" && !consent.isMinor;
  const review = reviewTestimonial(
    { consentUsable, coverIssues: cover?.issues ?? null },
    publisher,
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link href={TESTIMONIALS_PATH} className="font-medium text-green-700 underline">
        Volver a testimonios
      </Link>
      <p className="mt-4 text-xs font-semibold tracking-[0.12em] text-gold-700 uppercase">
        Testimonio · {statusLabel("testimonial", testimonial.status, testimonial.publishedAt)}
      </p>
      <h1 className="mt-2 font-serif text-3xl font-semibold text-green-900">
        {testimonial.authorName}
      </h1>

      {publisher && !testimonial.inTrash ? (
        <div className="mt-6">
          <StatusActions type="testimonial" id={testimonial.id} status={testimonial.status} />
        </div>
      ) : null}

      {testimonial.reviewNote && testimonial.status === "draft" ? (
        <ReviewNote note={testimonial.reviewNote} />
      ) : null}

      {!consentUsable ? (
        <section
          aria-labelledby="consent-gone-title"
          className="mt-6 rounded-lg border-2 border-danger/60 bg-card p-4"
        >
          <h2 id="consent-gone-title" className="font-semibold text-green-900">
            Autorización{" "}
            {consent ? CONSENT_STATUS_LABELS[consent.status].toLowerCase() : "no disponible"}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            {testimonial.status === "published"
              ? "El testimonio ya no se muestra en el sitio ni su foto. Vuelve a verse cuando tenga una autorización vigente."
              : "No se puede publicar hasta que tenga una autorización vigente."}
          </p>
        </section>
      ) : null}

      {!canEdit ? (
        <p role="status" className="mt-6 rounded-lg border bg-card p-5 text-ink-muted">
          {testimonial.inTrash
            ? "Este testimonio está en la papelera."
            : "No puedes editar este testimonio: ya fue publicado o lo registró otra persona."}
        </p>
      ) : (
        <div className="mt-6 grid gap-6">
          <div className="rounded-lg border bg-card p-5">
            <TestimonialEditor
              testimonialId={testimonial.id}
              serverUpdatedAt={testimonial.updatedAt}
              initial={{
                quote: testimonial.quote,
                authorName: testimonial.authorName,
                authorContext: testimonial.authorContext ?? "",
                consentId: testimonial.consentId,
                owner: ownerValue(testimonial.activityId, testimonial.projectId),
              }}
              initialConsent={consent ? { id: consent.id, subjectName: consent.subjectName } : null}
              owners={owners}
            />
          </div>
          <div className="rounded-lg border bg-card p-5">
            <CoverField contentId={testimonial.id} cover={cover} setCover={setTestimonialPhoto} />
            <p className="mt-2 text-sm text-ink-muted">
              Opcional: la foto de la persona. Como toda foto con personas, necesita su autorización
              vinculada para publicarse.
            </p>
          </div>
          <div className="rounded-lg border bg-card p-5">
            <ContentReview
              type="testimonial"
              contentId={testimonial.id}
              items={review.items}
              publisher={publisher}
              status={testimonial.status}
              submit={submitTestimonial}
              publish={publishTestimonial}
            />
          </div>
        </div>
      )}
    </div>
  );
}
