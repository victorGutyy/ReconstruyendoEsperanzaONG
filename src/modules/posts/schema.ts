import { z } from "zod";

import { validateRichText } from "@/lib/rich-text/schema";
import type { Json } from "@/types/database";

// Stories (posts, step 7.6a, docs/06 §5). Pure: unit-tested in schema.test.ts.

export const POSTS_PATH = "/admin/contenido/historias";

/** What the editor form holds. */
export type PostValues = {
  title: string;
  excerpt: string;
  categoryId: string;
  byline: string;
  body: unknown;
};

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((text) => (text === "" ? null : text));

/** Category and excerpt may be empty in a draft; they are required to publish. */
export const postSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Escribe el título de la historia.")
      .max(160, "El título es demasiado largo (máximo 160 caracteres)."),
    excerpt: optionalText(300, "El extracto es demasiado largo (máximo 300 caracteres)."),
    categoryId: z.preprocess(
      (value) => (value === "" || value === null ? null : value),
      z.uuid().nullable(),
    ),
    // Empty = no signature on the site (decision 7.6a), never an invented name
    byline: optionalText(120, "La firma es demasiado larga (máximo 120 caracteres)."),
    body: z.unknown(),
  })
  .superRefine((data, context) => {
    const body = validateRichText(data.body ?? { type: "doc", content: [] });
    if (!body.ok) context.addIssue({ code: "custom", path: ["body"], message: body.error });
  })
  .transform((data) => {
    const body = validateRichText(data.body ?? { type: "doc", content: [] });
    const doc = body.ok && !body.isEmpty ? body.doc : null;
    return {
      title: data.title,
      excerpt: data.excerpt,
      category_id: data.categoryId,
      byline: data.byline,
      // Validated above against the closed allow-list: safe to store as JSON
      body: doc as unknown as Json | null,
      body_text: body.ok && !body.isEmpty ? body.text : null,
    };
  });

export type PostInput = z.input<typeof postSchema>;

export type CheckLevel = "ok" | "warn" | "error";
export type CheckItem = { key: string; level: CheckLevel; text: string };

export type PostReviewInput = {
  excerpt: string | null;
  categoryId: string | null;
  /** null = no cover; otherwise what the cover still needs (codes). */
  coverIssues: readonly string[] | null;
};

const COVER_ISSUES: Record<string, string> = {
  in_trash: "la foto está en la papelera",
  not_processed: "la foto no terminó de procesarse",
  missing_alt_text: "falta su descripción",
  people_unclassified: "falta indicar si aparecen personas",
  missing_consent: "aparecen personas y falta su autorización",
  missing_guardian_consent: "hay menores y falta la autorización de su representante",
};

/**
 * Before sending or publishing (same idea as the activity wizard): red blocks,
 * yellow warns. Authors may send with a cover that still needs something;
 * editors cannot publish it. The database checks everything again.
 */
export function reviewPost(input: PostReviewInput, publisher: boolean) {
  const items: CheckItem[] = [];

  if (!input.excerpt?.trim()) {
    items.push({
      key: "excerpt",
      level: "error",
      text: "Falta el extracto (se ve en las tarjetas).",
    });
  }
  if (!input.categoryId) {
    items.push({ key: "category", level: "error", text: "Falta la categoría." });
  }
  if (input.excerpt?.trim() && input.categoryId) {
    items.push({ key: "basics", level: "ok", text: "El extracto y la categoría están listos." });
  }

  if (input.coverIssues === null) {
    items.push({
      key: "no-cover",
      level: "warn",
      text: "La historia no tiene portada. Se puede publicar, pero una foto ayuda a contarla.",
    });
  } else if (input.coverIssues.length > 0) {
    const reasons = input.coverIssues.map((code) => COVER_ISSUES[code] ?? "tiene un pendiente");
    items.push({
      key: "cover",
      level: publisher ? "error" : "warn",
      text: `La portada no se puede publicar todavía: ${reasons.join("; ")}.`,
    });
  } else {
    items.push({ key: "cover", level: "ok", text: "La portada está lista para publicarse." });
  }

  const blocking = items.filter((item) => item.level === "error");
  return {
    items,
    canSubmit: blocking.length === 0,
    canPublish: publisher && blocking.length === 0,
  };
}
