import { z } from "zod";

// Shared validation for content (step 7.6a). Pure: unit-tested in schema.test.ts.

/** What the Editor asks to fix when returning content (decision F7-D7). */
export const reviewNoteSchema = z
  .string()
  .trim()
  .min(1, "Escribe qué hay que corregir.")
  .max(1000, "La nota es demasiado larga (máximo 1000 caracteres).");

/** Optional note when retiring published content. */
export const optionalNoteSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  reviewNoteSchema.optional(),
);
