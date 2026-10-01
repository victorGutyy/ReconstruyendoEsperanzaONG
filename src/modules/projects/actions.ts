"use server";

import { z } from "zod";

import { authorizeAction } from "@/lib/auth/guard";
import { getRateLimiter, RATE_LIMITS, rateLimitKey } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import {
  type ActionResult,
  parseSchedule,
  publishContent,
  type PublishResult,
  saveContentRow,
  type SaveResult,
  setContentCover,
  submitContent,
} from "@/modules/content";
import { getPublishIssues } from "@/modules/media";

import { type ProjectInput, projectSchema, reviewProject } from "./schema";

const idSchema = z.uuid();

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function limited(userId: string): Promise<string | null> {
  const attempt = await getRateLimiter().limit(RATE_LIMITS.panelActions, rateLimitKey(userId));
  return attempt.success ? null : "Demasiadas acciones seguidas. Espera un momento.";
}

/** Creates or updates a project (also the autosave). */
export async function saveProject(input: {
  id?: string;
  fields: ProjectInput;
}): Promise<SaveResult> {
  const authorized = await authorizeAction(input.id ? "content.read" : "content.create");
  if (!authorized.ok) return { ok: false, error: authorized.error };
  if (input.id && !idSchema.safeParse(input.id).success) {
    return { ok: false, error: "Proyecto no válido." };
  }

  const parsed = projectSchema.safeParse(input.fields);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  }
  const tooMany = await limited(authorized.auth.user.id);
  if (tooMany) return { ok: false, error: tooMany };

  return saveContentRow(await createClient(), "project", parsed.data, input.id);
}

/** Sets or removes the cover; public copies follow if the project is published. */
export async function setProjectCover(
  projectId: string,
  mediaId: string | null,
): Promise<ActionResult> {
  const authorized = await authorizeAction("content.read");
  if (!authorized.ok) return { ok: false, error: authorized.error };
  if (!idSchema.safeParse(projectId).success || (mediaId && !idSchema.safeParse(mediaId).success)) {
    return { ok: false, error: "Datos no válidos." };
  }
  const tooMany = await limited(authorized.auth.user.id);
  if (tooMany) return { ok: false, error: tooMany };

  return setContentCover(await createClient(), "project", projectId, mediaId);
}

async function loadReview(supabase: Supabase, projectId: string, publisher: boolean) {
  const { data } = await supabase
    .from("projects")
    .select("summary, cover_media_id, deleted_at")
    .eq("id", projectId)
    .maybeSingle();
  if (!data || data.deleted_at) return null;
  const issues = data.cover_media_id
    ? ((await getPublishIssues([data.cover_media_id])).get(data.cover_media_id) ?? [])
    : null;
  return reviewProject({ summary: data.summary, coverIssues: issues }, publisher);
}

const firstProblem = (items: { level: string; text: string }[]) =>
  items.find((item) => item.level === "error")?.text ?? "Revisa el proyecto.";

/** "Enviar a revisión": anyone who can edit the draft. */
export async function submitProject(projectId: string): Promise<PublishResult> {
  const authorized = await authorizeAction("content.read");
  if (!authorized.ok) return { ok: false, error: authorized.error };
  if (!idSchema.safeParse(projectId).success) return { ok: false, error: "Proyecto no válido." };

  const supabase = await createClient();
  const review = await loadReview(supabase, projectId, false);
  if (!review) return { ok: false, error: "No se encontró el proyecto." };
  if (!review.canSubmit) return { ok: false, error: firstProblem(review.items) };
  return submitContent(supabase, "project", projectId);
}

/** "Publicar ahora" or "Programar": content.publish, nothing red. */
export async function publishProject(
  projectId: string,
  schedule?: { date: string; time: string },
): Promise<PublishResult> {
  const authorized = await authorizeAction("content.publish");
  if (!authorized.ok) return { ok: false, error: authorized.error };
  if (!idSchema.safeParse(projectId).success) return { ok: false, error: "Proyecto no válido." };

  let publishedAt: string | null = null;
  if (schedule) {
    const parsed = parseSchedule(schedule);
    if (!parsed.ok) return parsed;
    publishedAt = parsed.publishedAt;
  }

  const supabase = await createClient();
  const review = await loadReview(supabase, projectId, true);
  if (!review) return { ok: false, error: "No se encontró el proyecto." };
  if (!review.canPublish) return { ok: false, error: firstProblem(review.items) };
  return publishContent(supabase, "project", projectId, publishedAt);
}
