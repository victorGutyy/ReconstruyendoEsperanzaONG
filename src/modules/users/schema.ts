import { z } from "zod";

export const ROLE_KEYS = ["admin", "editor", "author"] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];

export const ROLE_LABELS: Record<RoleKey, string> = {
  admin: "Administrador",
  editor: "Editor",
  author: "Autor",
};

/** Label for a role key read from the database ("Sin rol" when missing or unknown). */
export function roleLabel(roleKey: string | null): string {
  return roleKey !== null && Object.hasOwn(ROLE_LABELS, roleKey)
    ? ROLE_LABELS[roleKey as RoleKey]
    : "Sin rol";
}

const roleField = z.enum(ROLE_KEYS, { message: "Elige un rol." });

export const inviteSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ message: "Escribe un correo válido." }).max(254)),
  fullName: z
    .string()
    .trim()
    .min(1, "Escribe el nombre de la persona.")
    .max(120, "El nombre es demasiado largo."),
  role: roleField,
});

export const changeRoleSchema = z.object({
  userId: z.uuid(),
  role: roleField,
});

export const setActiveSchema = z.object({
  userId: z.uuid(),
  active: z.enum(["true", "false"]).transform((value) => value === "true"),
});

export type ActionState = {
  error?: string;
  notice?: string;
};
