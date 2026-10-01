import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { authorizePage } from "@/lib/auth/guard";
import { hasPermission } from "@/lib/auth/rules";
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
import { publishVideo, setVideoCover, submitVideo } from "@/modules/videos/actions";
import { VideoEditor } from "@/modules/videos/components/video-editor";
import { watchUrl } from "@/modules/videos/parse";
import { getVideo } from "@/modules/videos/queries";
import { reviewVideo, VIDEOS_PATH } from "@/modules/videos/schema";

export const metadata: Metadata = { title: "Editar video" };

export default async function EditVideoPage({ params }: PageProps<"/admin/contenido/videos/[id]">) {
  const authorized = await authorizePage("content.read");
  if (!authorized) return <NoPermission reason="Tu rol no permite ver el contenido." />;

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const video = await getVideo(id);
  if (!video) notFound();

  const { profile, user } = authorized;
  const publisher = hasPermission(profile, "content.publish");
  // Mirrors the RLS: the database decides for real when saving
  const canEdit =
    !video.inTrash &&
    (hasPermission(profile, "content.update_any") ||
      (hasPermission(profile, "content.update_own") &&
        video.createdBy === user.id &&
        (video.status === "draft" || video.status === "review")));

  const [cover, owners] = await Promise.all([
    getContentCover(video.coverMediaId),
    listOwnerOptions({ activityId: video.activityId, projectId: video.projectId }),
  ]);
  const review = reviewVideo(cover?.issues ?? null, publisher);
  const coverWithdrawn = video.status === "published" && (cover?.issues.length ?? 0) > 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link href={VIDEOS_PATH} className="font-medium text-green-700 underline">
        Volver a videos
      </Link>
      <p className="mt-4 text-xs font-semibold tracking-[0.12em] text-gold-700 uppercase">
        Video · {statusLabel("video", video.status, video.publishedAt)}
      </p>
      <h1 className="mt-2 font-serif text-3xl font-semibold text-green-900">{video.title}</h1>

      {publisher && !video.inTrash ? (
        <div className="mt-6">
          <StatusActions type="video" id={video.id} status={video.status} />
        </div>
      ) : null}

      {video.reviewNote && video.status === "draft" ? <ReviewNote note={video.reviewNote} /> : null}

      {coverWithdrawn ? (
        <section
          aria-labelledby="withdrawn-title"
          className="mt-6 rounded-lg border-2 border-danger/60 bg-card p-4"
        >
          <h2 id="withdrawn-title" className="font-semibold text-green-900">
            Imagen retirada del sitio
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            El video sigue publicado sin su imagen. Vuelve sola al sitio cuando se resuelve lo que
            falta.
          </p>
          <Link
            href={`/admin/medios/${video.coverMediaId}`}
            className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-green-700 underline"
          >
            Resolver la imagen
          </Link>
        </section>
      ) : null}

      {!canEdit ? (
        <p role="status" className="mt-6 rounded-lg border bg-card p-5 text-ink-muted">
          {video.inTrash
            ? "Este video está en la papelera."
            : "No puedes editar este video: ya fue publicado o lo agregó otra persona. Un Editor o Administrador puede hacerlo."}
        </p>
      ) : (
        <div className="mt-6 grid gap-6">
          <div className="rounded-lg border bg-card p-5">
            <VideoEditor
              videoId={video.id}
              serverUpdatedAt={video.updatedAt}
              initial={{
                title: video.title,
                description: video.description ?? "",
                url: watchUrl(video.provider, video.providerVideoId),
                owner: ownerValue(video.activityId, video.projectId),
              }}
              owners={owners}
            />
          </div>
          <div className="rounded-lg border bg-card p-5">
            <CoverField contentId={video.id} cover={cover} setCover={setVideoCover} />
            <p className="mt-2 text-sm text-ink-muted">
              Opcional: una foto propia de la biblioteca. No usamos las miniaturas de las
              plataformas, para no avisarles quién visita el sitio.
            </p>
          </div>
          <div className="rounded-lg border bg-card p-5">
            <ContentReview
              type="video"
              contentId={video.id}
              items={review.items}
              publisher={publisher}
              status={video.status}
              submit={submitVideo}
              publish={publishVideo}
            />
          </div>
        </div>
      )}
    </div>
  );
}
