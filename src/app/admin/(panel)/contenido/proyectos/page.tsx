import { Plus, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { FilterLink } from "@/components/ui/filter-link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { authorizePage } from "@/lib/auth/guard";
import { hasPermission } from "@/lib/auth/rules";
import { ContentTabs, labelFor, statusLabel } from "@/modules/content/client";
import { NoPermission } from "@/modules/panel/components/no-permission";
import {
  hasProjectFilters,
  parseProjectFilters,
  PROJECT_LIST_STATUSES,
  projectsHref,
} from "@/modules/projects/list";
import { countProjects, listProjects, type ProjectSummary } from "@/modules/projects/queries";
import { PROJECT_STAGES, PROJECTS_PATH, STAGE_LABELS } from "@/modules/projects/schema";

export const metadata: Metadata = { title: "Proyectos" };

const dateFormat = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeZone: "America/Bogota",
});

function ProjectList({ items }: { items: ProjectSummary[] }) {
  return (
    <ul aria-label="Proyectos" className="divide-y rounded-lg border bg-card">
      {items.map((item) => (
        <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
          <div className="min-w-0">
            <Link
              href={`${PROJECTS_PATH}/${item.id}`}
              className="font-semibold text-green-900 underline-offset-4 hover:underline"
            >
              {item.title}
            </Link>
            <p className="text-sm text-ink-muted">
              {[
                STAGE_LABELS[item.stage],
                `Editado el ${dateFormat.format(new Date(item.updatedAt))}`,
                item.isMine ? "tuyo" : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <span className="flex flex-wrap gap-2">
            {item.coverWithdrawn ? (
              <span className="rounded-sm border border-gold-500 bg-card px-2 py-1 text-xs font-semibold text-gold-700">
                Portada retirada
              </span>
            ) : null}
            <span className="rounded-sm bg-paper-2 px-2 py-1 text-xs font-semibold">
              {statusLabel("project", item.status, item.publishedAt)}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export default async function ProjectsPage({
  searchParams,
}: PageProps<"/admin/contenido/proyectos">) {
  const authorized = await authorizePage("content.read");
  if (!authorized) return <NoPermission reason="Tu rol no permite ver el contenido." />;

  const userId = authorized.user.id;
  const filters = parseProjectFilters(await searchParams);
  const canCreate = hasPermission(authorized.profile, "content.create");
  const canPublish = hasPermission(authorized.profile, "content.publish");

  const [list, counts] = await Promise.all([listProjects(filters, userId), countProjects(userId)]);
  const onlyReview = filters.status === "review" && !filters.mine;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <p className="text-xs font-semibold tracking-[0.12em] text-gold-700 uppercase">Contenido</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-serif text-3xl font-semibold text-green-900">Proyectos</h1>
        {canCreate ? (
          <Button asChild>
            <Link href={`${PROJECTS_PATH}/nuevo`}>
              <Plus aria-hidden="true" />
              Nuevo proyecto
            </Link>
          </Button>
        ) : null}
      </div>
      <ContentTabs current="project" />

      <nav aria-label="Vistas de proyectos" className="mt-6 flex flex-wrap gap-2">
        <FilterLink href={PROJECTS_PATH} active={!hasProjectFilters(filters)}>
          Todos
        </FilterLink>
        {canPublish ? (
          <FilterLink
            href={projectsHref(filters, { status: "review", mine: false })}
            active={onlyReview}
          >
            Por revisar ({counts.toReview})
          </FilterLink>
        ) : null}
        <FilterLink href={projectsHref(filters, { mine: !filters.mine })} active={filters.mine}>
          Míos
        </FilterLink>
      </nav>

      <form
        action={PROJECTS_PATH}
        role="search"
        aria-label="Buscar proyectos"
        className="mt-5 grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-2"
      >
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="filter-q">Nombre</Label>
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
          <Label htmlFor="filter-status">Publicación</Label>
          <NativeSelect id="filter-status" name="status" defaultValue={filters.status ?? ""}>
            <option value="">Todas</option>
            {PROJECT_LIST_STATUSES.map((status) => (
              <option key={status} value={status}>
                {labelFor("project", status)}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="filter-stage">Estado del proyecto</Label>
          <NativeSelect id="filter-stage" name="stage" defaultValue={filters.stage ?? ""}>
            <option value="">Todos</option>
            {PROJECT_STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {STAGE_LABELS[stage]}
              </option>
            ))}
          </NativeSelect>
        </div>
        {filters.mine ? <input type="hidden" name="mine" value="1" /> : null}
        <div className="flex flex-wrap items-end gap-3">
          <Button type="submit">
            <Search aria-hidden="true" />
            Filtrar
          </Button>
          {hasProjectFilters(filters) ? (
            <Link
              href={PROJECTS_PATH}
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
          <ProjectList items={list.items} />
        ) : (
          <p className="rounded-lg border bg-card p-5 text-ink-muted">
            {onlyReview
              ? "No hay proyectos esperando revisión."
              : hasProjectFilters(filters)
                ? "Ningún proyecto coincide con los filtros."
                : "Todavía no hay proyectos."}
          </p>
        )}

        {list.pageCount > 1 ? (
          <nav aria-label="Páginas" className="mt-6 flex flex-wrap items-center gap-4">
            {filters.page > 1 ? (
              <Link
                href={projectsHref(filters, { page: filters.page - 1 })}
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
                href={projectsHref(filters, { page: filters.page + 1 })}
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
