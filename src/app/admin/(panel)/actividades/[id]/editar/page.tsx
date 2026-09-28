import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { authorizePage } from "@/lib/auth/guard";
import { hasPermission } from "@/lib/auth/rules";
import { BasicsForm } from "@/modules/activities/components/basics-form";
import { PhotosStep } from "@/modules/activities/components/photos-step";
import { WizardSteps } from "@/modules/activities/components/wizard-steps";
import { getActivityForWizard, listBasicsOptions } from "@/modules/activities/queries";
import {
  displayStatus,
  fromBogotaInstant,
  parseStep,
  STATUS_LABELS,
} from "@/modules/activities/schema";
import { getMediaCards } from "@/modules/media";
import { NoPermission } from "@/modules/panel/components/no-permission";

export const metadata: Metadata = { title: "Editar actividad" };

export default async function EditActivityPage({
  params,
  searchParams,
}: PageProps<"/admin/actividades/[id]/editar">) {
  const authorized = await authorizePage("content.read");
  if (!authorized) return <NoPermission reason="Tu rol no permite ver el contenido." />;

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const activity = await getActivityForWizard(id);
  if (!activity) notFound();

  const step = parseStep((await searchParams).paso);
  const { profile, user } = authorized;
  // Mirrors the RLS: the database decides for real when saving
  const canEdit =
    !activity.inTrash &&
    (hasPermission(profile, "content.update_any") ||
      (hasPermission(profile, "content.update_own") &&
        activity.createdBy === user.id &&
        (activity.status === "draft" || activity.status === "review")));

  const status = STATUS_LABELS[displayStatus(activity.status, activity.publishedAt)];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/admin/actividades" className="font-medium text-green-700 underline">
        Volver a actividades
      </Link>
      <p className="mt-4 text-xs font-semibold tracking-[0.12em] text-gold-700 uppercase">
        Actividad · {status}
      </p>
      <h1 className="mt-2 font-serif text-3xl font-semibold text-green-900">{activity.title}</h1>

      {!canEdit ? (
        <p role="status" className="mt-6 rounded-lg border bg-card p-5 text-ink-muted">
          {activity.inTrash
            ? "Esta actividad está en la papelera."
            : "No puedes editar esta actividad: ya fue publicada o la creó otra persona. Un Editor o Administrador puede hacerlo."}
        </p>
      ) : (
        <>
          <WizardSteps current={step} activityId={activity.id} />
          <div className="mt-6 rounded-lg border bg-card p-5">
            {step === 1 ? (
              <StepBasics activity={activity} />
            ) : step === 2 ? (
              <StepPhotos activity={activity} />
            ) : (
              <p className="text-ink-muted">
                Este paso llega en la próxima actualización (personas en las fotos, revisar y
                publicar). Mientras tanto la actividad queda guardada como borrador.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

async function StepBasics({
  activity,
}: {
  activity: NonNullable<Awaited<ReturnType<typeof getActivityForWizard>>>;
}) {
  const { places, categories } = await listBasicsOptions();
  const start = fromBogotaInstant(activity.startsAt);
  return (
    <BasicsForm
      activityId={activity.id}
      serverUpdatedAt={activity.updatedAt}
      initial={{
        title: activity.title,
        date: start.date,
        startTime: start.time,
        endTime: activity.endsAt ? fromBogotaInstant(activity.endsAt).time : "",
        placeId: activity.placeId ?? "",
        categoryId: activity.categoryId ?? "",
        summary: activity.summary ?? "",
        body: activity.body,
      }}
      places={places}
      categories={categories}
    />
  );
}

async function StepPhotos({
  activity,
}: {
  activity: NonNullable<Awaited<ReturnType<typeof getActivityForWizard>>>;
}) {
  const cards = await getMediaCards(activity.photos.map((photo) => photo.mediaId));
  const byId = new Map(cards.map((card) => [card.id, card]));
  return (
    <PhotosStep
      activityId={activity.id}
      coverMediaId={activity.coverMediaId}
      photos={activity.photos.map((photo) => ({
        mediaId: photo.mediaId,
        altText: photo.altText,
        thumbnailUrl: byId.get(photo.mediaId)?.thumbnailUrl ?? null,
        processing: photo.processingStatus !== "ready",
      }))}
    />
  );
}
