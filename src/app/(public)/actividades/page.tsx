import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { PublicActivityCard } from "@/modules/activities/components/public-activity-card";
import { getActivityFacets, listPublicActivities } from "@/modules/activities/public";
import {
  hasFilters,
  parsePublicFilters,
  PUBLIC_ACTIVITIES_PATH,
  publicActivitiesHref,
} from "@/modules/activities/public-filters";
import { Breadcrumbs } from "@/modules/site";

export const metadata: Metadata = {
  title: "Actividades",
  description: "Las actividades de la organización en Calarcá: las próximas y las ya realizadas.",
  alternates: { canonical: PUBLIC_ACTIVITIES_PATH },
};

const grid = "mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3";

export default async function ActivitiesPage({ searchParams }: PageProps<"/actividades">) {
  const filters = parsePublicFilters(await searchParams);
  const [facets, listing] = await Promise.all([getActivityFacets(), listPublicActivities(filters)]);
  const filtered = hasFilters(filters);
  const nothing = listing.upcoming.length === 0 && listing.past.length === 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Breadcrumbs items={[{ href: "/", label: "Inicio" }, { label: "Actividades" }]} />
      <h1 className="mt-4 font-serif text-4xl font-semibold text-green-900 md:text-5xl">
        Actividades
      </h1>

      {facets.years.length > 0 ? (
        // A plain form: works without JavaScript and the result has its own address
        <form
          method="get"
          action={PUBLIC_ACTIVITIES_PATH}
          aria-label="Filtrar actividades"
          className="mt-6 grid gap-4 rounded-sm border bg-card p-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end"
        >
          <div className="space-y-2">
            <Label htmlFor="filter-year">Año</Label>
            <NativeSelect id="filter-year" name="ano" defaultValue={filters.year ?? ""}>
              <option value="">Todos</option>
              {facets.years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor="filter-category">Categoría</Label>
            <NativeSelect
              id="filter-category"
              name="categoria"
              defaultValue={filters.category ?? ""}
            >
              <option value="">Todas</option>
              {facets.categories.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor="filter-place">Lugar</Label>
            <NativeSelect id="filter-place" name="lugar" defaultValue={filters.place ?? ""}>
              <option value="">Todos</option>
              {facets.places.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit">Filtrar</Button>
            {filtered ? (
              <Link
                href={PUBLIC_ACTIVITIES_PATH}
                className="inline-flex min-h-11 items-center px-2 font-medium text-green-700 underline underline-offset-4"
              >
                Quitar filtros
              </Link>
            ) : null}
          </div>
        </form>
      ) : null}

      {nothing ? (
        <p className="mt-8 rounded-sm border bg-card p-5 text-ink-muted">
          {filtered ? (
            <>
              No hay actividades con estos filtros.{" "}
              <Link href={PUBLIC_ACTIVITIES_PATH} className="font-medium text-green-700 underline">
                Ver todas las actividades
              </Link>
            </>
          ) : (
            "Pronto publicaremos las actividades de la organización."
          )}
        </p>
      ) : null}

      {listing.upcoming.length > 0 ? (
        <section aria-labelledby="upcoming-title" className="mt-10">
          <h2
            id="upcoming-title"
            className="border-b-[3px] border-double border-gold-500 pb-2 font-serif text-2xl font-semibold text-green-900"
          >
            Próximas
          </h2>
          <ul className={grid}>
            {listing.upcoming.map((activity) => (
              <li key={activity.id}>
                <PublicActivityCard activity={activity} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {listing.past.length > 0 ? (
        <section aria-labelledby="past-title" className="mt-12">
          <h2
            id="past-title"
            className="border-b-[3px] border-double border-gold-500 pb-2 font-serif text-2xl font-semibold text-green-900"
          >
            Realizadas
          </h2>
          <ul className={grid}>
            {listing.past.map((activity) => (
              <li key={activity.id}>
                <PublicActivityCard activity={activity} />
              </li>
            ))}
          </ul>

          {listing.pageCount > 1 ? (
            <nav aria-label="Páginas de actividades realizadas" className="mt-8">
              <ul className="flex flex-wrap items-center justify-center gap-2">
                {Array.from({ length: listing.pageCount }, (_, i) => i + 1).map((page) => (
                  <li key={page}>
                    <Link
                      href={publicActivitiesHref(filters, { page })}
                      aria-current={page === filters.page ? "page" : undefined}
                      className="inline-flex size-11 items-center justify-center rounded-md border bg-card font-medium outline-none hover:border-green-700 focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:border-green-700 aria-[current=page]:bg-green-50 aria-[current=page]:text-green-900"
                    >
                      <span className="sr-only">Página </span>
                      {page}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
