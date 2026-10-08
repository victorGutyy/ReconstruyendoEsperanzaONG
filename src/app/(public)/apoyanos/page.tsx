import { Mail, MessageCircle } from "lucide-react";
import type { Metadata } from "next";

import { PublicPageBody } from "@/modules/pages/components/public-page";
import { getPublicPage } from "@/modules/pages/public";
import { PAGE_ADDRESSES } from "@/modules/pages/schema";
import { getSiteSettings } from "@/modules/settings";
import { Breadcrumbs, whatsappHref } from "@/modules/site";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPublicPage("support");
  return {
    title: page?.seoTitle ?? "Apóyanos",
    description: page?.seoDescription ?? undefined,
    alternates: { canonical: PAGE_ADDRESSES.support },
  };
}

const action =
  "inline-flex min-h-11 items-center gap-2 rounded-md px-5 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

/** Ways to help (RF-A-10). No payment gateway: people get in touch. */
export default async function SupportPage() {
  const [page, settings] = await Promise.all([getPublicPage("support"), getSiteSettings()]);
  const hasContact = Boolean(settings.whatsappNumber || settings.contactEmail);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Breadcrumbs items={[{ href: "/", label: "Inicio" }, { label: "Apóyanos" }]} />
      <h1 className="mt-4 font-serif text-4xl font-semibold text-green-900 md:text-5xl">
        {page?.title ?? "Apóyanos"}
      </h1>
      <PublicPageBody page={page} />

      {hasContact ? (
        <section
          aria-labelledby="support-contact"
          className="mt-10 rounded-sm border-t-[3px] border-double border-gold-500 bg-paper-2 p-5"
        >
          <h2 id="support-contact" className="font-serif text-xl font-semibold text-green-900">
            ¿Quieres sumarte?
          </h2>
          <p className="mt-1 text-ink-muted">Escríbenos y te contamos cómo puedes ayudar.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            {settings.whatsappNumber ? (
              <a
                href={whatsappHref(settings.whatsappNumber, settings.organizationName)}
                target="_blank"
                rel="noopener noreferrer"
                className={`${action} bg-green-700 text-paper hover:bg-green-900`}
              >
                <MessageCircle aria-hidden="true" className="size-5" />
                Escribir por WhatsApp
                <span className="sr-only"> (se abre WhatsApp)</span>
              </a>
            ) : null}
            {settings.contactEmail ? (
              <a
                href={`mailto:${settings.contactEmail}`}
                className={`${action} border bg-card text-green-900 hover:border-green-700`}
              >
                <Mail aria-hidden="true" className="size-5" />
                Escribir un correo
              </a>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
