"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { authorizeAction } from "@/lib/auth/guard";
import { ImageRejectedError, processImage } from "@/lib/images/process";
import { getRateLimiter, RATE_LIMITS, rateLimitKey } from "@/lib/rate-limit";
import { supabasePrivateStorage } from "@/lib/storage/supabase";
import { createClient } from "@/lib/supabase/server";
import { syncPublicMediaAfter } from "@/modules/media";

import {
  consentPaths,
  type ConsentFormState,
  consentStatus,
  DOCUMENT_WIDTHS,
  escapeLike,
  idSchema,
  type MinorOpinion,
  readConsentFields,
  revokeSchema,
  type SignerType,
} from "./schema";

const CONSENTS_PATH = "/admin/autorizaciones";
const UPLOAD_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

/**
 * Photos follow their authorizations on the public site (step 7.5b): a
 * revoked, expired or unlinked one takes them out; a valid new one brings
 * them back. Runs after the change succeeded.
 */
async function syncLinkedPhotos(consentId: string) {
  const supabase = await createClient();
  const [links, testimonials, team] = await Promise.all([
    supabase.from("media_consents").select("media_id").eq("consent_record_id", consentId),
    // The photo of a testimonial or a team profile follows its authorization
    // even if the photo is not linked to it (7.6d)
    supabase
      .from("testimonials")
      .select("cover_media_id")
      .eq("consent_record_id", consentId)
      .not("cover_media_id", "is", null),
    supabase
      .from("team_members")
      .select("cover_media_id")
      .eq("consent_record_id", consentId)
      .not("cover_media_id", "is", null),
  ]);
  await syncPublicMediaAfter([
    ...(links.data ?? []).map((link) => link.media_id),
    ...(testimonials.data ?? []).map((row) => row.cover_media_id!),
    ...(team.data ?? []).map((row) => row.cover_media_id!),
  ]);
}

const firstIssue = (issues: { message: string }[]) => issues[0]?.message ?? "Revisa los datos.";

/**
 * Step 1 for the photo of the signed form: consent.manage + MFA + the upload
 * limit, then a one-file URL in the private incoming bucket.
 */
export async function requestConsentDocumentUpload(input: {
  type: string;
  size: number;
}): Promise<{ ok: true; uploadId: string; signedUrl: string } | { ok: false; error: string }> {
  const authorized = await authorizeAction("consent.manage");
  if (!authorized.ok) return { ok: false, error: authorized.error };

  if (!UPLOAD_TYPES.has(input.type) || input.size <= 0 || input.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "La foto del formato debe ser JPEG, PNG o WebP de hasta 15 MB." };
  }

  const attempt = await getRateLimiter().limit(
    RATE_LIMITS.mediaUploads,
    rateLimitKey("consent-document", authorized.auth.user.id),
  );
  if (!attempt.success) return { ok: false, error: "Demasiadas subidas seguidas. Espera un rato." };

  const uploadId = randomUUID();
  try {
    const upload = await supabasePrivateStorage().createUploadUrl(
      "media-incoming",
      consentPaths.incoming(uploadId),
    );
    return { ok: true, uploadId, signedUrl: upload.signedUrl };
  } catch {
    return { ok: false, error: "No se pudo preparar la subida del formato." };
  }
}

/**
 * Registers an authorization: re-encodes the uploaded form (no EXIF/GPS),
 * stores it in the private consent-documents bucket and inserts the record
 * with the manager's session (RLS + audit with them as actor).
 */
/**
 * Registers an authorization: re-encodes the uploaded form (no EXIF/GPS),
 * stores it in the private consent-documents bucket and inserts the record
 * with the manager's session (RLS + audit with them as actor).
 * Call after authorizeAction('consent.manage').
 */
async function registerConsent(
  formData: FormData,
  activityId: string | null,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const uploadId = idSchema.safeParse(formData.get("uploadId"));
  if (!uploadId.success) return { ok: false, error: "Adjunta la foto del formato firmado." };

  const storage = supabasePrivateStorage();
  const incoming = consentPaths.incoming(uploadId.data);
  const documentPath = consentPaths.document(uploadId.data);

  try {
    // The browser checks the fields before uploading; this is the real check
    const fields = readConsentFields(formData);
    if (!fields.success) return { ok: false, error: firstIssue(fields.error.issues) };

    const original = await storage.download("media-incoming", incoming);
    if (!original) {
      return { ok: false, error: "No recibimos la foto del formato. Vuelve a adjuntarla." };
    }

    const [version] = await processImage(original, { widths: DOCUMENT_WIDTHS });
    await storage.upload("consent-documents", documentPath, version!.data, "image/webp");

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("consent_records")
      .insert({ ...fields.data, document_path: documentPath, activity_id: activityId })
      .select("id")
      .single();
    if (error || !data) {
      await storage.remove("consent-documents", [documentPath]).catch(() => undefined);
      return { ok: false, error: "No se pudo registrar la autorización." };
    }
    return { ok: true, id: data.id };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof ImageRejectedError
          ? "La foto del formato no es una imagen válida."
          : "No se pudo registrar la autorización.",
    };
  } finally {
    // The original photo of the form is never kept
    await storage.remove("media-incoming", [incoming]).catch(() => undefined);
  }
}

