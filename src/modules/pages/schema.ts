import { z } from "zod";

import { validateRichText } from "@/lib/rich-text/schema";
import { type CheckItem, reviewOutcome } from "@/modules/content/shared";
import type { Json } from "@/types/database";

// Institutional and legal pages (step 7.6e, docs/06 §5). Pure: unit-tested in
// schema.test.ts.

export const PAGES_PATH = "/admin/contenido/paginas";

export const PAGE_KEYS = ["about", "support", "privacy-policy", "privacy-notice"] as const;
export type PageKey = (typeof PAGE_KEYS)[number];

/** Legal pages: Administrator only, every publication versioned. */
export const isLegalPage = (key: PageKey) => key === "privacy-policy" || key === "privacy-notice";

/** Where each page lives on the public site (docs/07 §5 site map, step 8.5). */
export const PAGE_ADDRESSES: Record<PageKey, string> = {
  about: "/quienes-somos",
  support: "/apoyanos",
  "privacy-policy": "/legal/politica-de-datos",
  "privacy-notice": "/legal/aviso-de-privacidad",
};

const PENDING = "[PENDIENTE";

/** Still has a [PENDIENTE: …] marker somewhere: never published. */
export const hasPendingText = (title: string, bodyText: string | null) =>
  `${title} ${bodyText ?? ""}`.toUpperCase().includes(PENDING);

/** What the editor form holds. `version` only matters for legal pages. */
export type PageValues = { title: string; body: unknown; version: string };

export const pageSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Escribe el título de la página.")
      .max(160, "El título es demasiado largo (máximo 160 caracteres)."),
    body: z.unknown(),
    version: z
      .string()
      .trim()
      .max(40, "La versión es demasiado larga (máximo 40 caracteres).")
      .transform((text) => (text === "" ? null : text)),
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
      // Validated above against the closed allow-list: safe to store as JSON
      body: doc as unknown as Json | null,
      body_text: body.ok && !body.isEmpty ? body.text : null,
      version: data.version,
    };
  });

export type PageInput = z.input<typeof pageSchema>;

/**
 * Before sending or publishing: no [PENDIENTE markers, and a legal page needs
 * a version that was never published before.
 */
export function reviewPage(
  input: {
    key: PageKey;
    title: string;
    bodyText: string | null;
    version: string | null;
    publishedVersions: readonly string[];
  },
  publisher: boolean,
) {
  const items: CheckItem[] = [];
  items.push(
    hasPendingText(input.title, input.bodyText)
      ? {
          key: "pending",
          level: "error",
          text: "La página todavía tiene texto [PENDIENTE: …]: reemplázalo por el texto aprobado.",
        }
      : !input.bodyText?.trim()
        ? { key: "pending", level: "error", text: "La página no tiene texto." }
        : { key: "pending", level: "ok", text: "El texto está completo." },
  );
  if (isLegalPage(input.key)) {
    items.push(
      !input.version
        ? {
            key: "version",
            level: "error",
            text: "Escribe la versión del documento (por ejemplo, 1.0).",
          }
        : input.publishedVersions.includes(input.version)
          ? {
              key: "version",
              level: "error",
              text: `La versión ${input.version} ya se publicó: usa una versión nueva.`,
            }
          : { key: "version", level: "ok", text: `Se publicará como la versión ${input.version}.` },
    );
  }
  return reviewOutcome(items, publisher);
}
