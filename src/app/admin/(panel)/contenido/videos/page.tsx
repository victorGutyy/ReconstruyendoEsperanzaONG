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
  hasVideoFilters,
  parseVideoFilters,
  VIDEO_LIST_STATUSES,
  videosHref,
} from "@/modules/videos/list";
import { PROVIDER_LABELS, PROVIDERS } from "@/modules/videos/parse";
import { countVideos, listVideos, type VideoSummary } from "@/modules/videos/queries";
import { VIDEOS_PATH } from "@/modules/videos/schema";

export const metadata: Metadata = { title: "Videos" };

function VideoList({ items }: { items: VideoSummary[] }) {
  return (
    <ul aria-label="Videos" className="divide-y rounded-lg border bg-card">
      {items.map((item) => (
        <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
          <div className="min-w-0">
            <Link
              href={`${VIDEOS_PATH}/${item.id}`}
              className="font-semibold text-green-900 underline-offset-4 hover:underline"
            >
              {item.title}
            </Link>
            <p className="text-sm text-ink-muted">
              {[PROVIDER_LABELS[item.provider], item.isMine ? "tuyo" : null]
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
              {statusLabel("video", item.status, item.publishedAt)}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export default async function VideosPage({ searchParams }: PageProps<"/admin/contenido/videos">) {
  const authorized = await authorizePage("content.read");
  if (!authorized) return <NoPermission reason="Tu rol no permite ver el contenido." />;

  const userId = authorized.user.id;
  const filters = parseVideoFilters(await searchParams);
  const canCreate = hasPermission(authorized.profile, "content.create");
  const canPublish = hasPermission(authorized.profile, "content.publish");

  const [list, counts] = await Promise.all([listVideos(filters, userId), countVideos(userId)]);
  const onlyReview = filters.status === "review" && !filters.mine;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <p className="text-xs font-semibold tracking-[0.12em] text-gold-700 uppercase">Contenido</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-serif text-3xl font-semibold text-green-900">Videos</h1>
        {canCreate ? (
          <Button asChild>
            <Link href={`${VIDEOS_PATH}/nuevo`}>
              <Plus aria-hidden="true" />
              Nuevo video
            </Link>
          </Button>
        ) : null}
      </div>
      <ContentTabs
        current="video"
        canManageConsents={hasPermission(authorized.profile, "consent.manage")}
      />

      <nav aria-label="Vistas de videos" className="mt-6 flex flex-wrap gap-2">
        <FilterLink href={VIDEOS_PATH} active={!hasVideoFilters(filters)}>
          Todos
        </FilterLink>
        {canPublish ? (
          <FilterLink
            href={videosHref(filters, { status: "review", mine: false })}
            active={onlyReview}
          >
            Por revisar ({counts.toReview})
          </FilterLink>
        ) : null}
        <FilterLink href={videosHref(filters, { mine: !filters.mine })} active={filters.mine}>
          Míos
        </FilterLink>
      </nav>

      <form
        action={VIDEOS_PATH}
        role="search"
        aria-label="Buscar videos"
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
            {VIDEO_LIST_STATUSES.map((status) => (
              <option key={status} value={status}>
                {labelFor("video", status)}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="filter-provider">Plataforma</Label>
          <NativeSelect id="filter-provider" name="provider" defaultValue={filters.provider ?? ""}>
            <option value="">Todas</option>
            {PROVIDERS.map((provider) => (
              <option key={provider} value={provider}>
                {PROVIDER_LABELS[provider]}
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
          {hasVideoFilters(filters) ? (
            <Link
              href={VIDEOS_PATH}
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
          <VideoList items={list.items} />
        ) : (
          <p className="rounded-lg border bg-card p-5 text-ink-muted">
            {onlyReview
              ? "No hay videos esperando revisión."
              : hasVideoFilters(filters)
                ? "Ningún video coincide con los filtros."
                : "Todavía no hay videos."}
          </p>
        )}

        {list.pageCount > 1 ? (
          <nav aria-label="Páginas" className="mt-6 flex flex-wrap items-center gap-4">
            {filters.page > 1 ? (
              <Link
                href={videosHref(filters, { page: filters.page - 1 })}
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
                href={videosHref(filters, { page: filters.page + 1 })}
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
