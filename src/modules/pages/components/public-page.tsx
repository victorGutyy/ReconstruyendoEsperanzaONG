import { RichText } from "@/components/rich-text/rich-text";

import type { PublicPage } from "../public";

const DAY = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "America/Bogota",
});

/**
 * The text of a fixed page, or a neutral note while it is not published: the
 * site never shows a [PENDIENTE: …] marker (decision 8.5).
 */
export function PublicPageBody({
  page,
  legal = false,
  preparing = "Estamos preparando esta sección.",
}: {
  page: PublicPage | null;
  legal?: boolean;
  preparing?: string;
}) {
  if (!page) {
    return <p className="mt-6 rounded-sm border bg-card p-5 text-ink-muted">{preparing}</p>;
  }
  return (
    <>
      {legal && page.version ? (
        <p className="mt-2 text-sm text-ink-muted">
          Versión {page.version} · vigente desde el{" "}
          <time dateTime={page.publishedAt}>{DAY.format(new Date(page.publishedAt))}</time>
        </p>
      ) : null}
      {page.body ? <RichText doc={page.body} className="mt-6" /> : null}
    </>
  );
}
