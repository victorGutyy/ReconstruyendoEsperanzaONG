import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { authorizePage } from "@/lib/auth/guard";
import { hasPermission } from "@/lib/auth/rules";
import { ContentReview, ReviewNote, statusLabel, StatusActions } from "@/modules/content/client";
import { publishGallery, submitGallery } from "@/modules/galleries/actions";
import { GalleryEditor } from "@/modules/galleries/components/gallery-editor";
import { GalleryPhotos } from "@/modules/galleries/components/gallery-photos";
import { listOwnerOptions } from "@/modules/content";
import { getGallery } from "@/modules/galleries/queries";
import { GALLERIES_PATH, ownerValue, reviewGallery } from "@/modules/galleries/schema";
import { describeIssues } from "@/modules/media";
import { NoPermission } from "@/modules/panel/components/no-permission";
import { TrashContentButton } from "@/modules/trash/client";

export const metadata: Metadata = { title: "Editar galería" };

export default async function EditGalleryPage({
  params,
}: PageProps<"/admin/contenido/galerias/[id]">) {
  const authorized = await authorizePage("content.read");
  if (!authorized) return <NoPermission reason="Tu rol no permite ver el contenido." />;

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const gallery = await getGallery(id);
  if (!gallery) notFound();

  const { profile, user } = authorized;
  const canTrash = hasPermission(profile, "content.delete");
  const publisher = hasPermission(profile, "content.publish");
  // Mirrors the RLS: the database decides for real when saving
  const canEdit =
    !gallery.inTrash &&
    (hasPermission(profile, "content.update_any") ||
      (hasPermission(profile, "content.update_own") &&
        gallery.createdBy === user.id &&
        (gallery.status === "draft" || gallery.status === "review")));

  const owners = await listOwnerOptions({
    activityId: gallery.activityId,
    projectId: gallery.projectId,
  });
  const review = reviewGallery(gallery.photos, publisher);
  const withdrawn =
    gallery.status === "published" ? gallery.photos.filter((photo) => photo.issues.length > 0) : [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link href={GALLERIES_PATH} className="font-medium text-green-700 underline">
        Volver a galerías
      </Link>
      <p className="mt-4 text-xs font-semibold tracking-[0.12em] text-gold-700 uppercase">
        Galería · {statusLabel("gallery", gallery.status, gallery.publishedAt)}
      </p>
      <h1 className="mt-2 font-serif text-3xl font-semibold text-green-900">{gallery.title}</h1>

      {(publisher || canTrash) && !gallery.inTrash ? (
        <div className="mt-6 flex flex-wrap gap-3">
          {publisher ? (
            <StatusActions type="gallery" id={gallery.id} status={gallery.status} />
          ) : null}
          {canTrash ? (
            <TrashContentButton
              type="gallery"
              id={gallery.id}
              published={gallery.status === "published"}
            />
          ) : null}
        </div>
      ) : null}

      {gallery.reviewNote && gallery.status === "draft" ? (
        <ReviewNote note={gallery.reviewNote} />
      ) : null}

      {withdrawn.length > 0 ? (
        <section
          aria-labelledby="withdrawn-title"
          className="mt-6 rounded-lg border-2 border-danger/60 bg-card p-4"
        >
          <h2 id="withdrawn-title" className="font-semibold text-green-900">
            Fotos retiradas del sitio ({withdrawn.length})
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            La galería sigue publicada sin estas fotos. Vuelven solas al sitio cuando se resuelve lo
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
      ) : null}

      {!canEdit ? (
        <p role="status" className="mt-6 rounded-lg border bg-card p-5 text-ink-muted">
          {gallery.inTrash
            ? "Esta galería está en la papelera."
            : "No puedes editar esta galería: ya fue publicada o la creó otra persona. Un Editor o Administrador puede hacerlo."}
        </p>
      ) : (
        <div className="mt-6 grid gap-6">
          <div className="rounded-lg border bg-card p-5">
            <GalleryEditor
              galleryId={gallery.id}
              serverUpdatedAt={gallery.updatedAt}
              initial={{
                title: gallery.title,
                description: gallery.description ?? "",
                owner: ownerValue(gallery.activityId, gallery.projectId),
              }}
              owners={owners}
            />
          </div>
          <div className="rounded-lg border bg-card p-5">
            <GalleryPhotos
              galleryId={gallery.id}
              photos={gallery.photos}
              coverMediaId={gallery.coverMediaId}
            />
          </div>
          <div className="rounded-lg border bg-card p-5">
            <ContentReview
              type="gallery"
              contentId={gallery.id}
              items={review.items}
              publisher={publisher}
              status={gallery.status}
              submit={submitGallery}
              publish={publishGallery}
            />
          </div>
        </div>
      )}
    </div>
  );
}
