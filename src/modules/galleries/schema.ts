import { z } from "zod";

import { type CheckItem, ownerColumns, ownerSchema, reviewOutcome } from "@/modules/content/shared";

export { ownerValue } from "@/modules/content/shared";

// Galleries (step 7.6c, docs/06 §5). Pure: unit-tested in schema.test.ts.

export const GALLERIES_PATH = "/admin/contenido/galerias";

/**
 * What the editor form holds. `owner` is "" (none), "activity:<id>" or
 * "project:<id>": a gallery belongs to one of them at most.
 */
export type GalleryValues = { title: string; description: string; owner: string };

export const gallerySchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Escribe el título de la galería.")
      .max(160, "El título es demasiado largo (máximo 160 caracteres)."),
    description: z
      .string()
      .trim()
      .max(1000, "La descripción es demasiado larga (máximo 1000 caracteres).")
      .transform((text) => (text === "" ? null : text)),
    owner: ownerSchema,
  })
  .transform((data) => ({
    title: data.title,
    description: data.description,
    ...ownerColumns(data.owner),
  }));

export type GalleryInput = z.input<typeof gallerySchema>;

export type ReviewPhoto = { label: string; processing: boolean; issues: readonly string[] };

const PHOTO_ISSUES: Record<string, (label: string) => string> = {
  missing_alt_text: (label) => `${label}: falta la descripción.`,
  people_unclassified: (label) => `${label}: indica si aparecen personas reconocibles.`,
  missing_consent: (label) => `${label}: aparecen personas y falta su autorización.`,
  missing_guardian_consent: (label) =>
    `${label}: hay menores y falta la autorización de su representante.`,
  in_trash: (label) => `${label}: está en la papelera.`,
};

/**
 * Before sending or publishing: at least one photo, all of them publishable.
 * Authors may send photos that still need an authorization (yellow); editors
 * cannot publish them (red). Unfinished uploads stop everyone.
 */
export function reviewGallery(photos: readonly ReviewPhoto[], publisher: boolean) {
  const items: CheckItem[] = [];
  if (photos.length === 0) {
    items.push({ key: "no-photos", level: "error", text: "La galería no tiene fotos." });
  }
  let problems = 0;
  for (const [index, photo] of photos.entries()) {
    if (photo.processing) {
      problems += 1;
      items.push({
        key: `processing:${index}`,
        level: "error",
        text: `${photo.label}: no terminó de subir. Quítala o vuelve a subirla.`,
      });
      continue;
    }
    for (const code of photo.issues) {
      const text = PHOTO_ISSUES[code];
      if (!text) continue;
      problems += 1;
      items.push({
        key: `${code}:${index}`,
        level: publisher ? "error" : "warn",
        text: text(photo.label),
      });
    }
  }
  if (photos.length > 0 && problems === 0) {
    items.push({
      key: "photos",
      level: "ok",
      text:
        photos.length === 1
          ? "La foto está lista para publicarse."
          : `Las ${photos.length} fotos están listas para publicarse.`,
    });
  }
  return reviewOutcome(items, publisher);
}
