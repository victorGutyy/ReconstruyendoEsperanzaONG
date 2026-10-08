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
import { WizardSteps } from "@/modules/activities/components/wizard-steps";
import {
  getActivityForWizard,
  getPhotosWithIssues,
  listBasicsOptions,
  listTags,
} from "@/modules/activities/queries";
import { reviewActivity } from "@/modules/activities/review";
import { listConsentsForMedia } from "@/modules/consents";
import { fromBogotaInstant, parseStep } from "@/modules/activities/schema";
import { describeIssues, getMediaCards } from "@/modules/media";
import {
  displayStatus,
  ReviewNote,
  STATUS_LABELS,
  StatusActions,
  TagsField,
} from "@/modules/content/client";
import { setActivityTag } from "@/modules/activities/actions";
import { NoPermission } from "@/modules/panel/components/no-permission";
import { TrashContentButton } from "@/modules/trash/client";
import { listProjectOptions } from "@/modules/projects/queries";

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
  const canTrash = hasPermission(profile, "content.delete");
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

      {(hasPermission(profile, "content.publish") || canTrash) && !activity.inTrash ? (
        <div className="mt-6 flex flex-wrap gap-3">
          {hasPermission(profile, "content.publish") ? (
            <StatusActions type="activity" id={activity.id} status={activity.status} />
          ) : null}
          {canTrash ? (
            <TrashContentButton
              type="activity"
              id={activity.id}
              published={activity.status === "published"}
            />
          ) : null}
        </div>
      ) : null}

      {activity.reviewNote && activity.status === "draft" ? (
        <ReviewNote note={activity.reviewNote} />
      ) : null}

      {activity.status === "published" && !activity.inTrash ? (
        <WithdrawnPhotos activity={activity} />
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
  const [{ places, categories }, tags, projects] = await Promise.all([
    listBasicsOptions(),
    listTags(),
    listProjectOptions(activity.projectId),
  ]);
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
          projectId: activity.projectId ?? "",
          body: activity.body,
        }}
        places={places}
        categories={categories}
        projects={projects}
      />
      <TagsField
        tags={tags}
        selected={activity.tagIds}
        save={setActivityTag.bind(null, activity.id)}
      />
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

/**
 * Photos of a published activity that are no longer publishable (e.g. a
 * revoked authorization): they already left the site (step 7.5b).
 */
async function WithdrawnPhotos({ activity }: { activity: WizardActivity }) {
  const withdrawn = (await getPhotosWithIssues(activity)).filter(
    (photo) => photo.issues.length > 0,
  );
  if (withdrawn.length === 0) return null;
  return (
    <section
      aria-labelledby="withdrawn-title"
      className="mt-6 rounded-lg border-2 border-danger/60 bg-card p-4"
    >
      <h2 id="withdrawn-title" className="font-semibold text-green-900">
        Fotos retiradas del sitio ({withdrawn.length})
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        La actividad sigue publicada sin estas fotos. Vuelven solas al sitio cuando se resuelve lo
        que falta.
      </p>
      <ul className="mt-3 grid gap-2">
        {withdrawn.map((photo) => (
          <li
            key={photo.mediaId}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"
          >
            <span>
              <span className="font-medium">{photo.label}</span>
              <span className="block text-sm text-ink-muted">
                {describeIssues(photo.issues)
                  .map((issue) => issue.badge)
                  .join(" · ")}
              </span>
            </span>
            <Link
              href={`/admin/medios/${photo.mediaId}`}
              className="inline-flex min-h-11 items-center text-sm font-medium text-green-700 underline"
            >
              Resolver<span className="sr-only">: {photo.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
