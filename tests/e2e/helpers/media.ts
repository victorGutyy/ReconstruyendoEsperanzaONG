import sharp from "sharp";

import { adminClient } from "./users";

/**
 * A processed [DEMO] photo owned by `uploaderId`, created directly like the
 * server would (row + private files), so library tests do not upload each time.
 */
export async function createTestPhoto(
  uploaderId: string,
  fields: { alt_text?: string | null; people_in_photo?: string | null } = {},
) {
  const admin = adminClient();
  const { data, error } = await admin
    .from("media")
    .insert({
      uploaded_by: uploaderId,
      processing_status: "processing",
      alt_text: fields.alt_text ?? null,
      people_in_photo: fields.people_in_photo ?? null,
    })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("could not create the test photo");

  const image = sharp({ create: { width: 800, height: 600, channels: 3, background: "#6b8f5e" } });
  for (const [size, width] of [
    ["sm", 480],
    ["md", 800],
    ["lg", 1200],
  ] as const) {
    const file = await image.clone().resize({ width }).webp().toBuffer();
    const { error: uploadError } = await admin.storage
      .from("media-private")
      .upload(`${data.id}/${size}.webp`, file, { contentType: "image/webp", upsert: true });
    if (uploadError) throw uploadError;
  }

  const { error: readyError } = await admin
    .from("media")
    .update({
      processing_status: "ready",
      private_path: data.id,
      mime_type: "image/webp",
      width: 800,
      height: 600,
      bytes: 1,
    })
    .eq("id", data.id);
  if (readyError) throw readyError;

  return data.id;
}

/** A [DEMO] image authorization created directly (the form file is not needed here). */
export async function createTestConsent(
  creatorId: string,
  fields: {
    subject_name: string;
    is_minor?: boolean;
    minor_opinion?: string | null;
    signer_type?: string;
    signer_name?: string | null;
    revoked_at?: string | null;
  },
) {
  const isMinor = fields.is_minor ?? false;
  const { data, error } = await adminClient()
    .from("consent_records")
    .insert({
      subject_name: fields.subject_name,
      is_minor: isMinor,
      minor_opinion: fields.minor_opinion ?? (isMinor ? "agrees" : null),
      signer_type: fields.signer_type ?? (isMinor ? "legal_guardian" : "self"),
      signer_name: fields.signer_name ?? (isMinor ? "[DEMO] Madre" : null),
      scope_description: "[DEMO] Fotos de la jornada",
      granted_on: "2026-03-12",
      channel: "paper",
      form_version: "v1",
      document_path: "demo-no-file.webp",
      revoked_at: fields.revoked_at ?? null,
      created_by: creatorId,
      updated_by: creatorId,
    })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("could not create the test authorization");
  return data.id;
}
