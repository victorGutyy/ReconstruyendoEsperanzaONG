// Step 4 · Revisar y publicar (docs/07 §6.5). Pure: unit-tested in review.test.ts.
//
// Red blocks the action; yellow is a warning. Authors may send to review with
// warnings about descriptions and authorizations (decision of 26-sep-2026);
// only incomplete basic data and unfinished uploads stop them. Editors cannot
// publish while anything is red. The database checks HU-06 and RN-A-02 again.

import type { WizardStep } from "./schema";

export type CheckLevel = "ok" | "warn" | "error";

export type CheckItem = {
  key: string;
  level: CheckLevel;
  text: string;
  /** Where "Resolver" leads. */
  step: WizardStep;
};

export type ReviewPhoto = {
  mediaId: string;
  /** "Foto 3" or its description, for messages. */
  label: string;
  processing: boolean;
  issues: readonly string[];
};

export type ReviewInput = {
  placeId: string | null;
  categoryId: string | null;
  photos: readonly ReviewPhoto[];
};

export type Review = {
  items: CheckItem[];
  /** Author: "Enviar a revisión" allowed. */
  canSubmit: boolean;
  /** Editor/Admin: "Publicar" allowed. */
  canPublish: boolean;
};

const PHOTO_ISSUES: Record<string, { text: (label: string) => string; step: WizardStep }> = {
  missing_alt_text: { text: (label) => `${label}: falta la descripción.`, step: 2 },
  people_unclassified: {
    text: (label) => `${label}: indica si aparecen personas reconocibles.`,
    step: 3,
  },
  missing_consent: {
    text: (label) => `${label}: aparecen personas y falta su autorización.`,
    step: 3,
  },
  missing_guardian_consent: {
    text: (label) => `${label}: hay menores y falta la autorización de su representante.`,
    step: 3,
  },
};

export function reviewActivity(input: ReviewInput, publisher: boolean): Review {
  const items: CheckItem[] = [];

  // Basic data: blocks everyone (RN-A-02)
  if (!input.placeId)
    items.push({ key: "place", level: "error", text: "Falta el lugar general.", step: 1 });
  if (!input.categoryId)
    items.push({ key: "category", level: "error", text: "Falta la categoría.", step: 1 });
  if (input.placeId && input.categoryId) {
    items.push({ key: "basics", level: "ok", text: "Los datos básicos están completos.", step: 1 });
  }

  if (input.photos.length === 0) {
    items.push({
      key: "no-photos",
      level: "warn",
      text: "La actividad no tiene fotos. Se puede publicar, pero las fotos ayudan a contarla.",
      step: 2,
    });
  }

  let photoProblems = 0;
  for (const photo of input.photos) {
    // Unfinished uploads: block everyone
    if (photo.processing) {
      photoProblems += 1;
      items.push({
        key: `processing:${photo.mediaId}`,
        level: "error",
        text: `${photo.label}: no terminó de subir. Quítala o vuelve a subirla.`,
        step: 2,
      });
      continue;
    }
    for (const code of photo.issues) {
      const known = PHOTO_ISSUES[code];
      if (!known) continue;
      photoProblems += 1;
      items.push({
        key: `${code}:${photo.mediaId}`,
        // Authors can send to review with these warnings; editors cannot publish
        level: publisher ? "error" : "warn",
        text: known.text(photo.label),
        step: known.step,
      });
    }
  }
  if (input.photos.length > 0 && photoProblems === 0) {
    items.push({
      key: "photos",
      level: "ok",
      text: "Las fotos están listas para publicarse.",
      step: 2,
    });
  }

  const blocking = items.filter((item) => item.level === "error");
  return {
    items,
    canSubmit: blocking.length === 0 || blocking.every((item) => isWarningForAuthors(item)),
    canPublish: publisher && blocking.length === 0,
  };
}

/** Photo issues are red only for publishers; for the author they are warnings. */
function isWarningForAuthors(item: CheckItem): boolean {
  const code = item.key.split(":")[0] ?? "";
  return code in PHOTO_ISSUES;
}
