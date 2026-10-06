import { z } from "zod";

import { type CheckItem, coverCheck, reviewOutcome } from "@/modules/content/shared";

// Team profiles (step 7.6d, docs/06 §5). Pure: unit-tested in schema.test.ts.

export const TEAM_PATH = "/admin/contenido/equipo";

/** What the editor form holds. The authorization may be missing in a draft. */
export type TeamValues = { fullName: string; roleTitle: string; bio: string; consentId: string };

export const teamSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(1, "Escribe el nombre de la persona.")
      .max(120, "El nombre es demasiado largo (máximo 120 caracteres)."),
    roleTitle: z
      .string()
      .trim()
      .min(1, "Escribe su cargo o rol en la organización.")
      .max(120, "El cargo es demasiado largo (máximo 120 caracteres)."),
    // Plain text (decision 7.6d)
    bio: z
      .string()
      .trim()
      .max(600, "La biografía es demasiado larga (máximo 600 caracteres).")
      .transform((text) => (text === "" ? null : text)),
    consentId: z.preprocess(
      (value) => (value === "" || value === null ? null : value),
      z.uuid({ message: "Elige una autorización válida." }).nullable(),
    ),
  })
  .transform((data) => ({
    full_name: data.fullName,
    role_title: data.roleTitle,
    bio: data.bio,
    consent_record_id: data.consentId,
  }));

export type TeamInput = z.input<typeof teamSchema>;

/** Before sending or publishing: a usable authorization is required for everyone. */
export function reviewTeamMember(
  input: { consent: "usable" | "missing" | "gone"; coverIssues: readonly string[] | null },
  publisher: boolean,
) {
  const items: CheckItem[] = [
    input.consent === "usable"
      ? { key: "consent", level: "ok", text: "La autorización de la persona está vigente." }
      : {
          key: "consent",
          level: "error",
          text:
            input.consent === "missing"
              ? "Falta vincular la autorización de la persona."
              : "La autorización de la persona está revocada o vencida: elige otra o registra una nueva.",
        },
    coverCheck("team_member", input.coverIssues, publisher),
  ];
  return reviewOutcome(items, publisher);
}
