import { z } from "zod";

import { validateRichText } from "@/lib/rich-text/schema";
import { type CheckItem, coverCheck, reviewOutcome } from "@/modules/content/shared";
import type { Json } from "@/types/database";

// Projects (step 7.6b, docs/06 §5). Pure: unit-tested in schema.test.ts.

export const PROJECTS_PATH = "/admin/contenido/proyectos";

/** The project's own life, not its publication state. */
export const PROJECT_STAGES = ["planned", "active", "paused", "completed"] as const;
export type ProjectStage = (typeof PROJECT_STAGES)[number];
export const STAGE_LABELS: Record<ProjectStage, string> = {
  planned: "Planeado",
  active: "Activo",
  paused: "Pausado",
  completed: "Terminado",
};

/** What the editor form holds (dates as YYYY-MM-DD, "" when empty). */
export type ProjectValues = {
  title: string;
  summary: string;
  objective: string;
  stage: ProjectStage;
  startDate: string;
  endDate: string;
  body: unknown;
};

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((text) => (text === "" ? null : text));

const optionalDate = z.preprocess(
  (value) => (value === "" || value === null ? null : value),
  z.iso.date({ message: "Escribe una fecha válida." }).nullable(),
);

/** Summary may be empty in a draft; it is required to publish (decision 7.6b). */
export const projectSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Escribe el nombre del proyecto.")
      .max(160, "El nombre es demasiado largo (máximo 160 caracteres)."),
    summary: optionalText(300, "El resumen es demasiado largo (máximo 300 caracteres)."),
    objective: optionalText(1000, "El objetivo es demasiado largo (máximo 1000 caracteres)."),
    stage: z.enum(PROJECT_STAGES, { message: "Elige el estado del proyecto." }),
    startDate: optionalDate,
    endDate: optionalDate,
    body: z.unknown(),
  })
  .superRefine((data, context) => {
    if (data.startDate && data.endDate && data.endDate < data.startDate) {
      context.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "La fecha de fin no puede ser anterior a la de inicio.",
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
      summary: data.summary,
      objective: data.objective,
      project_status: data.stage,
      start_date: data.startDate,
      end_date: data.endDate,
      // Validated above against the closed allow-list: safe to store as JSON
      body: doc as unknown as Json | null,
      body_text: body.ok && !body.isEmpty ? body.text : null,
    };
  });

export type ProjectInput = z.input<typeof projectSchema>;

/** Before sending or publishing: the summary is required, the cover optional. */
export function reviewProject(
  input: { summary: string | null; coverIssues: readonly string[] | null },
  publisher: boolean,
) {
  const items: CheckItem[] = [];
  items.push(
    input.summary?.trim()
      ? { key: "summary", level: "ok", text: "El resumen está listo." }
      : { key: "summary", level: "error", text: "Falta el resumen (se ve en las tarjetas)." },
  );
  items.push(coverCheck("project", input.coverIssues, publisher));
  return reviewOutcome(items, publisher);
}
