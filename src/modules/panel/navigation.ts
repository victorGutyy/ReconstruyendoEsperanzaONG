// Panel menu: pure rules, unit-tested in navigation.test.ts (docs/07 §6.6).

import { ADMIN_HOME, hasPermission, type Permission, type ProfileAccess } from "@/lib/auth/rules";

export type NavIcon =
  "home" | "calendar" | "book" | "image" | "shield" | "tags" | "users" | "history";

export type NavItem = {
  href: string;
  label: string;
  /** Shown on the dashboard cards. */
  description: string;
  icon: NavIcon;
  /** Without it, every signed-in member sees the item. */
  permission?: Permission;
};

// Only sections that already exist: no disabled or "coming soon" items (docs/07).
// New sections are added here as each phase delivers them.
export const PANEL_NAV: readonly NavItem[] = [
  {
    href: ADMIN_HOME,
    label: "Inicio",
    description: "Resumen del panel.",
    icon: "home",
  },
  {
    href: "/admin/actividades",
    label: "Actividades",
    description: "Crear y publicar las actividades de la organización, con sus fotos.",
    icon: "calendar",
    permission: "content.read",
  },
  {
    href: "/admin/contenido",
    label: "Contenido",
    description: "Historias, proyectos, galerías, videos y el resto del contenido del sitio.",
    icon: "book",
    permission: "content.read",
  },
  {
    href: "/admin/medios",
    label: "Medios",
    description: "Subir fotos desde el celular, sin ubicación ni datos ocultos.",
    icon: "image",
    permission: "media.upload",
  },
  {
    href: "/admin/autorizaciones",
    label: "Autorizaciones",
    description: "Autorizaciones firmadas de uso de imagen: registrar, consultar y revocar.",
    icon: "shield",
    permission: "consent.manage",
  },
  {
    href: "/admin/categorias-y-lugares",
    label: "Categorías y lugares",
    description: "Lugares generales y categorías para clasificar el contenido.",
    icon: "tags",
    permission: "taxonomy.manage",
  },
  {
    href: "/admin/usuarios",
    label: "Usuarios",
    description: "Invitar personas, cambiar roles y desactivar cuentas.",
    icon: "users",
    permission: "users.manage",
  },
  {
    href: "/admin/auditoria",
    label: "Auditoría",
    description: "Quién cambió qué y cuándo.",
    icon: "history",
    permission: "audit.read",
  },
];

/** The items this profile may open. The pages check the permission again. */
export function navFor(profile: ProfileAccess): NavItem[] {
  return PANEL_NAV.filter((item) => !item.permission || hasPermission(profile, item.permission));
}

/** Inicio only matches itself; a section also matches its sub-pages. */
export function isActivePath(pathname: string, href: string): boolean {
  if (href === ADMIN_HOME) return pathname === ADMIN_HOME;
  return pathname === href || pathname.startsWith(`${href}/`);
}
