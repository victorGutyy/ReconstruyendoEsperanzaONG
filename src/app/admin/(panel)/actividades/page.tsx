import { Plus, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { authorizePage } from "@/lib/auth/guard";
import { hasPermission } from "@/lib/auth/rules";
import {
  ACTIVITIES_PATH,
  activitiesHref,
  hasFilters,
  LIST_STATUSES,
  parseActivityFilters,
} from "@/modules/activities/list";
import {
  type ActivitySummary,
  countActivities,
  listActivities,
  listBasicsOptions,
} from "@/modules/activities/queries";
import { displayStatus, STATUS_LABELS } from "@/modules/activities/schema";
import { FilterLink } from "@/modules/panel/components/filter-link";
import { NoPermission } from "@/modules/panel/components/no-permission";

export const metadata: Metadata = { title: "Actividades" };

const dateFormat = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeZone: "America/Bogota",
});

function ActivityList({ items }: { items: ActivitySummary[] }) {
  return (
    <ul aria-label="Actividades" className="divide-y rounded-lg border bg-card">
      {items.map((item) => (
        <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
          <div className="min-w-0">
            <Link
              href={`${ACTIVITIES_PATH}/${item.id}/editar`}
              className="font-semibold text-green-900 underline-offset-4 hover:underline"
            >
              {item.title}
            </Link>
            <p className="text-sm text-ink-muted">
              {[
                dateFormat.format(new Date(item.startsAt)),
                item.placeName,
                item.categoryName,
                item.isMine ? "tuya" : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <span className="flex flex-wrap gap-2">
            {item.hasWithdrawnPhotos ? (
              <span className="rounded-sm border border-gold-500 bg-card px-2 py-1 text-xs font-semibold text-gold-700">
                Fotos retiradas
              </span>
            ) : null}
            <span className="rounded-sm bg-paper-2 px-2 py-1 text-xs font-semibold">
              {STATUS_LABELS[displayStatus(item.status, item.publishedAt)]}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export default async function ActivitiesPage({ searchParams }: PageProps<"/admin/actividades">) {
  const authorized = await authorizePage("content.read");
  if (!authorized) return <NoPermission reason="Tu rol no permite ver el contenido." />;

  const userId = authorized.user.id;
  const filters = parseActivityFilters(await searchParams);
  const canCreate = hasPermission(authorized.profile, "content.create");
  const canPublish = hasPermission(authorized.profile, "content.publish");

  const [list, counts, options] = await Promise.all([
    listActivities(filters, userId),
    countActivities(userId),
    listBasicsOptions(),
  ]);
  const onlyReview = filters.status === "review" && !filters.mine;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <p className="text-xs font-semibold tracking-[0.12em] text-gold-700 uppercase">Contenido</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-serif text-3xl font-semibold text-green-900">Actividades</h1>
        {canCreate ? (
          <Button asChild>
            <Link href={`${ACTIVITIES_PATH}/nueva`}>
              <Plus aria-hidden="true" />
              Nueva actividad
            </Link>
          </Button>
        ) : null}
      </div>

      <nav aria-label="Vistas de actividades" className="mt-8 flex flex-wrap gap-2">
        <FilterLink href={ACTIVITIES_PATH} active={!hasFilters(filters)}>
          Todas
        </FilterLink>
        {canPublish ? (
          <FilterLink
            href={activitiesHref(filters, { status: "review", mine: false })}
            active={onlyReview}
          >
            Por revisar ({counts.toReview})
          </FilterLink>
        ) : null}
        {canPublish ? (
          <FilterLink
            href={activitiesHref(filters, { withdrawn: !filters.withdrawn })}
            active={filters.withdrawn}
          >
            Con fotos retiradas
          </FilterLink>
        ) : null}
        <FilterLink href={activitiesHref(filters, { mine: !filters.mine })} active={filters.mine}>
          Mías
        </FilterLink>
      </nav>

      <form
        action={ACTIVITIES_PATH}
        role="search"
        aria-label="Buscar actividades"
        className="mt-5 grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-2"
      >
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="filter-q">Título</Label>
          <Input
            id="filter-q"
            name="q"
            type="search"
            defaultValue={filters.q}
            maxLength={80}
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="filter-status">Estado</Label>
          <NativeSelect id="filter-status" name="status" defaultValue={filters.status ?? ""}>
            <option value="">Todos</option>
            {LIST_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="filter-category">Categoría</Label>
          <NativeSelect id="filter-category" name="category" defaultValue={filters.category ?? ""}>
            <option value="">Todas</option>
            {options.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="filter-place">Lugar</Label>
          <NativeSelect id="filter-place" name="place" defaultValue={filters.place ?? ""}>
            <option value="">Todos</option>
            {options.places.map((place) => (
              <option key={place.id} value={place.id}>
                {place.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        {filters.mine ? <input type="hidden" name="mine" value="1" /> : null}
        {filters.withdrawn ? <input type="hidden" name="withdrawn" value="1" /> : null}
        <div className="flex flex-wrap items-end gap-3">
          <Button type="submit">
            <Search aria-hidden="true" />
            Filtrar
          </Button>
          {hasFilters(filters) ? (
            <Link
              href={ACTIVITIES_PATH}
              className="inline-flex min-h-11 items-center font-medium text-green-700 underline"
            >
              Quitar filtros
            </Link>
          ) : null}
        </div>
      </form>

      <section aria-labelledby="results-title" className="mt-8">
        <h2 id="results-title" className="mb-4 font-serif text-xl font-semibold text-green-900">
          {onlyReview ? "Por revisar" : "Resultados"} ({list.total})
        </h2>
        {list.items.length > 0 ? (
          <ActivityList items={list.items} />
        ) : (
          <p className="rounded-lg border bg-card p-5 text-ink-muted">
            {filters.withdrawn
              ? "Ninguna actividad publicada tiene fotos retiradas."
              : onlyReview
                ? "No hay actividades esperando revisión."
                : hasFilters(filters)
                  ? "Ninguna actividad coincide con los filtros."
                  : "Todavía no hay actividades."}
          </p>
        )}

        {list.pageCount > 1 ? (
          <nav aria-label="Páginas" className="mt-6 flex flex-wrap items-center gap-4">
            {filters.page > 1 ? (
              <Link
                href={activitiesHref(filters, { page: filters.page - 1 })}
                className="inline-flex min-h-11 items-center font-medium text-green-700 underline"
              >
                Anterior
              </Link>
            ) : null}
            <span className="text-ink-muted">
              Página {Math.min(filters.page, list.pageCount)} de {list.pageCount}
            </span>
            {filters.page < list.pageCount ? (
              <Link
                href={activitiesHref(filters, { page: filters.page + 1 })}
                className="inline-flex min-h-11 items-center font-medium text-green-700 underline"
              >
                Siguiente
              </Link>
            ) : null}
          </nav>
        ) : null}
      </section>
    </div>
  );
}
