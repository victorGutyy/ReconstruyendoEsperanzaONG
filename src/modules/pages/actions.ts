"use server";

import { z } from "zod";

import { authorizeAction } from "@/lib/auth/guard";
import { getRateLimiter, RATE_LIMITS, rateLimitKey } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import {
  parseSchedule,
  publishContent,
  type PublishResult,
  saveContentRow,
  type SaveResult,
  submitContent,
} from "@/modules/content";

import {
  hasPendingText,
  isLegalPage,
  type PageInput,
  type PageKey,
  pageSchema,
  reviewPage,
} from "./schema";

const idSchema = z.uuid();

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function limited(userId: string): Promise<string | null> {
  const attempt = await getRateLimiter().limit(RATE_LIMITS.panelActions, rateLimitKey(userId));
  return attempt.success ? null : "Demasiadas acciones seguidas. Espera un momento.";
}

async function readPage(supabase: Supabase, id: string) {
  const { data } = await supabase
    .from("pages")
    .select("key, status, title, body_text, version")
    .eq("id", id)
    .maybeSingle();
  return data ? { ...data, key: data.key as PageKey } : null;
}

async function publishedVersions(supabase: Supabase, id: string) {
  const { data } = await supabase.from("page_versions").select("version").eq("page_id", id);
  return (data ?? []).map((row) => row.version);
}

/**
 * Saves a page (also the autosave). Pages are never created here: the four
 * of them exist from the start. Legal pages: the Administrator only (RLS).
 */
export async function savePage(input: { id?: string; fields: PageInput }): Promise<SaveResult> {
  const authorized = await authorizeAction("content.read");
  if (!authorized.ok) return { ok: false, error: authorized.error };
  if (!input.id || !idSchema.safeParse(input.id).success) {
    return { ok: false, error: "Página no válida." };
  }
  const parsed = pageSchema.safeParse(input.fields);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  }
  const tooMany = await limited(authorized.auth.user.id);
  if (tooMany) return { ok: false, error: tooMany };

  const supabase = await createClient();
  const current = await readPage(supabase, input.id);
  if (!current) return { ok: false, error: "No se encontró la página." };

  // A published page changes in place: say why the database would refuse it
  if (current.status === "published") {
    if (hasPendingText(parsed.data.title, parsed.data.body_text)) {
      return { ok: false, error: "Una página publicada no puede tener texto [PENDIENTE: …]." };
    }
    const textChanged =
      parsed.data.title !== current.title || parsed.data.body_text !== current.body_text;
    if (isLegalPage(current.key) && textChanged) {
      const used = await publishedVersions(supabase, input.id);
      if (!parsed.data.version || used.includes(parsed.data.version)) {
        return {
          ok: false,
          error: `Esta página está publicada con la versión ${current.version}: escribe una versión nueva antes de cambiar el texto.`,
        };
      }
    }
  }

  const result = await saveContentRow(supabase, "page", parsed.data, input.id);
  if (!result.ok && result.error.startsWith("No puedes editar")) {
    return {
      ok: false,
      error: isLegalPage(current.key)
        ? "Las páginas legales solo las edita el Administrador."
        : "No tienes permiso para editar esta página.",
    };
  }
  return result;
}

async function loadReview(supabase: Supabase, id: string, publisher: boolean) {
  const page = await readPage(supabase, id);
  if (!page) return null;
  return reviewPage(
    {
      key: page.key,
      title: page.title,
      bodyText: page.body_text,
      version: page.version,
      publishedVersions: await publishedVersions(supabase, id),
    },
    publisher,
  );
}

const firstProblem = (items: { level: string; text: string }[]) =>
  items.find((item) => item.level === "error")?.text ?? "Revisa la página.";

/** "Enviar a revisión" (institutional pages edited by editors). */
export async function submitPage(id: string): Promise<PublishResult> {
  const authorized = await authorizeAction("content.read");
  if (!authorized.ok) return { ok: false, error: authorized.error };
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Página no válida." };

  const supabase = await createClient();
  const review = await loadReview(supabase, id, false);
  if (!review) return { ok: false, error: "No se encontró la página." };
  if (!review.canSubmit) return { ok: false, error: firstProblem(review.items) };
  return submitContent(supabase, "page", id);
}

/** "Publicar ahora" or "Programar": no pending text, a new version if legal. */
export async function publishPage(
  id: string,
  schedule?: { date: string; time: string },
): Promise<PublishResult> {
  const authorized = await authorizeAction("content.publish");
  if (!authorized.ok) return { ok: false, error: authorized.error };
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Página no válida." };

  let publishedAt: string | null = null;
  if (schedule) {
    const parsed = parseSchedule(schedule);
    if (!parsed.ok) return parsed;
    publishedAt = parsed.publishedAt;
  }

  const supabase = await createClient();
  const review = await loadReview(supabase, id, true);
  if (!review) return { ok: false, error: "No se encontró la página." };
  if (!review.canPublish) return { ok: false, error: firstProblem(review.items) };
  return publishContent(supabase, "page", id, publishedAt);
}
