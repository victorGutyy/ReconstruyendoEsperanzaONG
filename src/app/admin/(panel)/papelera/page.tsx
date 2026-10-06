import type { Metadata } from "next";
import Link from "next/link";

import { FilterLink } from "@/components/ui/filter-link";
import { authorizePage } from "@/lib/auth/guard";
import { hasPermission } from "@/lib/auth/rules";
import { CONTENT_TYPES } from "@/modules/content/client";
import { NoPermission } from "@/modules/panel/components/no-permission";
import { listTrash } from "@/modules/trash";
import {
  KIND_LABELS,
  kindName,
  parseTrashFilter,
  TRASH_KINDS,
  TRASH_PATH,
  TrashItemActions,
  type TrashKind,
} from "@/modules/trash/client";

export const metadata: Metadata = { title: "Papelera" };

const dateFormat = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Bogota",
});

const itemHref = (kind: TrashKind, id: string) =>
  kind === "media" ? `/admin/medios/${id}` : CONTENT_TYPES[kind].editPath(id);

export default async function TrashPage({ searchParams }: PageProps<"/admin/papelera">) {
  const authorized = await authorizePage("trash.restore");
  if (!authorized) return <NoPermission reason="Solo el Administrador gestiona la papelera." />;

  const filter = parseTrashFilter((await searchParams).tipo);
  const items = await listTrash(filter);
  const canPurge = hasPermission(authorized.profile, "trash.purge");

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <p className="text-xs font-semibold tracking-[0.12em] text-gold-700 uppercase">Panel</p>
      <h1 className="mt-2 font-serif text-3xl font-semibold text-green-900">Papelera</h1>
      <p className="mt-2 text-ink-muted">
        Lo que se envía a la papelera sale del sitio, pero se puede restaurar. Eliminar
        definitivamente no se puede deshacer.
      </p>

      <nav aria-label="Filtros de la papelera" className="mt-6 flex flex-wrap gap-2">
        <FilterLink href={TRASH_PATH} active={filter === null}>
          Todo
        </FilterLink>
        {TRASH_KINDS.map((kind) => (
          <FilterLink key={kind} href={`${TRASH_PATH}?tipo=${kind}`} active={filter === kind}>
            {KIND_LABELS[kind]}
          </FilterLink>
        ))}
      </nav>

      {items.length === 0 ? (
        <p className="mt-6 rounded-lg border bg-card p-5 text-ink-muted">La papelera está vacía.</p>
      ) : (
        <ul aria-label="En la papelera" className="mt-6 divide-y rounded-lg border bg-card">
          {items.map((item) => (
            <li
              key={`${item.kind}-${item.id}`}
              className="flex flex-wrap items-center justify-between gap-3 p-4"
            >
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gold-700">{kindName(item.kind)}</p>
                <Link
                  href={itemHref(item.kind, item.id)}
                  className="font-semibold break-words text-green-900 underline-offset-4 hover:underline"
                >
                  {item.name}
                </Link>
                <p className="text-sm text-ink-muted">
                  En la papelera desde el{" "}
                  <time dateTime={item.trashedAt}>
                    {dateFormat.format(new Date(item.trashedAt))}
                  </time>
                  {item.trashedBy ? ` · por ${item.trashedBy}` : ""}
                </p>
              </div>
              <TrashItemActions
                kind={item.kind}
                id={item.id}
                name={item.name}
                canPurge={canPurge}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
