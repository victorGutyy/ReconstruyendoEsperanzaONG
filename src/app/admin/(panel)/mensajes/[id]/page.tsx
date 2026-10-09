import { Mail, MessageCircle, Phone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { authorizePage } from "@/lib/auth/guard";
import { hasPermission } from "@/lib/auth/rules";
import { formatColombianPhone } from "@/lib/utils/phone";
import { MarkAsRead, MessageActions } from "@/modules/messages/components/message-actions";
import { getMessage } from "@/modules/messages/queries";
import {
  MESSAGES_PATH,
  replyMailHref,
  replyWhatsappHref,
  STATUS_LABELS,
} from "@/modules/messages/schema";
import { NoPermission } from "@/modules/panel/components/no-permission";
import { getSiteSettings } from "@/modules/settings";

export const metadata: Metadata = { title: "Mensaje" };

const dateFormat = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "America/Bogota",
});

const replyLink =
  "inline-flex min-h-11 items-center gap-2 rounded-md border bg-card px-4 font-medium text-green-900 outline-none hover:border-green-700 focus-visible:ring-2 focus-visible:ring-ring";

export default async function MessagePage({ params }: PageProps<"/admin/mensajes/[id]">) {
  const authorized = await authorizePage("messages.read");
  if (!authorized) return <NoPermission reason="Tu rol no permite leer los mensajes." />;

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [message, settings] = await Promise.all([getMessage(id), getSiteSettings()]);
  if (!message) notFound();
  const canManage = hasPermission(authorized.profile, "messages.manage");

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link href={MESSAGES_PATH} className="font-medium text-green-700 underline">
        Volver a los mensajes
      </Link>
      <p className="mt-4 text-xs font-semibold tracking-[0.12em] text-gold-700 uppercase">
        Mensaje · {message.inTrash ? "En la papelera" : STATUS_LABELS[message.status]}
      </p>
      <h1 className="mt-2 font-serif text-3xl font-semibold text-green-900">{message.fullName}</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Recibido el{" "}
        <time dateTime={message.createdAt}>{dateFormat.format(new Date(message.createdAt))}</time>
        {" · "}aceptó la política de datos, versión {message.policyVersion}
      </p>

      {canManage && !message.inTrash ? (
        <MarkAsRead id={message.id} status={message.status} />
      ) : null}

      <blockquote className="mt-6 rounded-lg border bg-card p-5 whitespace-pre-line">
        {message.message}
      </blockquote>

      <section aria-labelledby="reply-title" className="mt-6">
        <h2 id="reply-title" className="font-serif text-lg font-semibold text-green-900">
          Responder
        </h2>
        <ul className="mt-3 flex flex-wrap gap-3">
          {message.email ? (
            <li>
              <a
                href={replyMailHref(message.email, settings.organizationName)}
                className={replyLink}
              >
                <Mail aria-hidden="true" className="size-5" />
                {message.email}
              </a>
            </li>
          ) : null}
          {message.phone ? (
            <>
              <li>
                <a
                  href={replyWhatsappHref(message.phone)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={replyLink}
                >
                  <MessageCircle aria-hidden="true" className="size-5" />
                  WhatsApp
                  <span className="sr-only"> (se abre WhatsApp)</span>
                </a>
              </li>
              <li>
                <a href={`tel:${message.phone}`} className={replyLink}>
                  <Phone aria-hidden="true" className="size-5" />
                  {formatColombianPhone(message.phone)}
                </a>
              </li>
            </>
          ) : null}
        </ul>
        {message.handledBy && message.handledAt ? (
          <p className="mt-3 text-sm text-ink-muted">
            Atendido por {message.handledBy} el{" "}
            <time dateTime={message.handledAt}>
              {dateFormat.format(new Date(message.handledAt))}
            </time>
            .
          </p>
        ) : null}
      </section>

      {canManage && !message.inTrash ? (
        <div className="mt-8 border-t pt-6">
          <MessageActions id={message.id} status={message.status} />
        </div>
      ) : null}
    </div>
  );
}
