"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { authorizeAction } from "@/lib/auth/guard";
import { getRateLimiter, RATE_LIMITS, rateLimitKey } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { getPersonConsent } from "@/modules/consents";
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

import { reviewTeamMember, TEAM_PATH, type TeamInput, teamSchema } from "./schema";

const idSchema = z.uuid();

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Personal data: consent.manage on top of the content permission (decision 7.6d). */
async function authorize(permission: "content.read" | "content.create" | "content.publish") {
  const consents = await authorizeAction("consent.manage");
  if (!consents.ok) return consents;
  const content = await authorizeAction(permission);
  if (!content.ok) return content;
  const attempt = await getRateLimiter().limit(
    RATE_LIMITS.panelActions,
    rateLimitKey(content.auth.user.id),
  );
  if (!attempt.success) {
    return { ok: false as const, error: "Demasiadas acciones seguidas. Espera un momento." };
  }
  return content;
}

/** Creates (at the end of the team) or updates a profile; also the autosave. */
export async function saveTeamMember(input: {
  id?: string;
  fields: TeamInput;
}): Promise<SaveResult> {
  const authorized = await authorize(input.id ? "content.read" : "content.create");
  if (!authorized.ok) return { ok: false, error: authorized.error };
  if (input.id && !idSchema.safeParse(input.id).success) {
    return { ok: false, error: "Perfil no válido." };
  }
  const parsed = teamSchema.safeParse(input.fields);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  }
  if (parsed.data.consent_record_id) {
    const consent = await getPersonConsent(parsed.data.consent_record_id);
    if (!consent) return { ok: false, error: "Elige una autorización vigente de la persona." };
    if (consent.isMinor) {
      return { ok: false, error: "No se aceptan perfiles de menores de edad." };
    }
  }

  const supabase = await createClient();
  let columns: Record<string, unknown> = parsed.data;
  if (!input.id) {
    const { data: last } = await supabase
      .from("team_members")
      .select("position")
      .is("deleted_at", null)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    columns = { ...parsed.data, position: (last?.position ?? 0) + 1 };
  }
  return saveContentRow(supabase, "team_member", columns, input.id);
}

/** The person's photo (optional), from the library. */
export async function setTeamPhoto(
  memberId: string,
  mediaId: string | null,
): Promise<ActionResult> {
  const authorized = await authorize("content.read");
  if (!authorized.ok) return { ok: false, error: authorized.error };
  if (!idSchema.safeParse(memberId).success || (mediaId && !idSchema.safeParse(mediaId).success)) {
    return { ok: false, error: "Datos no válidos." };
  }
  return setContentCover(await createClient(), "team_member", memberId, mediaId);
}

/**
 * Moves a profile one place in the team by swapping its position with the
 * neighbour's: only those two rows change (no renumbering of the whole team,
 * so two people ordering at once do not undo each other).
 */
export async function moveTeamMember(
  memberId: string,
  direction: "up" | "down",
): Promise<ActionResult> {
  const authorized = await authorize("content.read");
  if (!authorized.ok) return { ok: false, error: authorized.error };
  if (!idSchema.safeParse(memberId).success) return { ok: false, error: "Perfil no válido." };

  const supabase = await createClient();
  const { data: members, error: readError } = await supabase
    .from("team_members")
    .select("id, position")
    .is("deleted_at", null)
    .order("position")
    .order("full_name");
  if (readError || !members) return { ok: false, error: "No se pudo leer el equipo." };

  const from = members.findIndex((member) => member.id === memberId);
  const to = direction === "up" ? from - 1 : from + 1;
  if (from === -1 || to < 0 || to >= members.length) return { ok: true };
  const moving = members[from]!;
  const neighbour = members[to]!;
  // Same position (ties are ordered by name): step just past the neighbour
  const [movingTo, neighbourTo] =
    moving.position === neighbour.position
      ? [neighbour.position + (direction === "up" ? -1 : 1), neighbour.position]
      : [neighbour.position, moving.position];

  for (const [id, position] of [
    [moving.id, movingTo],
    [neighbour.id, neighbourTo],
  ] as const) {
    const { error } = await supabase.from("team_members").update({ position }).eq("id", id);
    if (error) return { ok: false, error: "No tienes permiso para ordenar el equipo." };
  }
  revalidatePath(TEAM_PATH, "layout");
  return { ok: true };
}

async function loadReview(supabase: Supabase, id: string, publisher: boolean) {
  const { data } = await supabase
    .from("team_members")
    .select("consent_record_id, cover_media_id, deleted_at")
    .eq("id", id)
    .maybeSingle();
  if (!data || data.deleted_at) return null;
  const [consent, issues] = await Promise.all([
    data.consent_record_id ? getPersonConsent(data.consent_record_id) : Promise.resolve(null),
    data.cover_media_id ? getPublishIssues([data.cover_media_id]) : Promise.resolve(null),
  ]);
  return reviewTeamMember(
    {
      consent: !data.consent_record_id
        ? "missing"
        : consent?.status === "active" && !consent.isMinor
          ? "usable"
          : "gone",
      coverIssues: issues ? (issues.get(data.cover_media_id!) ?? []) : null,
    },
    publisher,
  );
}

const firstProblem = (items: { level: string; text: string }[]) =>
  items.find((item) => item.level === "error")?.text ?? "Revisa el perfil.";

/** "Enviar a revisión". */
export async function submitTeamMember(id: string): Promise<PublishResult> {
  const authorized = await authorize("content.read");
  if (!authorized.ok) return { ok: false, error: authorized.error };
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Perfil no válido." };

  const supabase = await createClient();
  const review = await loadReview(supabase, id, false);
  if (!review) return { ok: false, error: "No se encontró el perfil." };
  if (!review.canSubmit) return { ok: false, error: firstProblem(review.items) };
  return submitContent(supabase, "team_member", id);
}

/** "Publicar ahora" or "Programar": the authorization must be usable. */
export async function publishTeamMember(
  id: string,
  schedule?: { date: string; time: string },
): Promise<PublishResult> {
  const authorized = await authorize("content.publish");
  if (!authorized.ok) return { ok: false, error: authorized.error };
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Perfil no válido." };

  let publishedAt: string | null = null;
  if (schedule) {
    const parsed = parseSchedule(schedule);
    if (!parsed.ok) return parsed;
    publishedAt = parsed.publishedAt;
  }

  const supabase = await createClient();
  const review = await loadReview(supabase, id, true);
  if (!review) return { ok: false, error: "No se encontró el perfil." };
  if (!review.canPublish) return { ok: false, error: firstProblem(review.items) };
  return publishContent(supabase, "team_member", id, publishedAt);
}
