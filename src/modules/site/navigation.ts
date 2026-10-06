// Public site menu (step 8.1, docs/07 §5): pure, unit-tested in navigation.test.ts.
// Like the panel, only sections that already exist are shown: each step of
// the F8 turns its own on, so visitors never meet a broken link.

export type SiteNavItem = { href: string; label: string; available: boolean };

/** Main menu, in the order of docs/07 §5. */
export const SITE_NAV: readonly SiteNavItem[] = [
  { href: "/actividades", label: "Actividades", available: true },
  { href: "/historias", label: "Historias", available: false },
  { href: "/proyectos", label: "Proyectos", available: false },
  { href: "/memoria", label: "Memoria", available: false },
  { href: "/galeria", label: "Galería", available: false },
  { href: "/quienes-somos", label: "Quiénes somos", available: false },
  { href: "/contacto", label: "Contacto", available: false },
];

/** The highlighted button of the header. */
export const SUPPORT_LINK: SiteNavItem = { href: "/apoyanos", label: "Apóyanos", available: false };

/** Footer links that are not in the main menu. */
export const FOOTER_LINKS: readonly SiteNavItem[] = [
  { href: "/videos", label: "Videos", available: false },
  { href: "/legal/politica-de-datos", label: "Política de tratamiento de datos", available: false },
  { href: "/legal/aviso-de-privacidad", label: "Aviso de privacidad", available: false },
];

export const availableOnly = (items: readonly SiteNavItem[]) =>
  items.filter((item) => item.available);

/** A section also matches its own pages (/actividades/x is under Actividades). */
export function isCurrent(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** wa.me link with a short greeting already written (docs/07 §7). */
export function whatsappHref(e164: string, organizationName: string): string {
  const text = `Hola, ${organizationName}. Les escribo desde el sitio web.`;
  return `https://wa.me/${e164.replace(/^\+/, "")}?text=${encodeURIComponent(text)}`;
}

const DATE_FORMAT = new Intl.DateTimeFormat("es-CO", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "America/Bogota",
});

/** "lunes, 5 de octubre de 2026", in Colombia whatever the server's zone. */
export const todayInColombia = (now = new Date()) => DATE_FORMAT.format(now);
