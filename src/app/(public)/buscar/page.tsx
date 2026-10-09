import { Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MEMORY_KIND_LABELS, memoryItemHref } from "@/modules/memory/schema";
import { searchContent } from "@/modules/search/public";
import { parseSearch, SEARCH_MAX, SEARCH_PATH, searchHref } from "@/modules/search/schema";
import { Breadcrumbs, Pagination } from "@/modules/site";

// Depends on what is typed: never cached, never indexed (docs/07 §9)
export const metadata: Metadata = {
  title: "Buscar",
  robots: { index: false, follow: true },
};

const DAY = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "America/Bogota",
});

export default async function SearchPage({ searchParams }: PageProps<"/buscar">) {
  const params = await searchParams;
  const request = parseSearch(params);
  const raw = Array.isArray(params.q) ? params.q[0] : params.q;
  const result = request ? await searchContent(request.query, request.page) : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Breadcrumbs items={[{ href: "/", label: "Inicio" }, { label: "Buscar" }]} />
      <h1 className="mt-4 font-serif text-4xl font-semibold text-green-900 md:text-5xl">Buscar</h1>

      {/* A plain form: works without JavaScript and every search has its address */}
      <form
        method="get"
        action={SEARCH_PATH}
        role="search"
        className="mt-6 flex flex-wrap items-end gap-3"
      >
        <div className="min-w-0 flex-1 space-y-2">
          <Label htmlFor="search-q">Qué buscas</Label>
          <Input
            id="search-q"
            name="q"
            type="search"
            defaultValue={request?.query ?? raw ?? ""}
            maxLength={SEARCH_MAX}
            autoComplete="off"
            aria-describedby="search-help"
          />
        </div>
        <Button type="submit">
          <Search aria-hidden="true" />
          Buscar
        </Button>
        <p id="search-help" className="w-full text-sm text-ink-muted">
          Busca en actividades, historias y proyectos. No importan las tildes.
        </p>
      </form>

      <div aria-live="polite">
        {raw && !request ? <p className="mt-8 text-ink-muted">Escribe al menos 2 letras.</p> : null}

        {result && !result.ok ? (
          <p role="alert" className="mt-8 rounded-sm border bg-card p-5 font-medium text-danger">
            Hiciste muchas búsquedas seguidas. Espera un minuto y vuelve a intentarlo.
          </p>
        ) : null}

        {result?.ok && request ? (
          result.total === 0 ? (
            <p className="mt-8 rounded-sm border bg-card p-5 text-ink-muted">
              No encontramos nada para «{request.query}». Prueba con otras palabras.
            </p>
          ) : (
            <section aria-labelledby="results-title" className="mt-8">
              <h2 id="results-title" className="font-serif text-xl font-semibold text-green-900">
                {result.total === 1 ? "1 resultado" : `${result.total} resultados`} para «
                {request.query}»
              </h2>
              <ol className="mt-4 divide-y">
                {result.hits.map((hit) => (
                  <li key={`${hit.kind}-${hit.id}`} className="py-4">
                    <p className="text-xs font-semibold tracking-[0.12em] text-gold-700 uppercase">
                      {MEMORY_KIND_LABELS[hit.kind]} ·{" "}
                      <time dateTime={hit.eventAt}>{DAY.format(new Date(hit.eventAt))}</time>
                    </p>
                    <Link
                      href={memoryItemHref(hit.kind, hit.slug)}
                      className="inline-flex min-h-11 items-center font-serif text-xl font-semibold text-green-900 underline-offset-4 hover:underline"
                    >
                      {hit.title}
                    </Link>
                    {hit.summary ? <p className="text-ink-muted">{hit.summary}</p> : null}
                  </li>
                ))}
              </ol>
              <Pagination
                label="Páginas de resultados"
                current={request.page}
                pageCount={result.pageCount}
                hrefFor={(page) => searchHref(request.query, page)}
              />
            </section>
          )
        ) : null}
      </div>
    </div>
  );
}
