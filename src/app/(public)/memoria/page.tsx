import type { Metadata } from "next";
import Link from "next/link";

import { FilterLink } from "@/components/ui/filter-link";
import { listMemory } from "@/modules/memory/public";
import {
  formatMemoryDay,
  MEMORY_FILTERS,
  MEMORY_KIND_LABELS,
  MEMORY_PATH,
  memoryHref,
  memoryItemHref,
  parseMemoryKind,
} from "@/modules/memory/schema";
import { Breadcrumbs, Photo } from "@/modules/site";

export const metadata: Metadata = {
  title: "Memoria",
  description: "Todo lo que ha hecho la organización en Calarcá, año por año.",
  alternates: { canonical: MEMORY_PATH },
};

/** Memoria (step 8.6, HU-01): what was done, grouped by year, newest first. */
export default async function MemoryPage({ searchParams }: PageProps<"/memoria">) {
  const kind = parseMemoryKind((await searchParams).tipo);
  const years = await listMemory(kind);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Breadcrumbs items={[{ href: "/", label: "Inicio" }, { label: "Memoria" }]} />
      <h1 className="mt-4 font-serif text-4xl font-semibold text-green-900 md:text-5xl">Memoria</h1>
      <p className="mt-2 text-ink-muted">Lo que hemos hecho, año por año.</p>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <nav aria-label="Filtrar la memoria" className="flex flex-wrap gap-2">
          {MEMORY_FILTERS.map((filter) => (
            <FilterLink
              key={filter.label}
              href={memoryHref(filter.kind)}
              active={kind === filter.kind}
            >
              {filter.label}
            </FilterLink>
          ))}
        </nav>
        {years.length > 1 ? (
          <nav aria-label="Ir al año" className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-ink-muted">Ir al año:</span>
            {years.map(({ year }) => (
              <a
                key={year}
                href={`#ano-${year}`}
                className="inline-flex min-h-11 items-center px-1 font-medium text-green-700 underline underline-offset-4"
              >
                {year}
              </a>
            ))}
          </nav>
        ) : null}
      </div>

      {years.length === 0 ? (
        <p className="mt-8 rounded-sm border bg-card p-5 text-ink-muted">
          {kind ? (
            <>
              Todavía no hay nada de este tipo.{" "}
              <Link href={MEMORY_PATH} className="font-medium text-green-700 underline">
                Ver toda la memoria
              </Link>
            </>
          ) : (
            "Pronto empezaremos a contar aquí lo que hemos hecho."
          )}
        </p>
      ) : null}

      {years.map(({ year, items }) => (
        <section key={year} aria-labelledby={`ano-${year}`} className="mt-10 scroll-mt-4">
          <h2
            id={`ano-${year}`}
            className="border-y-[3px] border-double border-gold-500 py-2 font-serif text-3xl font-semibold text-green-900"
          >
            {year}
          </h2>
          <ol className="mt-4 border-l-2 border-rule pl-5">
            {items.map((item) => (
              <li key={`${item.kind}-${item.id}`} className="relative py-3">
                <span
                  aria-hidden="true"
                  className="absolute top-5 -left-[1.6rem] size-3 rounded-full bg-green-700 ring-4 ring-paper"
                />
                <div className="flex gap-4">
                  {item.photo ? (
                    <Photo
                      photo={item.photo}
                      sizes="6rem"
                      className="size-20 shrink-0 rounded-sm"
                    />
                  ) : null}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold tracking-[0.12em] text-gold-700 uppercase">
                      <time dateTime={item.eventAt}>{formatMemoryDay(item.eventAt)}</time> ·{" "}
                      {MEMORY_KIND_LABELS[item.kind]}
                    </p>
                    <Link
                      href={memoryItemHref(item.kind, item.slug)}
                      className="inline-flex min-h-11 items-center font-serif text-lg font-semibold text-green-900 underline-offset-4 hover:underline"
                    >
                      {item.title}
                    </Link>
                    {item.place ? <p className="text-sm text-ink-muted">{item.place}</p> : null}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
