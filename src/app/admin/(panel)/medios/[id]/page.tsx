import { ArrowLeft, CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { authorizePage } from "@/lib/auth/guard";
import { hasPermission } from "@/lib/auth/rules";
import { MediaForm } from "@/modules/media/components/media-form";
import { TrashMediaButton } from "@/modules/media/components/trash-media-button";
import { describeIssues, PEOPLE_LABELS } from "@/modules/media/library";
import { getMediaDetail } from "@/modules/media/queries";
import { mediaIdSchema } from "@/modules/media/schema";
import { NoPermission } from "@/modules/panel/components/no-permission";

export const metadata: Metadata = { title: "Foto" };

const dateFormat = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "America/Bogota",
});

export default async function MediaDetailPage({ params }: PageProps<"/admin/medios/[id]">) {
  const authorized = await authorizePage("media.upload");
  if (!authorized) return <NoPermission reason="Tu rol no permite ver la biblioteca de fotos." />;

  const { id } = await params;
  if (!mediaIdSchema.safeParse(id).success) notFound();

  const media = await getMediaDetail(id, authorized.user.id);
  if (!media) notFound();

  // RLS decides for real; this only hides a form that could not be saved
  const canEdit =
    !media.inTrash && (media.isMine || hasPermission(authorized.profile, "media.update"));
  const issues = describeIssues(media.issues.filter((code) => code !== "in_trash"));

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Link
        href="/admin/medios"
        className="inline-flex min-h-11 items-center gap-2 font-medium text-green-700 underline"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Volver a la biblioteca
      </Link>

      <h1 className="mt-4 font-serif text-3xl font-semibold text-green-900">
        {media.altText ?? "Foto sin descripción"}
      </h1>
      <p className="mt-2 text-sm text-ink-muted">
        Subida{" "}
        {media.isMine
          ? "por ti"
          : media.uploaderName
            ? `por ${media.uploaderName}`
            : "por otra persona del equipo"}{" "}
        el <time dateTime={media.createdAt}>{dateFormat.format(new Date(media.createdAt))}</time>
      </p>

      {media.inTrash ? (
        <p role="status" className="mt-4 rounded-md border border-gold-500 bg-card p-3 text-sm">
          Esta foto está en la papelera.
        </p>
      ) : null}

      <div className="mt-6 grid gap-8 lg:grid-cols-[3fr_2fr]">
        <div className="overflow-hidden rounded-lg border bg-paper-2">
          {media.imageUrl ? (
            // Short-lived signed URL from a private bucket: next/image cannot cache it
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={media.imageUrl}
              alt={media.altText ?? ""}
              width={media.width ?? undefined}
              height={media.height ?? undefined}
              className="h-auto w-full"
            />
          ) : (
            <p className="p-6 text-ink-muted">
              {media.status === "failed"
                ? "No se pudo procesar esta foto."
                : "La foto no terminó de subir."}
            </p>
          )}
        </div>

        <div className="grid content-start gap-6">
          {media.status === "ready" && !media.inTrash ? (
            <section aria-labelledby="pending-title" className="rounded-lg border bg-card p-4">
              <h2 id="pending-title" className="font-serif text-lg font-semibold text-green-900">
                Para publicarla
              </h2>
              {issues.length === 0 ? (
                <p className="mt-2 flex items-center gap-2 font-semibold text-green-700">
                  <CheckCircle2 aria-hidden="true" className="size-5" />
                  Lista para publicar
                </p>
              ) : (
                <ul className="mt-2 grid gap-2 text-sm">
                  {issues.map((issue) => (
                    <li key={issue.code}>
                      <span className="font-semibold text-gold-700">{issue.badge}.</span>{" "}
                      {issue.help}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}

          {canEdit ? (
            <MediaForm
              id={media.id}
              altText={media.altText}
              caption={media.caption}
              credit={media.credit}
              people={media.people}
            />
          ) : (
            <dl className="grid gap-3 text-sm">
              <div>
                <dt className="font-semibold">¿Aparecen personas reconocibles?</dt>
                <dd>{media.people ? PEOPLE_LABELS[media.people] : "Sin clasificar"}</dd>
              </div>
              <div>
                <dt className="font-semibold">Pie de foto</dt>
                <dd>{media.caption ?? "—"}</dd>
              </div>
              <div>
                <dt className="font-semibold">Crédito</dt>
                <dd>{media.credit ?? "—"}</dd>
              </div>
              {media.inTrash ? null : (
                <p className="text-ink-muted">
                  Solo quien subió la foto, un Editor o un Administrador pueden editarla.
                </p>
              )}
            </dl>
          )}

          {canEdit ? <TrashMediaButton id={media.id} /> : null}
        </div>
      </div>
    </div>
  );
}
