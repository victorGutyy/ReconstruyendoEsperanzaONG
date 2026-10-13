"use client";

import { Menu } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";

import { isCurrent, type SiteNavItem } from "../navigation";

const SITE_NAV_LABEL = "Menú principal";

/** Desktop menu under the masthead. */
export function DesktopNav({
  items,
  support,
}: {
  items: SiteNavItem[];
  support: SiteNavItem | null;
}) {
  const pathname = usePathname();
  if (items.length === 0 && !support) return null;

  return (
    <nav aria-label={SITE_NAV_LABEL} className="hidden md:block">
      <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 py-3">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={isCurrent(pathname, item.href) ? "page" : undefined}
              className="inline-flex min-h-11 items-center font-medium text-ink underline-offset-8 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:font-semibold aria-[current=page]:text-green-900 aria-[current=page]:underline"
            >
              {item.label}
            </Link>
          </li>
        ))}
        {support ? (
          <li>
            <Link
              href={support.href}
              className="inline-flex min-h-11 items-center rounded-md bg-green-700 px-5 font-semibold text-paper outline-none hover:bg-green-900 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {support.label}
            </Link>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}

/** Phone menu: a full-screen panel with large links (docs/07 §5). */
const MobileMenu = dynamic(() => import("./mobile-menu"), { ssr: false });
const loadMobileMenu = () => void import("./mobile-menu");

/**
 * Phone menu button. The dialog (Radix) loads when the button is touched or
 * reached with the keyboard, not on every first visit (step 9.6).
 */
export function MobileNav({
  items,
  support,
}: {
  items: SiteNavItem[];
  support: SiteNavItem | null;
}) {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const links: SiteNavItem[] = [{ href: "/", label: "Inicio", available: true }, ...items];

  return (
    <>
      <button
        ref={opener}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onPointerDown={loadMobileMenu}
        onFocus={loadMobileMenu}
        onClick={() => setOpen(true)}
        className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-green-900 outline-none hover:bg-green-50 focus-visible:ring-2 focus-visible:ring-ring md:hidden"
      >
        <Menu aria-hidden="true" className="size-6" />
        <span className="sr-only">Abrir menú</span>
      </button>
      {open ? (
        <MobileMenu
          links={links}
          support={support}
          label={SITE_NAV_LABEL}
          onClose={() => setOpen(false)}
          opener={opener}
        />
      ) : null}
    </>
  );
}
