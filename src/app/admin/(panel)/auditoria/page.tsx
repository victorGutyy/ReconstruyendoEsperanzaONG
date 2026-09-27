import type { Metadata } from "next";
import Link from "next/link";

import { authorizePage } from "@/lib/auth/guard";
import { AuditFiltersForm } from "@/modules/audit/components/audit-filters";
import { AuditTimeline } from "@/modules/audit/components/audit-timeline";
import { listAuditEntries } from "@/modules/audit/queries";
import { auditHref, parseAuditFilters } from "@/modules/audit/schema";
import { NoPermission } from "@/modules/panel/components/no-permission";

export const metadata: Metadata = { title: "Auditoría" };

export default async function AuditPage({ searchParams }: PageProps<"/admin/auditoria">) {
  const authorized = await authorizePage("audit.read");

  if (!authorized) {
    return (
      <NoPermission reason="Solo las personas con rol de Administrador pueden consultar la auditoría." />
    );
  }

  const filters = parseAuditFilters(await searchParams);
  const { entries, total, pageCount, lookups, people } = await listAuditEntries(filters);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <p className="text-xs font-semibold tracking-[0.12em] text-gold-700 uppercase">Panel</p>
      <h1 className="mt-2 font-serif text-3xl font-semibold text-green-900">Auditoría</h1>
      <p className="mt-2 text-ink-muted">
        Registro de quién cambió qué y cuándo. Nadie puede modificarlo ni borrarlo.
      </p>

      <div className="mt-8">
        <AuditFiltersForm filters={filters} people={people} />
      </div>

      <section aria-labelledby="results-title" className="mt-8">
        <h2 id="results-title" className="mb-4 font-serif text-xl font-semibold text-green-900">
          {total === 1 ? "1 registro" : `${total} registros`}
        </h2>

        {entries.length > 0 ? (
          <AuditTimeline entries={entries} lookups={lookups} />
        ) : (
          <p className="rounded-lg border bg-card p-5 text-ink-muted">
            No hay registros con estos filtros.
          </p>
        )}

        {pageCount > 1 ? (
          <nav aria-label="Páginas" className="mt-6 flex flex-wrap items-center gap-4">
            {filters.page > 1 ? (
              <Link
                href={auditHref(filters, filters.page - 1)}
                className="inline-flex min-h-11 items-center font-medium text-green-700 underline"
              >
                Más recientes
              </Link>
            ) : null}
            <span className="text-ink-muted">
              Página {Math.min(filters.page, pageCount)} de {pageCount}
            </span>
            {filters.page < pageCount ? (
              <Link
                href={auditHref(filters, filters.page + 1)}
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
