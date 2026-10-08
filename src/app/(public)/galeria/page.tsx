import type { Metadata } from "next";
import Link from "next/link";

import { PublicGalleryCard } from "@/modules/galleries/components/public-gallery-card";
import { listPublicGalleries, PUBLIC_GALLERIES_PATH } from "@/modules/galleries/public";
import { Breadcrumbs, Pagination } from "@/modules/site";

export const metadata: Metadata = {
  title: "Galería",
  description: "Álbumes de fotos de las actividades y proyectos de la organización.",
  alternates: { canonical: PUBLIC_GALLERIES_PATH },
};

const pageHref = (page: number) =>
  page > 1 ? `${PUBLIC_GALLERIES_PATH}?pagina=${page}` : PUBLIC_GALLERIES_PATH;

export default async function GalleriesPage({ searchParams }: PageProps<"/galeria">) {
  const raw = (await searchParams).pagina;
  const requested = Number(Array.isArray(raw) ? raw[0] : raw);
  const page = Number.isInteger(requested) && requested >= 1 && requested <= 1000 ? requested : 1;
  const listing = await listPublicGalleries(page);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Breadcrumbs items={[{ href: "/", label: "Inicio" }, { label: "Galería" }]} />
      <h1 className="mt-4 font-serif text-4xl font-semibold text-green-900 md:text-5xl">Galería</h1>

      {listing.galleries.length === 0 ? (
        <p className="mt-8 rounded-sm border bg-card p-5 text-ink-muted">
          {page > 1 ? (
            <>
              No hay más álbumes.{" "}
              <Link href={PUBLIC_GALLERIES_PATH} className="font-medium text-green-700 underline">
                Volver a la galería
              </Link>
            </>
          ) : (
            "Pronto publicaremos los álbumes de fotos."
          )}
        </p>
      ) : (
        <ul aria-label="Álbumes" className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {listing.galleries.map((gallery) => (
            <li key={gallery.id}>
              <PublicGalleryCard gallery={gallery} />
            </li>
          ))}
        </ul>
      )}

      <Pagination
        label="Páginas de la galería"
        current={page}
        pageCount={listing.pageCount}
        hrefFor={pageHref}
      />
    </div>
  );
}
