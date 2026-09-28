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
