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
import { getPersonConsent } from "@/modules/consents";
import { getPublishIssues } from "@/modules/media";

import { reviewTestimonial, type TestimonialInput, testimonialSchema } from "./schema";

const idSchema = z.uuid();

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Testimonials are personal data: every action needs consent.manage on top
 * of the content permission (decision 7.6d). The database checks it again.
 */
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

/** Creates or updates a testimonial (also the autosave). */
export async function saveTestimonial(input: {
  id?: string;
  fields: TestimonialInput;
}): Promise<SaveResult> {
  const authorized = await authorize(input.id ? "content.read" : "content.create");
  if (!authorized.ok) return { ok: false, error: authorized.error };
  if (input.id && !idSchema.safeParse(input.id).success) {
    return { ok: false, error: "Testimonio no válido." };
  }
  const parsed = testimonialSchema.safeParse(input.fields);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  }

  // The trigger refuses minors and missing authorizations: say it in words first
  const consent = await getPersonConsent(parsed.data.consent_record_id);
  if (!consent) return { ok: false, error: "Elige una autorización vigente de la persona." };
  if (consent.isMinor) return { ok: false, error: "No se aceptan testimonios de menores de edad." };

  return saveContentRow(await createClient(), "testimonial", parsed.data, input.id);
}

/** The person's photo (optional), from the library. */
export async function setTestimonialPhoto(
  testimonialId: string,
  mediaId: string | null,
): Promise<ActionResult> {
  const authorized = await authorize("content.read");
  if (!authorized.ok) return { ok: false, error: authorized.error };
  if (
    !idSchema.safeParse(testimonialId).success ||
    (mediaId && !idSchema.safeParse(mediaId).success)
  ) {
    return { ok: false, error: "Datos no válidos." };
  }
  return setContentCover(await createClient(), "testimonial", testimonialId, mediaId);
}

async function loadReview(supabase: Supabase, id: string, publisher: boolean) {
  const { data } = await supabase
    .from("testimonials")
    .select("consent_record_id, cover_media_id, deleted_at")
    .eq("id", id)
    .maybeSingle();
  if (!data || data.deleted_at) return null;
  const [consent, issues] = await Promise.all([
    getPersonConsent(data.consent_record_id),
    data.cover_media_id ? getPublishIssues([data.cover_media_id]) : Promise.resolve(null),
  ]);
  return reviewTestimonial(
    {
      consentUsable: consent?.status === "active" && !consent.isMinor,
      coverIssues: issues ? (issues.get(data.cover_media_id!) ?? []) : null,
    },
    publisher,
  );
}

const firstProblem = (items: { level: string; text: string }[]) =>
  items.find((item) => item.level === "error")?.text ?? "Revisa el testimonio.";

/** "Enviar a revisión". */
export async function submitTestimonial(id: string): Promise<PublishResult> {
  const authorized = await authorize("content.read");
  if (!authorized.ok) return { ok: false, error: authorized.error };
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Testimonio no válido." };

  const supabase = await createClient();
  const review = await loadReview(supabase, id, false);
  if (!review) return { ok: false, error: "No se encontró el testimonio." };
  if (!review.canSubmit) return { ok: false, error: firstProblem(review.items) };
  return submitContent(supabase, "testimonial", id);
}

/** "Publicar ahora" or "Programar": the authorization must be usable. */
export async function publishTestimonial(
  id: string,
  schedule?: { date: string; time: string },
): Promise<PublishResult> {
  const authorized = await authorize("content.publish");
  if (!authorized.ok) return { ok: false, error: authorized.error };
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Testimonio no válido." };

  let publishedAt: string | null = null;
  if (schedule) {
    const parsed = parseSchedule(schedule);
    if (!parsed.ok) return parsed;
    publishedAt = parsed.publishedAt;
  }

  const supabase = await createClient();
  const review = await loadReview(supabase, id, true);
  if (!review) return { ok: false, error: "No se encontró el testimonio." };
  if (!review.canPublish) return { ok: false, error: firstProblem(review.items) };
  return publishContent(supabase, "testimonial", id, publishedAt);
}
