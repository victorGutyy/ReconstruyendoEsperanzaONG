import type { Metadata } from "next";
import Link from "next/link";

import { FilterLink } from "@/components/ui/filter-link";
import { authorizePage } from "@/lib/auth/guard";
import { listMessages } from "@/modules/messages/queries";
import {
  inboxHref,
  MESSAGE_TABS,
  MESSAGES_PATH,
  parseInboxFilters,
  STATUS_LABELS,
} from "@/modules/messages/schema";
import { NoPermission } from "@/modules/panel/components/no-permission";

export const metadata: Metadata = { title: "Mensajes" };

const dateFormat = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Bogota",
});

/** The contact form's inbox (step 8.7b): what still needs an answer first. */
export default async function MessagesPage({ searchParams }: PageProps<"/admin/mensajes">) {
  const authorized = await authorizePage("messages.read");
  if (!authorized) return <NoPermission reason="Tu rol no permite leer los mensajes." />;

  const filters = parseInboxFilters(await searchParams);
  const { messages, pageCount } = await listMessages(filters.tab, filters.page);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <p className="text-xs font-semibold tracking-[0.12em] text-gold-700 uppercase">Panel</p>
      <h1 className="mt-2 font-serif text-3xl font-semibold text-green-900">Mensajes</h1>
      <p className="mt-2 text-ink-muted">
        Lo que escriben las personas desde el formulario de contacto del sitio. Son datos
        personales: úsalos solo para responder.
      </p>

      <nav aria-label="Bandejas" className="mt-6 flex flex-wrap gap-2">
        {MESSAGE_TABS.map((tab) => (
          <FilterLink key={tab.key} href={inboxHref(tab.key)} active={filters.tab === tab.key}>
            {tab.label}
          </FilterLink>
        ))}
      </nav>

      {messages.length === 0 ? (
        <p className="mt-6 rounded-lg border bg-card p-5 text-ink-muted">
          {filters.tab === "pending" ? "No hay mensajes por atender." : "No hay mensajes aquí."}
        </p>
      ) : (
        <ul aria-label="Mensajes" className="mt-6 divide-y rounded-lg border bg-card">
          {messages.map((message) => (
            <li key={message.id}>
              <Link
                href={`${MESSAGES_PATH}/${message.id}`}
                className="flex flex-col gap-1 p-4 outline-none hover:bg-green-50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
              >
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span
                    className={
                      message.status === "new"
                        ? "font-semibold text-green-900"
                        : "font-medium text-ink"
                    }
                  >
                    {message.fullName}
                  </span>
                  <span className="flex items-center gap-2 text-sm text-ink-muted">
                    {message.status === "new" ? (
                      <span className="rounded-sm bg-green-700 px-2 py-0.5 text-xs font-semibold text-paper">
                        {STATUS_LABELS.new}
                      </span>
                    ) : null}
                    <time dateTime={message.createdAt}>
                      {dateFormat.format(new Date(message.createdAt))}
                    </time>
                  </span>
                </span>
                <span className="text-sm text-ink-muted">{message.preview}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {pageCount > 1 ? (
        <nav aria-label="Páginas de mensajes" className="mt-6 flex flex-wrap gap-2">
          {Array.from({ length: pageCount }, (_, i) => i + 1).map((page) => (
            <FilterLink
              key={page}
              href={inboxHref(filters.tab, page)}
              active={page === filters.page}
            >
              {page}
            </FilterLink>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
