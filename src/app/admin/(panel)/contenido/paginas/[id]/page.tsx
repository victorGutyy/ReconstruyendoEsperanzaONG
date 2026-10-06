import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { RichText } from "@/components/rich-text/rich-text";
import { authorizePage } from "@/lib/auth/guard";
import { hasPermission } from "@/lib/auth/rules";
import { ContentReview, ReviewNote, statusLabel, StatusActions } from "@/modules/content/client";
import { publishPage, submitPage } from "@/modules/pages/actions";
import { PageEditor } from "@/modules/pages/components/page-editor";
import { getPage, listPageVersions } from "@/modules/pages/queries";
import { isLegalPage, PAGE_ADDRESSES, PAGES_PATH, reviewPage } from "@/modules/pages/schema";
import { NoPermission } from "@/modules/panel/components/no-permission";

export const metadata: Metadata = { title: "Editar página" };

const dateFormat = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Bogota",
});

export default async function EditPagePage({ params }: PageProps<"/admin/contenido/paginas/[id]">) {
  const authorized = await authorizePage("content.read");
  if (!authorized) return <NoPermission reason="Tu rol no permite ver el contenido." />;

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const page = await getPage(id);
  if (!page) notFound();

  const { profile } = authorized;
  const legal = isLegalPage(page.key);
  // Mirrors the RLS: legal pages for the Administrator, the others for editors
  const canEdit = legal
    ? hasPermission(profile, "settings.manage")
    : hasPermission(profile, "content.update_any");
  const publisher = hasPermission(profile, "content.publish");

  const versions = legal ? await listPageVersions(page.id) : [];
  const review = reviewPage(
    {
      key: page.key,
      title: page.title,
      bodyText: page.bodyText,
      version: page.version,
      publishedVersions: versions.map((version) => version.version),
    },
    publisher,
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link href={PAGES_PATH} className="font-medium text-green-700 underline">
        Volver a páginas
      </Link>
      <p className="mt-4 text-xs font-semibold tracking-[0.12em] text-gold-700 uppercase">
        Página {legal ? "legal" : "institucional"} ·{" "}
        {statusLabel("page", page.status, page.publishedAt)}
      </p>
      <h1 className="mt-2 font-serif text-3xl font-semibold text-green-900">{page.title}</h1>
      <p className="mt-1 text-sm text-ink-muted">En el sitio: {PAGE_ADDRESSES[page.key]}</p>

      {canEdit && publisher ? (
        <div className="mt-6">
          <StatusActions type="page" id={page.id} status={page.status} />
        </div>
      ) : null}

      {page.reviewNote && page.status === "draft" ? <ReviewNote note={page.reviewNote} /> : null}

      {!canEdit ? (
        <section aria-labelledby="read-only-title" className="mt-6 grid gap-4">
          <p
            id="read-only-title"
            role="status"
            className="rounded-lg border bg-card p-4 text-ink-muted"
          >
            {legal
              ? "Solo lectura: las páginas legales las edita el Administrador."
              : "Solo lectura: tu rol no edita las páginas del sitio."}
          </p>
          <div className="rounded-lg border bg-card p-5">
            <RichText doc={page.body} />
          </div>
        </section>
      ) : (
        <div className="mt-6 grid gap-6">
          <div className="rounded-lg border bg-card p-5">
            <PageEditor
              pageId={page.id}
              legal={legal}
              published={page.status === "published"}
              serverUpdatedAt={page.updatedAt}
              initial={{ title: page.title, body: page.body, version: page.version ?? "" }}
            />
          </div>
          <div className="rounded-lg border bg-card p-5">
            <ContentReview
              type="page"
              contentId={page.id}
              items={review.items}
              publisher={publisher}
              status={page.status}
              submit={submitPage}
              publish={publishPage}
            />
          </div>
        </div>
      )}

      {legal ? (
        <section aria-labelledby="versions-title" className="mt-8">
          <h2 id="versions-title" className="mb-4 font-serif text-xl font-semibold text-green-900">
            Versiones publicadas ({versions.length})
          </h2>
          {versions.length === 0 ? (
            <p className="rounded-lg border bg-card p-5 text-ink-muted">
              Todavía no se ha publicado ninguna versión.
            </p>
          ) : (
            <ul aria-label="Versiones publicadas" className="divide-y rounded-lg border bg-card">
              {versions.map((version) => (
                <li key={version.version} className="flex flex-wrap justify-between gap-2 p-4">
                  <span className="font-semibold">Versión {version.version}</span>
                  <span className="text-sm text-ink-muted">
                    {dateFormat.format(new Date(version.publishedAt))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
