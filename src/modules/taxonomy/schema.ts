import { z } from "zod";

import { slugify } from "@/lib/utils/slug";

// Places, categories and tags (docs/06 §4). Pure: unit-tested in schema.test.ts.

export const PLACE_KINDS = ["municipality", "neighborhood", "vereda", "sector", "other"] as const;
export type PlaceKind = (typeof PLACE_KINDS)[number];

export const PLACE_KIND_LABELS: Record<PlaceKind, string> = {
  municipality: "Municipio",
  neighborhood: "Barrio",
  vereda: "Vereda",
  sector: "Sector",
  other: "Otro",
};

export const CATEGORY_SCOPES = ["activity", "post"] as const;
export type CategoryScope = (typeof CATEGORY_SCOPES)[number];

export const CATEGORY_SCOPE_LABELS: Record<CategoryScope, string> = {
  activity: "Categorías de actividades",
  post: "Categorías de historias",
};

// Shared with content (activities): lives in lib now
export { slugify } from "@/lib/utils/slug";
const nameField = z
  .string()
  .trim()
  .min(1, "Escribe un nombre.")
  .max(80, "El nombre es demasiado largo (máximo 80 caracteres).")
  .refine((name) => slugify(name) !== "", "El nombre debe tener letras o números.");

const descriptionField = z
  .string()
  .trim()
  .max(300, "La descripción es demasiado larga (máximo 300 caracteres).")
  .transform((text) => (text === "" ? null : text));

const idField = z.uuid();

export const createPlaceSchema = z.object({
  name: nameField,
  kind: z.enum(PLACE_KINDS, { message: "Elige el tipo de lugar." }),
});

export const updatePlaceSchema = createPlaceSchema.extend({
  id: idField,
  // Checkbox: present ("on") when checked, missing when not
  active: z.preprocess((value) => value === "on", z.boolean()),
});

export const createCategorySchema = z.object({
  scope: z.enum(CATEGORY_SCOPES),
  name: nameField,
  description: descriptionField,
});

export const updateCategorySchema = z.object({
  id: idField,
  name: nameField,
  description: descriptionField,
});

export const moveCategorySchema = z.object({
  id: idField,
  direction: z.enum(["up", "down"]),
});

export const trashSchema = z.object({
  table: z.enum(["places", "categories"]),
  id: idField,
});

export type ActionState = {
  error?: string;
  notice?: string;
};

/**
 * New order after moving one item up or down, or null when it cannot move
 * (first item up, last item down, unknown id).
 */
export function moveInOrder<T extends { id: string }>(
  items: readonly T[],
  id: string,
  direction: "up" | "down",
): T[] | null {
  const from = items.findIndex((item) => item.id === id);
  const to = direction === "up" ? from - 1 : from + 1;
  if (from === -1 || to < 0 || to >= items.length) return null;

  const next = [...items];
  [next[from], next[to]] = [next[to]!, next[from]!];
  return next;
}
