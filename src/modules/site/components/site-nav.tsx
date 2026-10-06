"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dialog } from "radix-ui";
import { useState } from "react";

import { cn } from "@/lib/utils";

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
export function MobileNav({
  items,
  support,
}: {
  items: SiteNavItem[];
  support: SiteNavItem | null;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const links: SiteNavItem[] = [{ href: "/", label: "Inicio", available: true }, ...items];

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-green-900 outline-none hover:bg-green-50 focus-visible:ring-2 focus-visible:ring-ring md:hidden">
        <Menu aria-hidden="true" className="size-6" />
        <span className="sr-only">Abrir menú</span>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-50 overflow-y-auto bg-paper p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
        >
          <div className="flex items-center justify-between border-b-[3px] border-double border-gold-500 pb-3">
            <Dialog.Title className="font-serif text-xl font-semibold text-green-900">
              Menú
            </Dialog.Title>
            <Dialog.Close className="flex size-11 cursor-pointer items-center justify-center rounded-md outline-none hover:bg-green-50 focus-visible:ring-2 focus-visible:ring-ring">
              <X aria-hidden="true" className="size-6" />
              <span className="sr-only">Cerrar menú</span>
            </Dialog.Close>
          </div>
          <nav aria-label={SITE_NAV_LABEL}>
            <ul className="mt-4 grid gap-1">
              {links.map((item) => {
                const current =
                  item.href === "/" ? pathname === "/" : isCurrent(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      aria-current={current ? "page" : undefined}
                      className={cn(
                        "flex min-h-14 items-center rounded-md px-3 font-serif text-2xl text-ink outline-none hover:bg-green-50 focus-visible:ring-2 focus-visible:ring-ring",
                        current && "bg-green-50 font-semibold text-green-900",
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
            {support ? (
              <Link
                href={support.href}
                onClick={() => setOpen(false)}
                className="mt-6 flex min-h-14 items-center justify-center rounded-md bg-green-700 text-lg font-semibold text-paper outline-none hover:bg-green-900 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {support.label}
              </Link>
            ) : null}
          </nav>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
