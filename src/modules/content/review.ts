import { agree, type ContentType, theType } from "./registry";

// Review before sending or publishing, shared by the single-page editors
// (steps 7.6a–b). Pure: unit-tested in review.test.ts. Red blocks, yellow warns;
// the database checks everything again.

export type CheckItem = { key: string; level: "ok" | "warn" | "error"; text: string };

const COVER_ISSUES: Record<string, string> = {
  in_trash: "la foto está en la papelera",
  not_processed: "la foto no terminó de procesarse",
  missing_alt_text: "falta su descripción",
  people_unclassified: "falta indicar si aparecen personas",
  missing_consent: "aparecen personas y falta su autorización",
  missing_guardian_consent: "hay menores y falta la autorización de su representante",
};

/**
 * The cover: optional (a warning without it). Authors may send one that
 * still needs something; editors cannot publish it.
 */
export function coverCheck(
  type: ContentType,
  coverIssues: readonly string[] | null,
  publisher: boolean,
): CheckItem {
  if (coverIssues === null) {
    return {
      key: "no-cover",
      level: "warn",
      text: `${theType(type)} no tiene portada. Se puede publicar, pero una foto ayuda a ${agree(type, "contarla", "contarlo")}.`,
    };
  }
  if (coverIssues.length > 0) {
    const reasons = coverIssues.map((code) => COVER_ISSUES[code] ?? "tiene un pendiente");
    return {
      key: "cover",
      level: publisher ? "error" : "warn",
      text: `La portada no se puede publicar todavía: ${reasons.join("; ")}.`,
    };
  }
  return { key: "cover", level: "ok", text: "La portada está lista para publicarse." };
}

/** Who may do what once the items are known. */
export function reviewOutcome(items: CheckItem[], publisher: boolean) {
  const blocking = items.filter((item) => item.level === "error");
  return {
    items,
    canSubmit: blocking.length === 0,
    canPublish: publisher && blocking.length === 0,
  };
}
