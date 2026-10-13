"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dialog } from "radix-ui";
import type { RefObject } from "react";

import { cn } from "@/lib/utils";

import { isCurrent, type SiteNavItem } from "../navigation";

// The phone menu itself (step 9.6): loaded only when someone opens it, so the
// dialog library is not part of every first visit (docs/07 §10).

export default function MobileMenu({
  links,
  support,
  label,
  onClose,
  opener,
}: {
  links: SiteNavItem[];
  support: SiteNavItem | null;
  label: string;
  onClose: () => void;
  /** The "Abrir menú" button: it gets the focus back on close. */
  opener: RefObject<HTMLButtonElement | null>;
}) {
  const pathname = usePathname();
  const setOpen = (open: boolean) => {
    if (!open) onClose();
  };

  return (
    <Dialog.Root open onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Content
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            opener.current?.focus();
          }}
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
          <nav aria-label={label}>
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
