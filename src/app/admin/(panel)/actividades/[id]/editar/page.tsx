import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { authorizePage } from "@/lib/auth/guard";
import { hasPermission } from "@/lib/auth/rules";
import { BasicsForm } from "@/modules/activities/components/basics-form";
import { PeopleStep } from "@/modules/activities/components/people-step";
import { PhotosStep } from "@/modules/activities/components/photos-step";
import { ReviewStep } from "@/modules/activities/components/review-step";
import { StatusActions } from "@/modules/activities/components/status-actions";
import { TagsField } from "@/modules/activities/components/tags-field";
import { WizardSteps } from "@/modules/activities/components/wizard-steps";
import {
  getActivityForWizard,
  getPhotosWithIssues,
  listBasicsOptions,
  listTags,
} from "@/modules/activities/queries";
import { reviewActivity } from "@/modules/activities/review";
import { listConsentsForMedia } from "@/modules/consents";
import {
  displayStatus,
  fromBogotaInstant,
  parseStep,
  STATUS_LABELS,
} from "@/modules/activities/schema";
import { getMediaCards } from "@/modules/media";
import { NoPermission } from "@/modules/panel/components/no-permission";

export const metadata: Metadata = { title: "Editar actividad" };

const noteDate = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Bogota",
});

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

      {hasPermission(profile, "content.publish") && !activity.inTrash ? (
        <div className="mt-6">
          <StatusActions activityId={activity.id} status={activity.status} />
        </div>
      ) : null}

      {activity.reviewNote && activity.status === "draft" ? (
        <section
          aria-labelledby="review-note-title"
          className="mt-6 rounded-lg border-2 border-gold-500 bg-card p-4"
        >
          <h2 id="review-note-title" className="font-semibold text-green-900">
            Nota de revisión
            {activity.reviewNote.at
              ? ` · ${noteDate.format(new Date(activity.reviewNote.at))}`
              : ""}
          </h2>
          <p className="mt-1 whitespace-pre-line">{activity.reviewNote.text}</p>
        </section>
      ) : null}

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
            ) : step === 3 ? (
              <StepPeople
                activity={activity}
                canManageConsents={hasPermission(profile, "consent.manage")}
              />
            ) : (
              <StepReview
                activity={activity}
                publisher={hasPermission(profile, "content.publish")}
              />
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
  const [{ places, categories }, tags] = await Promise.all([listBasicsOptions(), listTags()]);
  const start = fromBogotaInstant(activity.startsAt);
  return (
    <div className="grid gap-8">
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
      <TagsField activityId={activity.id} tags={tags} selected={activity.tagIds} />
    </div>
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
        isPublic: photo.isPublic,
      }))}
    />
  );
}

type WizardActivity = NonNullable<Awaited<ReturnType<typeof getActivityForWizard>>>;

async function StepPeople({
  activity,
  canManageConsents,
}: {
  activity: WizardActivity;
  canManageConsents: boolean;
}) {
  const [photos, cards] = await Promise.all([
    getPhotosWithIssues(activity),
    getMediaCards(activity.photos.map((photo) => photo.mediaId)),
  ]);
  const thumbnails = new Map(cards.map((card) => [card.id, card.thumbnailUrl]));
  // Names in authorizations are personal data: only for consent.manage
  const linked = canManageConsents
    ? await Promise.all(photos.map((photo) => listConsentsForMedia(photo.mediaId)))
    : photos.map(() => []);

  return (
    <PeopleStep
      activityId={activity.id}
      canManageConsents={canManageConsents}
      photos={photos.map((photo, index) => ({
        mediaId: photo.mediaId,
        label: photo.label,
        thumbnailUrl: thumbnails.get(photo.mediaId) ?? null,
        people: photo.people,
        issues: photo.issues,
        linked: linked[index] ?? [],
      }))}
    />
  );
}

async function StepReview({
  activity,
  publisher,
}: {
  activity: WizardActivity;
  publisher: boolean;
}) {
  const photos = await getPhotosWithIssues(activity);
  const review = reviewActivity(
    {
      placeId: activity.placeId,
      categoryId: activity.categoryId,
      photos: photos.map((photo) => ({
        mediaId: photo.mediaId,
        label: photo.label,
        processing: photo.processingStatus !== "ready",
        issues: photo.issues,
      })),
    },
    publisher,
  );
  return (
    <ReviewStep
      activityId={activity.id}
      items={review.items}
      publisher={publisher}
      status={activity.status}
    />
  );
}
