// Panel menu: pure rules, unit-tested in navigation.test.ts (docs/07 §6.6).

import { ADMIN_HOME, hasPermission, type Permission, type ProfileAccess } from "@/lib/auth/rules";

export type NavIcon = "home" | "users" | "history";

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
