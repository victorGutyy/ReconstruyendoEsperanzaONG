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
  hasTestimonialFilters,
  parseTestimonialFilters,
  TESTIMONIAL_LIST_STATUSES,
  testimonialsHref,
} from "@/modules/testimonials/list";
import {
  countTestimonials,
  listTestimonials,
  type TestimonialSummary,
} from "@/modules/testimonials/queries";
import { TESTIMONIALS_PATH } from "@/modules/testimonials/schema";

export const metadata: Metadata = { title: "Testimonios" };

const short = (text: string) => (text.length > 120 ? `${text.slice(0, 120)}…` : text);

function TestimonialList({ items }: { items: TestimonialSummary[] }) {
  return (
    <ul aria-label="Testimonios" className="divide-y rounded-lg border bg-card">
      {items.map((item) => (
        <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
          <div className="min-w-0">
            <Link
              href={`${TESTIMONIALS_PATH}/${item.id}`}
              className="font-semibold text-green-900 underline-offset-4 hover:underline"
            >
              {item.authorName}
            </Link>
            <p className="text-sm text-ink-muted">
              «{short(item.quote)}»{item.isMine ? " · tuyo" : ""}
            </p>
          </div>
          <span className="flex flex-wrap gap-2">
            {item.consentGone && item.status === "published" ? (
              <span className="rounded-sm border border-danger/60 bg-card px-2 py-1 text-xs font-semibold text-danger">
                Autorización revocada o vencida
              </span>
            ) : null}
            <span className="rounded-sm bg-paper-2 px-2 py-1 text-xs font-semibold">
              {statusLabel("testimonial", item.status, item.publishedAt)}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export default async function TestimonialsPage({
  searchParams,
}: PageProps<"/admin/contenido/testimonios">) {
  // Personal data: authorization managers only (decision 7.6d)
  const authorized = await authorizePage("consent.manage");
  if (!authorized || !hasPermission(authorized.profile, "content.read")) {
    return <NoPermission reason="Los testimonios los gestiona quien maneja las autorizaciones." />;
  }

  const userId = authorized.user.id;
  const filters = parseTestimonialFilters(await searchParams);
  const canCreate = hasPermission(authorized.profile, "content.create");
  const canPublish = hasPermission(authorized.profile, "content.publish");

  const [list, counts] = await Promise.all([
    listTestimonials(filters, userId),
    countTestimonials(userId),
  ]);
  const onlyReview = filters.status === "review" && !filters.mine;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <p className="text-xs font-semibold tracking-[0.12em] text-gold-700 uppercase">Contenido</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-serif text-3xl font-semibold text-green-900">Testimonios</h1>
        {canCreate ? (
          <Button asChild>
            <Link href={`${TESTIMONIALS_PATH}/nuevo`}>
              <Plus aria-hidden="true" />
              Nuevo testimonio
            </Link>
          </Button>
        ) : null}
      </div>
      <ContentTabs current="testimonial" canManageConsents />

      <nav aria-label="Vistas de testimonios" className="mt-6 flex flex-wrap gap-2">
        <FilterLink href={TESTIMONIALS_PATH} active={!hasTestimonialFilters(filters)}>
          Todos
        </FilterLink>
        {canPublish ? (
          <FilterLink
            href={testimonialsHref(filters, { status: "review", mine: false })}
            active={onlyReview}
          >
            Por revisar ({counts.toReview})
          </FilterLink>
        ) : null}
        <FilterLink
          href={testimonialsHref(filters, { withdrawn: !filters.withdrawn })}
          active={filters.withdrawn}
        >
          Autorización revocada o vencida ({counts.withdrawn})
        </FilterLink>
        <FilterLink href={testimonialsHref(filters, { mine: !filters.mine })} active={filters.mine}>
          Míos
        </FilterLink>
      </nav>

      <form
        action={TESTIMONIALS_PATH}
        role="search"
        aria-label="Buscar testimonios"
        className="mt-5 grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-2"
      >
        <div className="space-y-2">
          <Label htmlFor="filter-q">Nombre o texto</Label>
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
            {TESTIMONIAL_LIST_STATUSES.map((status) => (
              <option key={status} value={status}>
                {labelFor("testimonial", status)}
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
          {hasTestimonialFilters(filters) ? (
            <Link
              href={TESTIMONIALS_PATH}
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
          <TestimonialList items={list.items} />
        ) : (
          <p className="rounded-lg border bg-card p-5 text-ink-muted">
            {filters.withdrawn
              ? "Ningún testimonio publicado perdió su autorización."
              : onlyReview
                ? "No hay testimonios esperando revisión."
                : hasTestimonialFilters(filters)
                  ? "Ningún testimonio coincide con los filtros."
                  : "Todavía no hay testimonios."}
          </p>
        )}

        {list.pageCount > 1 ? (
          <nav aria-label="Páginas" className="mt-6 flex flex-wrap items-center gap-4">
            {filters.page > 1 ? (
              <Link
                href={testimonialsHref(filters, { page: filters.page - 1 })}
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
                href={testimonialsHref(filters, { page: filters.page + 1 })}
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
