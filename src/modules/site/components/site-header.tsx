import { Search } from "lucide-react";
import Link from "next/link";

import { MastheadLogo } from "@/components/brand-logo";

import { isPending, type SiteSettings } from "@/modules/settings";

import { availableOnly, SITE_NAV, SUPPORT_LINK, todayInColombia } from "../navigation";
import { DesktopNav, MobileNav } from "./site-nav";

/** Masthead of the public site (docs/07 §6.1–6.2). */
export function SiteHeader({ settings }: { settings: SiteSettings }) {
  const items = availableOnly(SITE_NAV);
  const support = SUPPORT_LINK.available ? SUPPORT_LINK : null;
  const tagline = isPending(settings.tagline) ? null : settings.tagline;

  return (
    <header className="border-b bg-paper">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-card focus:px-4 focus:py-3 focus:font-semibold focus:text-green-900 focus:ring-2 focus:ring-ring"
      >
        Saltar al contenido
      </a>
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex items-center justify-between gap-3 border-b">
          <p className="py-2 text-xs font-semibold tracking-[0.12em] text-gold-700 uppercase">
            Calarcá, Quindío · <span className="normal-case">{todayInColombia()}</span>
          </p>
          <Link
            href="/buscar"
            aria-label="Buscar en el sitio"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-green-900 outline-none hover:bg-green-50 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Search aria-hidden="true" className="size-5" />
          </Link>
        </div>
        <div className="flex items-center justify-between gap-3 border-b-[3px] border-double border-gold-500 py-4 md:justify-center md:py-6">
          <div className="min-w-0 md:text-center">
            <Link
              href="/"
              className="inline-block rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <MastheadLogo name={settings.organizationName} />
            </Link>
            {tagline ? <p className="mt-1 text-sm text-ink-muted md:text-base">{tagline}</p> : null}
          </div>
          <MobileNav items={items} support={support} />
        </div>
        <DesktopNav items={items} support={support} />
      </div>
    </header>
  );
}