/** "Registrar autorización" page: registers it and opens its page. */
export async function createConsent(
  _prev: ConsentFormState,
  formData: FormData,
): Promise<ConsentFormState> {
  const authorized = await authorizeAction("consent.manage");
  if (!authorized.ok) return { error: authorized.error };

  const result = await registerConsent(formData, null);
  if (!result.ok) return { error: result.error };

  revalidatePath(CONSENTS_PATH, "layout");
  redirect(`${CONSENTS_PATH}/${result.id}`);
}

/**
 * From the activity wizard (docs/07 §6.5, step 3): registers an authorization
 * signed for that activity and links it to the photo in one go.
 */
export async function createConsentForPhoto(
  _prev: ConsentFormState,
  formData: FormData,
): Promise<ConsentFormState> {
  const authorized = await authorizeAction("consent.manage");
  if (!authorized.ok) return { error: authorized.error };

  const mediaId = idSchema.safeParse(formData.get("mediaId"));
  if (!mediaId.success) return { error: "Foto no válida." };
  const activityId = idSchema.safeParse(formData.get("activityId"));

  const result = await registerConsent(formData, activityId.success ? activityId.data : null);
  if (!result.ok) return { error: result.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("media_consents")
    .insert({ media_id: mediaId.data, consent_record_id: result.id });
  if (!error) await syncPublicMediaAfter([mediaId.data]);
  revalidateLinks();
  if (error) {
    return {
      error:
        "La autorización quedó registrada, pero no se pudo vincular. Vincúlala con el buscador.",
    };
  }
  return { notice: "Autorización registrada y vinculada a la foto.", done: true };
}

/** Fixes the text of an authorization; the signed form cannot be replaced. */
export async function updateConsent(
  _prev: ConsentFormState,
  formData: FormData,
): Promise<ConsentFormState> {
  const authorized = await authorizeAction("consent.manage");
  if (!authorized.ok) return { error: authorized.error };

  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return { error: "Autorización no válida." };
  const fields = readConsentFields(formData);
  if (!fields.success) return { error: firstIssue(fields.error.issues) };

  const attempt = await getRateLimiter().limit(
    RATE_LIMITS.panelActions,
    rateLimitKey(authorized.auth.user.id),
  );
  if (!attempt.success) return { error: "Demasiadas acciones seguidas. Espera un momento." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("consent_records")
    .update(fields.data)
    .eq("id", id.data)
    .is("deleted_at", null)
    .is("revoked_at", null)
    .select("id");
  if (error || data.length === 0) return { error: "No se pudieron guardar los cambios." };

  // The validity or the minor's opinion may have changed
  await syncLinkedPhotos(id.data);
  revalidatePath(CONSENTS_PATH, "layout");
  return { notice: "Cambios guardados." };
}

/**
 * Revocation (RB-005): final, with a note. Photos that relied on it stop
 * being publishable at once (private.media_publish_issues).
 */
export async function revokeConsent(
  _prev: ConsentFormState,
  formData: FormData,
): Promise<ConsentFormState> {
  const authorized = await authorizeAction("consent.manage");
  if (!authorized.ok) return { error: authorized.error };

  const parsed = revokeSchema.safeParse({ id: formData.get("id"), note: formData.get("note") });
  if (!parsed.success) return { error: firstIssue(parsed.error.issues) };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("consent_records")
    .update({ revoked_at: new Date().toISOString(), revocation_note: parsed.data.note })
    .eq("id", parsed.data.id)
    .is("revoked_at", null)
    .is("deleted_at", null)
    .select("id");
  if (error || data.length === 0) return { error: "No se pudo revocar la autorización." };

  await syncLinkedPhotos(parsed.data.id);
  revalidatePath(CONSENTS_PATH, "layout");
  revalidatePath("/admin/medios", "layout");
  return { notice: "Autorización revocada." };
}

export type ConsentOption = {
  id: string;
  subjectName: string;
  isMinor: boolean;
  signerType: SignerType;
  grantedOn: string;
};

const LINK_SEARCH_LIMIT = 10;

/**
 * Authorizations that can be linked to a photo: not revoked, not expired,
 * not in the trash and not linked yet. Search by name.
 */
export async function searchConsentsToLink(
  mediaId: string,
  query: string,
): Promise<{ ok: true; options: ConsentOption[] } | { ok: false; error: string }> {
  const authorized = await authorizeAction("consent.manage");
  if (!authorized.ok) return { ok: false, error: authorized.error };

  const media = idSchema.safeParse(mediaId);
  const text = query.trim().slice(0, 80);
  if (!media.success) return { ok: false, error: "Foto no válida." };

  const supabase = await createClient();
  const [linked, found] = await Promise.all([
    supabase.from("media_consents").select("consent_record_id").eq("media_id", media.data),
    supabase
      .from("consent_records")
      .select("id, subject_name, is_minor, minor_opinion, signer_type, granted_on, valid_until")
      .is("deleted_at", null)
      .is("revoked_at", null)
      .ilike("subject_name", `%${escapeLike(text)}%`)
      .order("granted_on", { ascending: false })
      .limit(LINK_SEARCH_LIMIT * 2),
  ]);
  if (linked.error || found.error) return { ok: false, error: "No se pudo buscar." };

  const already = new Set(linked.data.map((link) => link.consent_record_id));
  const options = found.data
    .filter(
      (row) =>
        !already.has(row.id) &&
        consentStatus({
          revokedAt: null,
          validUntil: row.valid_until,
          isMinor: row.is_minor,
          minorOpinion: row.minor_opinion as MinorOpinion | null,
        }) === "active",
    )
    .slice(0, LINK_SEARCH_LIMIT)
    .map((row) => ({
      id: row.id,
      subjectName: row.subject_name,
      isMinor: row.is_minor,
      signerType: row.signer_type as SignerType,
      grantedOn: row.granted_on,
    }));
  return { ok: true, options };
}

function revalidateLinks() {
  revalidatePath("/admin/medios", "layout");
  revalidatePath(CONSENTS_PATH, "layout");
}

/** Links an authorization to a photo (RLS: consent.manage + MFA; audited). */
export async function linkConsent(
  mediaId: string,
  consentId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const authorized = await authorizeAction("consent.manage");
  if (!authorized.ok) return { ok: false, error: authorized.error };

  const media = idSchema.safeParse(mediaId);
  const consent = idSchema.safeParse(consentId);
  if (!media.success || !consent.success) return { ok: false, error: "Datos no válidos." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("media_consents")
    .insert({ media_id: media.data, consent_record_id: consent.data });
  if (error) {
    return {
      ok: false,
      error:
        error.code === "23505"
          ? "Esa autorización ya está vinculada a la foto."
          : "No se pudo vincular la autorización.",
    };
  }

  await syncPublicMediaAfter([media.data]);
  revalidateLinks();
  return { ok: true };
}

/** Removes the link (the authorization itself is kept). */
export async function unlinkConsent(
  linkId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const authorized = await authorizeAction("consent.manage");
  if (!authorized.ok) return { ok: false, error: authorized.error };

  const link = idSchema.safeParse(linkId);
  if (!link.success) return { ok: false, error: "Vínculo no válido." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("media_consents")
    .delete()
    .eq("id", link.data)
    .select("media_id");
  if (error || data.length === 0) return { ok: false, error: "No se pudo desvincular." };

  await syncPublicMediaAfter(data.map((row) => row.media_id));
  revalidateLinks();
  return { ok: true };
}

export type PersonConsent = {
  id: string;
  subjectName: string;
  grantedOn: string;
  validUntil: string | null;
};

/**
 * Authorizations that can back a testimonial or a team profile (step 7.6d):
 * adults only, not revoked, not expired, not in the trash. Search by name.
 */
export async function searchPersonConsents(
  query: string,
): Promise<{ ok: true; options: PersonConsent[] } | { ok: false; error: string }> {
  const authorized = await authorizeAction("consent.manage");
  if (!authorized.ok) return { ok: false, error: authorized.error };
  const text = query.trim().slice(0, 80);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("consent_records")
    .select("id, subject_name, is_minor, minor_opinion, granted_on, valid_until, revoked_at")
    .is("deleted_at", null)
    .is("revoked_at", null)
    .eq("is_minor", false)
    .ilike("subject_name", `%${escapeLike(text)}%`)
    .order("granted_on", { ascending: false })
    .limit(LINK_SEARCH_LIMIT * 2);
  if (error) return { ok: false, error: "No se pudo buscar." };

  const options = data
    .filter(
      (row) =>
        consentStatus({
          revokedAt: row.revoked_at,
          validUntil: row.valid_until,
          isMinor: row.is_minor,
          minorOpinion: row.minor_opinion as MinorOpinion | null,
        }) === "active",
    )
    .slice(0, LINK_SEARCH_LIMIT)
    .map((row) => ({
      id: row.id,
      subjectName: row.subject_name,
      grantedOn: row.granted_on,
      validUntil: row.valid_until,
    }));
  return { ok: true, options };
}
