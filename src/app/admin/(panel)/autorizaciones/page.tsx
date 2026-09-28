import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { authorizePage } from "@/lib/auth/guard";
import { listConsents } from "@/modules/consents/queries";
import {
  consentStatus,
  parseConsentFilters,
  SIGNER_LABELS,
  STATUS_LABELS,
} from "@/modules/consents/schema";
import { NoPermission } from "@/modules/panel/components/no-permission";

export const metadata: Metadata = { title: "Autorizaciones" };

const dateFormat = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeZone: "UTC" });
const formatDate = (isoDate: string) => dateFormat.format(new Date(`${isoDate}T00:00:00Z`));

export default async function ConsentsPage({ searchParams }: PageProps<"/admin/autorizaciones">) {
  const authorized = await authorizePage("consent.manage");
  if (!authorized) {
    return (
      <NoPermission reason="Solo las personas con rol de Editor o Administrador manejan las autorizaciones de imagen." />
    );
  }

  const filters = parseConsentFilters(await searchParams);
  const { items, total, pageCount } = await listConsents(filters);
  const pageHref = (page: number) => {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.minors) params.set("minors", "1");
    if (filters.status !== "active") params.set("status", filters.status);
    if (page > 1) params.set("page", String(page));
    const query = params.toString();
    return query ? `/admin/autorizaciones?${query}` : "/admin/autorizaciones";
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <p className="text-xs font-semibold tracking-[0.12em] text-gold-700 uppercase">Panel</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-serif text-3xl font-semibold text-green-900">Autorizaciones</h1>
        <Button asChild>
          <Link href="/admin/autorizaciones/nueva">
            <Plus aria-hidden="true" />
            Registrar autorización
          </Link>
        </Button>
      </div>
      <p className="mt-2 text-ink-muted">
        Autorizaciones firmadas de uso de imagen. Contienen datos personales: se guardan solo aquí y
        no se exportan.
      </p>

      <form
        method="get"
        aria-label="Buscar autorizaciones"
        className="mt-8 grid gap-4 rounded-lg border bg-card p-5 sm:grid-cols-[1fr_12rem_auto]"
      >
        <div className="space-y-2">
          <Label htmlFor="consent-q">Nombre de la persona</Label>
          <Input id="consent-q" name="q" defaultValue={filters.q} autoComplete="off" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="consent-status">Estado</Label>
          <NativeSelect id="consent-status" name="status" defaultValue={filters.status}>
            <option value="active">Sin revocar</option>
            <option value="revoked">Revocadas</option>
            <option value="all">Todas</option>
          </NativeSelect>
        </div>
        <div className="flex items-end gap-3">
          <label className="flex min-h-12 items-center gap-2">
            <input
              type="checkbox"
              name="minors"
              value="1"
              defaultChecked={filters.minors}
              className="size-5 accent-green-700"
            />
            Solo menores
          </label>
        </div>
        <div className="sm:col-span-3">
          <Button type="submit" variant="outline">
            Buscar
          </Button>
        </div>
      </form>

      <section aria-labelledby="consents-title" className="mt-8">
        <h2 id="consents-title" className="mb-4 font-serif text-xl font-semibold text-green-900">
          {total === 1 ? "1 autorización" : `${total} autorizaciones`}
        </h2>
        {items.length === 0 ? (
          <p className="rounded-lg border bg-card p-5 text-ink-muted">
            No hay autorizaciones con estos filtros.
          </p>
        ) : (
          <ul aria-label="Autorizaciones" className="divide-y rounded-lg border bg-card">
            {items.map((item) => {
              const status = consentStatus(item);
              return (
                <li key={item.id} className="grid gap-1 p-4">
                  <Link
                    href={`/admin/autorizaciones/${item.id}`}
                    className="font-semibold text-green-900 underline-offset-4 hover:underline"
                  >
                    {item.subjectName}
                  </Link>
                  <p className="text-sm text-ink-muted">
                    {item.isMinor ? "Menor de edad · " : ""}
                    Firmó: {SIGNER_LABELS[item.signerType]} · {formatDate(item.grantedOn)} ·{" "}
                    {item.photoCount === 1 ? "1 foto" : `${item.photoCount} fotos`}
                  </p>
                  <p
                    className={
                      status === "active"
                        ? "text-sm font-semibold text-green-700"
                        : "text-sm font-semibold text-danger"
                    }
                  >
                    {STATUS_LABELS[status]}
                  </p>
                </li>
              );
            })}
          </ul>
        )}

        {pageCount > 1 ? (
          <nav aria-label="Páginas" className="mt-6 flex flex-wrap items-center gap-4">
            {filters.page > 1 ? (
              <Link
                href={pageHref(filters.page - 1)}
                className="font-medium text-green-700 underline"
              >
                Anteriores
              </Link>
            ) : null}
            <span className="text-ink-muted">
              Página {Math.min(filters.page, pageCount)} de {pageCount}
            </span>
            {filters.page < pageCount ? (
              <Link
                href={pageHref(filters.page + 1)}
                className="font-medium text-green-700 underline"
              >
                Siguientes
              </Link>
            ) : null}
          </nav>
        ) : null}
      </section>
    </div>
  );
}
