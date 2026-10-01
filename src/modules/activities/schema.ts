import { z } from "zod";

import { validateRichText } from "@/lib/rich-text/schema";
import type { Json } from "@/types/database";

// Activities (step 7.3, docs/07 §6.5). Pure: unit-tested in schema.test.ts.

export const WIZARD_STEPS = [
  { step: 1, label: "Lo básico" },
  { step: 2, label: "Fotos" },
  { step: 3, label: "Personas en las fotos" },
  { step: 4, label: "Revisar y publicar" },
] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number]["step"];

export function parseStep(value: string | string[] | undefined): WizardStep {
  const step = Number(Array.isArray(value) ? value[0] : value);
  return step === 2 || step === 3 || step === 4 ? step : 1;
}

// Colombia has no daylight saving time: always UTC-5
const BOGOTA_OFFSET = "-05:00";

/** "2026-09-20" + "09:30" in Colombia → ISO instant. */
export function toBogotaInstant(date: string, time: string): string {
  return new Date(`${date}T${time}:00${BOGOTA_OFFSET}`).toISOString();
}

/** ISO instant → { date: "2026-09-20", time: "09:30" } in Colombia. */
export function fromBogotaInstant(iso: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Escribe una hora válida.");
const optionalUuid = z.preprocess(
  (value) => (value === "" || value === null ? null : value),
  z.uuid().nullable(),
);

/** Step 1. Place and category may be missing in a draft; they are required to publish. */
export const basicsSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Escribe el título de la actividad.")
      .max(160, "El título es demasiado largo (máximo 160 caracteres)."),
    date: z.iso.date({ message: "Escribe la fecha de la actividad." }),
    startTime: time,
    endTime: z.preprocess((value) => (value === "" ? null : value), time.nullable()),
    placeId: optionalUuid,
    categoryId: optionalUuid,
    summary: z
      .string()
      .trim()
      .max(300, "El resumen es demasiado largo (máximo 300 caracteres).")
      .transform((text) => (text === "" ? null : text)),
    body: z.unknown(),
  })
  .superRefine((data, context) => {
    if (data.endTime && data.endTime < data.startTime) {
      context.addIssue({
        code: "custom",
        path: ["endTime"],
        message: "La hora de fin no puede ser anterior a la de inicio.",
      });
    }
    const body = validateRichText(data.body ?? { type: "doc", content: [] });
    if (!body.ok) context.addIssue({ code: "custom", path: ["body"], message: body.error });
  })
  .transform((data) => {
    const body = validateRichText(data.body ?? { type: "doc", content: [] });
    const doc = body.ok && !body.isEmpty ? body.doc : null;
    return {
      title: data.title,
      starts_at: toBogotaInstant(data.date, data.startTime),
      ends_at: data.endTime ? toBogotaInstant(data.date, data.endTime) : null,
      place_id: data.placeId,
      category_id: data.categoryId,
      summary: data.summary,
      // Validated above against the closed allow-list: safe to store as JSON
      body: doc as unknown as Json | null,
      body_text: body.ok && !body.isEmpty ? body.text : null,
    };
  });

export type BasicsInput = z.input<typeof basicsSchema>;
export type BasicsColumns = z.output<typeof basicsSchema>;

export type SaveResult = { ok: true; id: string; savedAt: string } | { ok: false; error: string };

export type PhotoResult = { ok: true } | { ok: false; error: string };
