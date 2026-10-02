import { z } from "zod";

import {
  type CheckItem,
  coverCheck,
  ownerColumns,
  ownerSchema,
  reviewOutcome,
} from "@/modules/content/shared";

// Testimonials (step 7.6d, docs/06 §5). Pure: unit-tested in schema.test.ts.

export const TESTIMONIALS_PATH = "/admin/contenido/testimonios";

/** What the editor form holds. The authorization is required. */
export type TestimonialValues = {
  quote: string;
  authorName: string;
  authorContext: string;
  consentId: string;
  owner: string;
};

export const testimonialSchema = z
  .object({
    quote: z
      .string()
      .trim()
      .min(1, "Escribe lo que dijo la persona.")
      .max(600, "El testimonio es demasiado largo (máximo 600 caracteres)."),
    authorName: z
      .string()
      .trim()
      .min(1, "Escribe cómo se muestra el nombre (por ejemplo, solo el nombre o las iniciales).")
      .max(80, "El nombre es demasiado largo (máximo 80 caracteres)."),
    authorContext: z
      .string()
      .trim()
      .max(160, "El contexto es demasiado largo (máximo 160 caracteres).")
      .transform((text) => (text === "" ? null : text)),
    consentId: z.uuid({ message: "Elige la autorización de la persona." }),
    owner: ownerSchema,
  })
  .transform((data) => ({
    quote: data.quote,
    author_display_name: data.authorName,
    author_context: data.authorContext,
    consent_record_id: data.consentId,
    ...ownerColumns(data.owner),
  }));

export type TestimonialInput = z.input<typeof testimonialSchema>;

/**
 * Before sending or publishing: the authorization must be usable for
 * everyone (it is the person's voice); the photo is optional.
 */
export function reviewTestimonial(
  input: { consentUsable: boolean; coverIssues: readonly string[] | null },
  publisher: boolean,
) {
  const items: CheckItem[] = [
    input.consentUsable
      ? { key: "consent", level: "ok", text: "La autorización de la persona está vigente." }
      : {
          key: "consent",
          level: "error",
          text: "La autorización de la persona está revocada o vencida: elige otra o registra una nueva.",
        },
    coverCheck("testimonial", input.coverIssues, publisher),
  ];
  return reviewOutcome(items, publisher);
}
