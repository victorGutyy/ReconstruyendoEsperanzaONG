import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { authorizePage } from "@/lib/auth/guard";
import { hasPermission } from "@/lib/auth/rules";
import { type ActivitySummary, listActivitiesForPanel } from "@/modules/activities/queries";
import { displayStatus, STATUS_LABELS } from "@/modules/activities/schema";
import { NoPermission } from "@/modules/panel/components/no-permission";

export const metadata: Metadata = { title: "Actividades" };

const dateFormat = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeZone: "America/Bogota",
});

function ActivityList({ items, label }: { items: ActivitySummary[]; label: string }) {
  return (
    <ul aria-label={label} className="divide-y rounded-lg border bg-card">
      {items.map((item) => (
        <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
          <div>
            <Link
              href={`/admin/actividades/${item.id}/editar`}
              className="font-semibold text-green-900 underline-offset-4 hover:underline"
            >
              {item.title}
            </Link>
            <p className="text-sm text-ink-muted">
              {dateFormat.format(new Date(item.startsAt))}
              {item.isMine ? " · tuya" : ""}
            </p>
          </div>
          <span className="rounded-sm bg-paper-2 px-2 py-1 text-xs font-semibold">
            {STATUS_LABELS[displayStatus(item.status, item.publishedAt)]}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default async function ActivitiesPage() {
  const authorized = await authorizePage("content.read");
  if (!authorized) return <NoPermission reason="Tu rol no permite ver el contenido." />;

  const { mine, recent } = await listActivitiesForPanel(authorized.user.id);
  const canCreate = hasPermission(authorized.profile, "content.create");

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <p className="text-xs font-semibold tracking-[0.12em] text-gold-700 uppercase">Contenido</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-serif text-3xl font-semibold text-green-900">Actividades</h1>
        {canCreate ? (
          <Button asChild>
            <Link href="/admin/actividades/nueva">
              <Plus aria-hidden="true" />
              Nueva actividad
            </Link>
          </Button>
        ) : null}
      </div>

      <section aria-labelledby="mine-title" className="mt-8">
        <h2 id="mine-title" className="mb-4 font-serif text-xl font-semibold text-green-900">
          Mis borradores y en revisión ({mine.length})
        </h2>
        {mine.length === 0 ? (
          <p className="rounded-lg border bg-card p-5 text-ink-muted">No tienes borradores.</p>
        ) : (
          <ActivityList items={mine} label="Mis borradores y en revisión" />
        )}
      </section>

      <section aria-labelledby="recent-title" className="mt-10">
        <h2 id="recent-title" className="mb-4 font-serif text-xl font-semibold text-green-900">
          Recientes
        </h2>
        {recent.length === 0 ? (
          <p className="rounded-lg border bg-card p-5 text-ink-muted">
            Todavía no hay actividades.
          </p>
        ) : (
          <ActivityList items={recent} label="Actividades recientes" />
        )}
      </section>
    </div>
  );
}
