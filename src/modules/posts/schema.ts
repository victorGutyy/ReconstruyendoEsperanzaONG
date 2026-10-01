import { z } from "zod";

import { validateRichText } from "@/lib/rich-text/schema";
import { type CheckItem, coverCheck, reviewOutcome } from "@/modules/content/shared";
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

export type PostReviewInput = {
  excerpt: string | null;
  categoryId: string | null;
  /** null = no cover; otherwise what the cover still needs (codes). */
  coverIssues: readonly string[] | null;
};

/** Before sending or publishing: excerpt and category are required. */
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
  items.push(coverCheck("post", input.coverIssues, publisher));
  return reviewOutcome(items, publisher);
}
