import { z } from "zod";

import {
  type CheckItem,
  coverCheck,
  ownerColumns,
  ownerSchema,
  reviewOutcome,
} from "@/modules/content/shared";

import { parseVideoUrl } from "./parse";

// Videos (step 7.6c, docs/06 §5). Pure: unit-tested in schema.test.ts.

export const VIDEOS_PATH = "/admin/contenido/videos";

/** What the editor form holds: the pasted link, never stored as such. */
export type VideoValues = { title: string; description: string; url: string; owner: string };

export const videoSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Escribe el título del video.")
      .max(160, "El título es demasiado largo (máximo 160 caracteres)."),
    description: z
      .string()
      .trim()
      .max(1000, "La descripción es demasiado larga (máximo 1000 caracteres).")
      .transform((text) => (text === "" ? null : text)),
    url: z.string(),
    owner: ownerSchema,
  })
  .transform((data, context) => {
    const video = parseVideoUrl(data.url);
    if (!video.ok) {
      context.addIssue({ code: "custom", path: ["url"], message: video.error });
      return z.NEVER;
    }
    // Only the provider and the id are kept (docs/05 §6)
    return {
      title: data.title,
      description: data.description,
      provider: video.provider,
      provider_video_id: video.id,
      ...ownerColumns(data.owner),
    };
  });

export type VideoInput = z.input<typeof videoSchema>;

/** Before sending or publishing: only the optional cover can need something. */
export function reviewVideo(coverIssues: readonly string[] | null, publisher: boolean) {
  const items: CheckItem[] = [
    { key: "video", level: "ok", text: "El enlace del video es válido." },
    coverCheck("video", coverIssues, publisher),
  ];
  return reviewOutcome(items, publisher);
}
