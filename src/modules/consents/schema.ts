import { z } from "zod";

// Image authorizations (step 6.5, docs/06 §6, docs/09 §4). Pure: unit-tested
// in schema.test.ts. Minimal data: no ID number, phone, address or e-mail.

export const SIGNER_TYPES = ["self", "legal_guardian"] as const;
export type SignerType = (typeof SIGNER_TYPES)[number];
export const SIGNER_LABELS: Record<SignerType, string> = {
  self: "La misma persona",
  legal_guardian: "Su representante legal",
};

export const CHANNELS = ["paper", "digital"] as const;
export type Channel = (typeof CHANNELS)[number];
export const CHANNEL_LABELS: Record<Channel, string> = { paper: "Papel", digital: "Digital" };

export const MINOR_OPINIONS = ["agrees", "disagrees", "not_applicable"] as const;
export type MinorOpinion = (typeof MINOR_OPINIONS)[number];
export const MINOR_OPINION_LABELS: Record<MinorOpinion, string> = {
  agrees: "Está de acuerdo en aparecer",
  disagrees: "No quiere aparecer",
  not_applicable: "No aplica por su edad",
};

export type ConsentStatus = "active" | "revoked" | "expired" | "not_authorizing";
export const STATUS_LABELS: Record<ConsentStatus, string> = {
  active: "Vigente",
  revoked: "Revocada",
  expired: "Vencida",
  not_authorizing: "No autoriza (el menor no quiere aparecer)",
};

/** Today's date (YYYY-MM-DD) in Colombia, where the forms are signed. */
export function todayInBogota(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(now);
}

/** Same rule as private.media_publish_issues: which authorizations count. */
export function consentStatus(
  record: {
    revokedAt: string | null;
    validUntil: string | null;
    isMinor: boolean;
    minorOpinion: MinorOpinion | null;
  },
  today = todayInBogota(),
): ConsentStatus {
  if (record.revokedAt) return "revoked";
  if (record.validUntil && record.validUntil < today) return "expired";
  if (record.isMinor && record.minorOpinion === "disagrees") return "not_authorizing";
  return "active";
}

const requiredText = (max: number, empty: string, long: string) =>
  z.string().trim().min(1, empty).max(max, long);

const optionalText = (max: number, long: string) =>
  z
    .string()
    .trim()
    .max(max, long)
    .transform((text) => (text === "" ? null : text));

const isoDate = z.iso.date({ message: "Escribe una fecha válida." });
const emptyToNull = (value: unknown) => (value === "" || value === null ? null : value);

/** Form fields shared by "register" and "edit". Checkbox: "on" when checked. */
const consentFields = z
  .object({
    subjectName: requiredText(
      120,
      "Escribe el nombre de la persona que aparece.",
      "El nombre es demasiado largo (máximo 120 caracteres).",
    ),
    isMinor: z.preprocess((value) => value === "on", z.boolean()),
    minorOpinion: z.preprocess(emptyToNull, z.enum(MINOR_OPINIONS).nullable()),
    signerType: z.enum(SIGNER_TYPES, { message: "Indica quién firmó." }),
    signerName: optionalText(120, "El nombre de quien firma es demasiado largo."),
    scopeDescription: requiredText(
      500,
      "Describe qué cubre la autorización.",
      "La descripción es demasiado larga (máximo 500 caracteres).",
    ),
    grantedOn: isoDate,
    validUntil: z.preprocess(emptyToNull, isoDate.nullable()),
    channel: z.enum(CHANNELS, { message: "Indica si se firmó en papel o en digital." }),
    formVersion: requiredText(
      40,
      "Escribe la versión del formato (p. ej. v1).",
      "La versión es demasiado larga.",
    ),
  })
  .superRefine((data, context) => {
    if (data.isMinor && data.signerType !== "legal_guardian") {
      context.addIssue({
        code: "custom",
        path: ["signerType"],
        message: "Si es menor de edad, firma su representante legal.",
      });
    }
    if (data.isMinor && !data.minorOpinion) {
      context.addIssue({
        code: "custom",
        path: ["minorOpinion"],
        message: "Registra la opinión del menor (o indica que no aplica por su edad).",
      });
    }
    if (data.signerType === "legal_guardian" && !data.signerName) {
      context.addIssue({
        code: "custom",
        path: ["signerName"],
        message: "Escribe el nombre del representante legal.",
      });
    }
    if (data.grantedOn > todayInBogota()) {
      context.addIssue({
        code: "custom",
        path: ["grantedOn"],
        message: "La fecha de firma no puede ser futura.",
      });
    }
    if (data.validUntil && data.validUntil < data.grantedOn) {
      context.addIssue({
        code: "custom",
        path: ["validUntil"],
        message: "La fecha de vencimiento no puede ser anterior a la de firma.",
      });
    }
  })
  // Database columns; an adult has no "minor opinion"
  .transform((data) => ({
    subject_name: data.subjectName,
    is_minor: data.isMinor,
    minor_opinion: data.isMinor ? data.minorOpinion : null,
    signer_type: data.signerType,
    signer_name: data.signerType === "legal_guardian" ? data.signerName : null,
    scope_description: data.scopeDescription,
    granted_on: data.grantedOn,
    valid_until: data.validUntil,
    channel: data.channel,
    form_version: data.formVersion,
  }));

export const consentFieldsSchema = consentFields;
export type ConsentColumns = z.output<typeof consentFields>;

/** Reads the fields of a consent form. */
export function readConsentFields(formData: FormData) {
  return consentFields.safeParse({
    subjectName: formData.get("subjectName") ?? "",
    isMinor: formData.get("isMinor"),
    minorOpinion: formData.get("minorOpinion"),
    signerType: formData.get("signerType"),
    signerName: formData.get("signerName") ?? "",
    scopeDescription: formData.get("scopeDescription") ?? "",
    grantedOn: formData.get("grantedOn"),
    validUntil: formData.get("validUntil"),
    channel: formData.get("channel"),
    formVersion: formData.get("formVersion") ?? "",
  });
}

export const idSchema = z.uuid();

export const revokeSchema = z.object({
  id: z.uuid(),
  note: z
    .string()
    .trim()
    .min(5, "Explica brevemente por qué se revoca (quién lo pidió y cuándo).")
    .max(500, "La nota es demasiado larga (máximo 500 caracteres)."),
});

export const CONSENT_PAGE_SIZE = 25;

const flag = z.preprocess((value) => value === "1", z.boolean());

export const consentFiltersSchema = z.object({
  q: z
    .string()
    .trim()
    .max(80)
    .catch("")
    .transform((text) => text),
  minors: flag,
  status: z.enum(["active", "revoked", "all"]).catch("active"),
  page: z.coerce.number().int().min(1).max(500).catch(1),
});
export type ConsentFilters = z.output<typeof consentFiltersSchema>;

export function parseConsentFilters(
  searchParams: Record<string, string | string[] | undefined>,
): ConsentFilters {
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  return consentFiltersSchema.parse({
    q: first(searchParams.q) ?? "",
    minors: first(searchParams.minors),
    status: first(searchParams.status),
    page: first(searchParams.page),
  });
}

/** For ilike: % and _ typed by the person are searched literally. */
export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export type ConsentFormState = { error?: string; notice?: string; done?: boolean };

export const consentPaths = {
  incoming: (uploadId: string) => `consents/${uploadId}`,
  document: (uploadId: string) => `${uploadId}.webp`,
};

/** One version of the signed form: readable, not a full-resolution scan. */
export const DOCUMENT_WIDTHS = { form: 1600 } as const;
