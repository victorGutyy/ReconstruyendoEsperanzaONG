import { CheckCircle2 } from "lucide-react";
import Link from "next/link";

import { describeIssues } from "../library";
import type { LibraryItem } from "../queries";
import { DiscardButton } from "./discard-button";

const dateFormat = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeZone: "America/Bogota",
});

/** Photo cards with what each one still needs before it can be published. */
export function LibraryGrid({ items }: { items: LibraryItem[] }) {
  return (
    <ul
      aria-label="Biblioteca de fotos"
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
    >
      {items.map((item) => {
        const label = item.altText ?? "Foto sin descripción";
        const issues = describeIssues(item.issues.filter((code) => code !== "in_trash"));

        return (
          <li key={item.id} className="flex flex-col overflow-hidden rounded-lg border bg-card">
            <Link
              href={`/admin/medios/${item.id}`}
              className="group outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Abrir: ${label}`}
            >
              <div className="flex aspect-[4/3] items-center justify-center bg-paper-2">
                {item.thumbnailUrl ? (
                  // Short-lived signed URL from a private bucket: next/image cannot cache it
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.thumbnailUrl}
                    alt=""
                    width={item.width ?? undefined}
                    height={item.height ?? undefined}
                    loading="lazy"
                    className="size-full object-cover group-hover:opacity-90"
                  />
                ) : (
                  <span className="px-2 text-center text-sm text-ink-muted">
                    {item.status === "failed" ? "No se pudo procesar" : "Sin terminar"}
                  </span>
                )}
              </div>
            </Link>

            <div className="grid flex-1 content-start gap-2 p-2">
              <p className="line-clamp-2 text-sm">{label}</p>
              {item.status === "ready" && !item.inTrash ? (
                issues.length === 0 ? (
                  <p className="flex items-center gap-1 text-xs font-semibold text-green-700">
                    <CheckCircle2 aria-hidden="true" className="size-4" />
                    Lista para publicar
                  </p>
                ) : (
                  <ul aria-label="Pendientes" className="flex flex-wrap gap-1">
                    {issues.map((issue) => (
                      <li
                        key={issue.code}
                        className="rounded-sm bg-gold-500/15 px-1.5 py-0.5 text-xs font-medium text-gold-700"
                      >
                        {issue.badge}
                      </li>
                    ))}
                  </ul>
                )
              ) : null}
              <div className="mt-auto flex items-center justify-between gap-2 text-xs text-ink-muted">
                <span>
                  <time dateTime={item.createdAt}>
                    {dateFormat.format(new Date(item.createdAt))}
                  </time>
                  {item.isMine ? " · tuya" : null}
                </span>
                {item.status !== "ready" && item.isMine && !item.inTrash ? (
                  <DiscardButton mediaId={item.id} />
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
