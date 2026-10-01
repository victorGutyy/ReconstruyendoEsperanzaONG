import { z } from "zod";

// "Pertenece a" for galleries and videos (step 7.6c): "" (none),
// "activity:<id>" or "project:<id>". Pure: unit-tested in galleries.

const INVALID = "Elige una actividad o un proyecto válido.";

export const ownerSchema = z
  .string()
  .regex(/^((activity|project):[0-9a-f-]{36})?$/i, INVALID)
  .refine((value) => value === "" || z.uuid().safeParse(value.split(":")[1]).success, {
    message: INVALID,
  });

/** The owner as table columns (at most one of them is set). */
export function ownerColumns(owner: string): {
  activity_id: string | null;
  project_id: string | null;
} {
  const [kind, id] = owner ? owner.split(":") : [null, null];
  return {
    activity_id: kind === "activity" ? id! : null,
    project_id: kind === "project" ? id! : null,
  };
}

/** The columns back as the form value. */
export const ownerValue = (activityId: string | null, projectId: string | null) =>
  activityId ? `activity:${activityId}` : projectId ? `project:${projectId}` : "";
