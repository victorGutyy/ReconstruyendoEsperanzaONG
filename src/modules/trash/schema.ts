// Trash (step 7.7): which things go to it and how they are named. Pure: no
// server imports, unit-tested in schema.test.ts.

import { z } from "zod";

import { CONTENT_TYPES, type ContentType, isContentType } from "@/modules/content/shared";

export const TRASH_PATH = "/admin/papelera";

/** The four fixed pages never go to the trash (step 7.6e). */
export const TRASHABLE_TYPES = [
  "activity",
  "post",
  "project",
  "gallery",
  "video",
  "testimonial",
  "team_member",
] as const satisfies readonly ContentType[];

export type TrashableType = (typeof TRASHABLE_TYPES)[number];

/** Content, a photo or a contact message (step 8.7b). */
export type TrashKind = TrashableType | "media" | "message";

export const TRASH_KINDS: readonly TrashKind[] = [...TRASHABLE_TYPES, "media", "message"];

export function isTrashableType(value: unknown): value is TrashableType {
  return isContentType(value) && (TRASHABLE_TYPES as readonly string[]).includes(value);
}

export function isTrashKind(value: unknown): value is TrashKind {
  return value === "media" || value === "message" || isTrashableType(value);
}

/** Filter labels of the trash page. */
export const KIND_LABELS: Record<TrashKind, string> = {
  activity: "Actividades",
  post: "Historias",
  project: "Proyectos",
  gallery: "Galerías",
  video: "Videos",
  testimonial: "Testimonios",
  team_member: "Equipo",
  media: "Fotos",
  message: "Mensajes",
};

/** "Historia", "Foto": the label of one item. */
export function kindName(kind: TrashKind): string {
  if (kind === "media") return "Foto";
  if (kind === "message") return "Mensaje";
  const singular = CONTENT_TYPES[kind].singular;
  return singular.charAt(0).toUpperCase() + singular.slice(1);
}

/** The column shown as the name of each item. */
export const TITLE_COLUMNS: Record<TrashKind, string> = {
  activity: "title",
  post: "title",
  project: "title",
  gallery: "title",
  video: "title",
  testimonial: "author_display_name",
  team_member: "full_name",
  media: "alt_text",
  message: "full_name",
};

export const MEDIA_PATH = "/admin/medios";
export const MESSAGES_PATH = "/admin/mensajes";

/** Where an item lives in the panel. */
export function trashItemHref(kind: TrashKind, id: string): string {
  if (kind === "media") return `${MEDIA_PATH}/${id}`;
  if (kind === "message") return `${MESSAGES_PATH}/${id}`;
  return CONTENT_TYPES[kind].editPath(id);
}

/** The panel list that shows this kind. */
export function trashListPath(kind: TrashKind): string {
  if (kind === "media") return MEDIA_PATH;
  if (kind === "message") return MESSAGES_PATH;
  return CONTENT_TYPES[kind].listPath;
}

/** The word typed to confirm a permanent deletion (decision 7.7). */
export const PURGE_WORD = "ELIMINAR";

export const trashTargetSchema = z.object({
  kind: z.custom<TrashKind>(isTrashKind),
  id: z.uuid(),
});

export const purgeSchema = trashTargetSchema.extend({
  confirmation: z
    .string()
    .trim()
    .refine((value) => value === PURGE_WORD, `Escribe ${PURGE_WORD} para confirmar.`),
});

export function parseTrashFilter(value: string | string[] | undefined): TrashKind | null {
  const first = Array.isArray(value) ? value[0] : value;
  return isTrashKind(first) ? first : null;
}

export type TrashedItem = {
  kind: TrashKind;
  id: string;
  name: string;
  trashedAt: string;
  /** Who sent it, from the audit log; null when unknown. */
  trashedBy: string | null;
};
