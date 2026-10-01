import type { Metadata } from "next";
import Link from "next/link";

import { authorizePage } from "@/lib/auth/guard";
import { hasPermission } from "@/lib/auth/rules";
import { LibraryGrid } from "@/modules/media/components/library-grid";
import { MediaUploader } from "@/modules/media/components/media-uploader";
import { libraryHref, type LibraryFilters, parseLibraryFilters } from "@/modules/media/library";
import { listLibrary } from "@/modules/media/queries";
import { FilterLink } from "@/modules/panel/components/filter-link";
import { NoPermission } from "@/modules/panel/components/no-permission";

export const metadata: Metadata = { title: "Medios" };

export default async function MediaPage({ searchParams }: PageProps<"/admin/medios">) {
  const authorized = await authorizePage("media.upload");

  if (!authorized) {
    return <NoPermission reason="Tu rol no permite subir fotos." />;
  }

  const canSeeTrash = hasPermission(authorized.profile, "media.update");
  const requested = parseLibraryFilters(await searchParams);
  const filters: LibraryFilters = { ...requested, trash: requested.trash && canSeeTrash };
  const library = await listLibrary(filters, authorized.user.id, canSeeTrash);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <p className="text-xs font-semibold tracking-[0.12em] text-gold-700 uppercase">Panel</p>
      <h1 className="mt-2 font-serif text-3xl font-semibold text-green-900">Medios</h1>
      <p className="mt-2 text-ink-muted">
        Las fotos se guardan en privado. Solo se vuelven públicas al publicar un contenido que las
        use y que tenga las autorizaciones necesarias.
      </p>

      <section aria-labelledby="upload-title" className="mt-8">
        <h2 id="upload-title" className="mb-4 font-serif text-xl font-semibold text-green-900">
          Subir fotos
        </h2>
        <MediaUploader />
      </section>

      <section aria-labelledby="library-title" className="mt-10">
        <h2 id="library-title" className="font-serif text-xl font-semibold text-green-900">
          {filters.trash ? "Papelera de fotos" : "Biblioteca"} ({library.total})
        </h2>

        <nav aria-label="Filtros de la biblioteca" className="mt-4 mb-5 flex flex-wrap gap-2">
          <FilterLink
            href={libraryHref(filters, { mine: false, pending: false, trash: false })}
            active={!filters.mine && !filters.pending && !filters.trash}
          >
            Todas
          </FilterLink>
          <FilterLink href={libraryHref(filters, { mine: !filters.mine })} active={filters.mine}>
            Subidas por mí
          </FilterLink>
          <FilterLink
            href={libraryHref(filters, { pending: !filters.pending, trash: false })}
            active={filters.pending}
          >
            Solo con pendientes
          </FilterLink>
          {canSeeTrash ? (
            <FilterLink
              href={libraryHref(filters, { trash: !filters.trash, pending: false })}
              active={filters.trash}
            >
              En la papelera
            </FilterLink>
          ) : null}
        </nav>

        {library.items.length > 0 ? (
          <LibraryGrid items={library.items} />
        ) : (
          <p className="rounded-lg border bg-card p-5 text-ink-muted">
            {filters.pending
              ? "No hay fotos con pendientes."
              : filters.trash
                ? "La papelera está vacía."
                : "Todavía no hay fotos."}
          </p>
        )}

        {library.pageCount > 1 ? (
          <nav aria-label="Páginas" className="mt-6 flex flex-wrap items-center gap-4">
            {filters.page > 1 ? (
              <Link
                href={libraryHref(filters, { page: filters.page - 1 })}
                className="inline-flex min-h-11 items-center font-medium text-green-700 underline"
              >
                Más recientes
              </Link>
            ) : null}
            <span className="text-ink-muted">
              Página {Math.min(filters.page, library.pageCount)} de {library.pageCount}
            </span>
            {filters.page < library.pageCount ? (
              <Link
                href={libraryHref(filters, { page: filters.page + 1 })}
                className="inline-flex min-h-11 items-center font-medium text-green-700 underline"
              >
                Anteriores
              </Link>
            ) : null}
          </nav>
        ) : null}
      </section>
    </div>
  );
}
