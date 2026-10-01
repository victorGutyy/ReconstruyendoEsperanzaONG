"use client";

import {
  BookOpen,
  CalendarDays,
  History,
  House,
  Image,
  Menu,
  Plus,
  ShieldCheck,
  Tags,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dialog } from "radix-ui";
import { useState } from "react";

import { cn } from "@/lib/utils";

import { isActivePath, type NavIcon, type NavItem } from "../navigation";

const ICONS: Record<NavIcon, typeof House> = {
  home: House,
  calendar: CalendarDays,
  book: BookOpen,
  image: Image,
  shield: ShieldCheck,
  tags: Tags,
  users: Users,
  history: History,
};

export const NAV_LABEL = "Menú del panel";

function NavLinks({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label={NAV_LABEL}>
      <ul className="grid gap-1">
        {items.map((item) => {
          const Icon = ICONS[item.icon];
          const active = isActivePath(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-md px-3 font-medium text-ink outline-none",
                  "hover:bg-green-50 focus-visible:ring-2 focus-visible:ring-ring",
                  active && "bg-green-50 font-semibold text-green-900",
                )}
              >
                <Icon aria-hidden="true" className="size-5 shrink-0" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Desktop sidebar menu. */
export function SidebarNav({ items }: { items: NavItem[] }) {
  return <NavLinks items={items} />;
}

/**
 * Phone bottom bar (docs/07 §6.6): Inicio and "Más", which opens the full menu
 * in a sheet. The frequent actions (new activity, messages) join as they exist.
 */
export function MobileBar({
  items,
  footer,
  quickAction,
}: {
  items: NavItem[];
  footer: React.ReactNode;
  /** Frequent action next to Inicio (docs/07 §6.6), e.g. "Nueva actividad". */
  quickAction?: { href: string; label: string };
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const homeActive = isActivePath(pathname, "/admin");

  const tab =
    "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset";

  return (
    <nav
      aria-label="Accesos rápidos"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <div className="flex">
        <Link
          href="/admin"
          aria-current={homeActive ? "page" : undefined}
          className={cn(tab, homeActive ? "text-green-900" : "text-ink-muted")}
        >
          <House aria-hidden="true" className="size-5" />
          Inicio
        </Link>

        {quickAction ? (
          <Link
            href={quickAction.href}
            aria-current={isActivePath(pathname, quickAction.href) ? "page" : undefined}
            className={cn(tab, "text-green-700")}
          >
            <Plus aria-hidden="true" className="size-5" />
            {quickAction.label}
          </Link>
        ) : null}

        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger className={cn(tab, "cursor-pointer text-ink-muted")}>
            <Menu aria-hidden="true" className="size-5" />
            Más
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
            <Dialog.Content
              aria-describedby={undefined}
              className="fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-lg border-t bg-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom"
            >
              <div className="mb-3 flex items-center justify-between">
                <Dialog.Title className="font-serif text-xl font-semibold text-green-900">
                  Menú
                </Dialog.Title>
                <Dialog.Close
                  aria-label="Cerrar menú"
                  className="flex size-11 cursor-pointer items-center justify-center rounded-md outline-none hover:bg-green-50 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X aria-hidden="true" className="size-5" />
                </Dialog.Close>
              </div>
              <NavLinks items={items} onNavigate={() => setOpen(false)} />
              <div className="mt-4 border-t pt-4">{footer}</div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    </nav>
  );
}
