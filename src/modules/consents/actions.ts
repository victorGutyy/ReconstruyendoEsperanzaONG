"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { authorizeAction } from "@/lib/auth/guard";
import { ImageRejectedError, processImage } from "@/lib/images/process";
import { getRateLimiter, RATE_LIMITS, rateLimitKey } from "@/lib/rate-limit";
import { supabasePrivateStorage } from "@/lib/storage/supabase";
import { createClient } from "@/lib/supabase/server";

import {
  consentPaths,
  type ConsentFormState,
  DOCUMENT_WIDTHS,
  idSchema,
  readConsentFields,
  revokeSchema,
} from "./schema";

const CONSENTS_PATH = "/admin/autorizaciones";
const UPLOAD_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

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
export async function createConsent(
  _prev: ConsentFormState,
  formData: FormData,
): Promise<ConsentFormState> {
  const authorized = await authorizeAction("consent.manage");
  if (!authorized.ok) return { error: authorized.error };

  const uploadId = idSchema.safeParse(formData.get("uploadId"));
  if (!uploadId.success) return { error: "Adjunta la foto del formato firmado." };

  const storage = supabasePrivateStorage();
  const incoming = consentPaths.incoming(uploadId.data);
  const documentPath = consentPaths.document(uploadId.data);
  let recordId: string;

  try {
    // The browser checks the fields before uploading; this is the real check
    const fields = readConsentFields(formData);
    if (!fields.success) return { error: firstIssue(fields.error.issues) };

    const original = await storage.download("media-incoming", incoming);
    if (!original) return { error: "No recibimos la foto del formato. Vuelve a adjuntarla." };

    const [version] = await processImage(original, { widths: DOCUMENT_WIDTHS });
    await storage.upload("consent-documents", documentPath, version!.data, "image/webp");

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("consent_records")
      .insert({ ...fields.data, document_path: documentPath })
      .select("id")
      .single();
    if (error || !data) {
      await storage.remove("consent-documents", [documentPath]).catch(() => undefined);
      return { error: "No se pudo registrar la autorización." };
    }
    recordId = data.id;
  } catch (error) {
    return {
      error:
        error instanceof ImageRejectedError
          ? "La foto del formato no es una imagen válida."
          : "No se pudo registrar la autorización.",
    };
  } finally {
    // The original photo of the form is never kept
    await storage.remove("media-incoming", [incoming]).catch(() => undefined);
  }

  revalidatePath(CONSENTS_PATH, "layout");
  redirect(`${CONSENTS_PATH}/${recordId}`);
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

  revalidatePath(CONSENTS_PATH, "layout");
  revalidatePath("/admin/medios", "layout");
  return { notice: "Autorización revocada." };
}
