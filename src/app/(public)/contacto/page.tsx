import { Mail, MessageCircle, Phone } from "lucide-react";
import type { Metadata } from "next";

import { getServerEnv, isLocalRuntime } from "@/lib/env/server";
import { turnstileSiteKey } from "@/lib/turnstile";
import { ContactForm } from "@/modules/contact/components/contact-form";
import { CONTACT_PATH } from "@/modules/contact/schema";
import { getPublicPage, PAGE_ADDRESSES } from "@/modules/pages";
import { formatColombianPhone, getSiteSettings } from "@/modules/settings";
import { Breadcrumbs, whatsappHref } from "@/modules/site";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Contacto",
  description: "Escríbenos para ofrecer ayuda, sumarte como voluntario o pedir información.",
  alternates: { canonical: CONTACT_PATH },
};

const contactLink =
  "inline-flex min-h-11 items-center gap-2 font-medium text-green-700 underline underline-offset-4";

/** Contact (RF-A-09, HU-03): the form, and the other ways to reach the organization. */
export default async function ContactPage() {
  const [settings, policy] = await Promise.all([
    getSiteSettings(),
    getPublicPage("privacy-policy"),
  ]);
  const siteKey = turnstileSiteKey();
  const hashReady = Boolean(getServerEnv().CONTACT_IP_HASH_SECRET) || isLocalRuntime();
  // No published policy, no authorization can be asked (docs/09); no keys, no form
  const open = Boolean(policy?.version && siteKey && hashReady);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Breadcrumbs items={[{ href: "/", label: "Inicio" }, { label: "Contacto" }]} />
      <h1 className="mt-4 font-serif text-4xl font-semibold text-green-900 md:text-5xl">
        Contacto
      </h1>
      <p className="mt-2 text-ink-muted">
        Escríbenos para ofrecer ayuda, sumarte como voluntario o pedir información.
      </p>

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section aria-labelledby="form-title">
          <h2 id="form-title" className="sr-only">
            Formulario de contacto
          </h2>
          {open && siteKey ? (
            <ContactForm
              siteKey={siteKey}
              policyHref={PAGE_ADDRESSES["privacy-policy"]}
              noticeHref={PAGE_ADDRESSES["privacy-notice"]}
            />
          ) : (
            <p className="rounded-sm border bg-card p-5 text-ink-muted">
              El formulario se habilitará cuando esté publicada la política de tratamiento de datos.
              Mientras tanto, puedes escribirnos por los medios de la derecha.
            </p>
          )}
        </section>

        <aside aria-labelledby="channels-title" className="grid content-start gap-4">
          <h2 id="channels-title" className="font-serif text-xl font-semibold text-green-900">
            Otros medios
          </h2>
          <ul className="grid gap-1">
            {settings.whatsappNumber ? (
              <li>
                <a
                  href={whatsappHref(settings.whatsappNumber, settings.organizationName)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={contactLink}
                >
                  <MessageCircle aria-hidden="true" className="size-5" />
                  WhatsApp
                  <span className="sr-only"> (se abre WhatsApp)</span>
                </a>
              </li>
            ) : null}
            {settings.contactEmail ? (
              <li>
                <a href={`mailto:${settings.contactEmail}`} className={contactLink}>
                  <Mail aria-hidden="true" className="size-5" />
                  {settings.contactEmail}
                </a>
              </li>
            ) : null}
            {settings.phone ? (
              <li>
                <a href={`tel:${settings.phone}`} className={contactLink}>
                  <Phone aria-hidden="true" className="size-5" />
                  {formatColombianPhone(settings.phone)}
                </a>
              </li>
            ) : null}
          </ul>
          <p className="rounded-sm bg-paper-2 p-4 text-sm text-ink-muted">
            Usamos tus datos solo para responder tu mensaje. Puedes consultar el aviso de privacidad
            y la política de tratamiento de datos en el pie de página.
          </p>
        </aside>
      </div>
    </div>
  );
}
