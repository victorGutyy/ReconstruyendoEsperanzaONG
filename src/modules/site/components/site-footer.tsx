import Link from "next/link";

import {
  formatColombianPhone,
  SOCIAL_KEYS,
  SOCIAL_NETWORKS,
  type SiteSettings,
} from "@/modules/settings";

import { availableOnly, FOOTER_LINKS } from "../navigation";

const footerLink = "inline-flex min-h-11 items-center underline underline-offset-4";

/** Footer: contact details, networks, legal pages (docs/07 §5). */
export function SiteFooter({ settings }: { settings: SiteSettings }) {
  const networks = SOCIAL_KEYS.filter((key) => settings.socialLinks[key]);
  const links = availableOnly(FOOTER_LINKS);

  return (
    // Room at the bottom so the floating WhatsApp button never covers a link
    <footer className="mt-16 border-t-[3px] border-double border-gold-500 bg-paper-2 pb-20">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-3">
        <div>
          <p className="font-serif text-xl font-semibold text-green-900">
            {settings.organizationName}
          </p>
          <p className="mt-1 text-sm text-ink-muted">Calarcá, Quindío</p>
        </div>

        {settings.contactEmail || settings.phone ? (
          <section aria-labelledby="footer-contact">
            <h2 id="footer-contact" className="font-semibold text-green-900">
              Contacto
            </h2>
            <ul className="mt-2 grid gap-1 text-sm">
              {settings.contactEmail ? (
                <li>
                  <a href={`mailto:${settings.contactEmail}`} className={footerLink}>
                    {settings.contactEmail}
                  </a>
                </li>
              ) : null}
              {settings.phone ? (
                <li>
                  <a href={`tel:${settings.phone}`} className={footerLink}>
                    {formatColombianPhone(settings.phone)}
                  </a>
                </li>
              ) : null}
            </ul>
          </section>
        ) : null}

        {networks.length > 0 ? (
          <section aria-labelledby="footer-networks">
            <h2 id="footer-networks" className="font-semibold text-green-900">
              Redes
            </h2>
            <ul className="mt-2 flex flex-wrap gap-x-4 text-sm">
              {networks.map((key) => (
                <li key={key}>
                  <a
                    href={settings.socialLinks[key]}
                    rel="noopener noreferrer"
                    target="_blank"
                    className={footerLink}
                  >
                    {SOCIAL_NETWORKS[key].label}
                    <span className="sr-only"> (se abre en otra pestaña)</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      <div className="border-t">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-4 text-sm text-ink-muted">
          {links.length > 0 ? (
            <ul className="flex flex-wrap gap-x-4">
              {links.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className={footerLink}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
          <p>Hecho en Calarcá</p>
        </div>
      </div>
    </footer>
  );
}
