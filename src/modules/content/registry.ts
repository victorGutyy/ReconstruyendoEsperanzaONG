// Content types on the shared engine (step 7.6, docs/06 §1.1). Pure: no server
// imports, unit-tested in registry.test.ts. Each new type (7.6b–e) adds a line.

export const CONTENT_TYPES = {
  activity: {
    table: "activities",
    singular: "actividad",
    feminine: true,
    listPath: "/admin/actividades",
    editPath: (id: string) => `/admin/actividades/${id}/editar`,
  },
  post: {
    table: "posts",
    singular: "historia",
    feminine: true,
    listPath: "/admin/contenido/historias",
    editPath: (id: string) => `/admin/contenido/historias/${id}`,
  },
  project: {
    table: "projects",
    singular: "proyecto",
    feminine: false,
    listPath: "/admin/contenido/proyectos",
    editPath: (id: string) => `/admin/contenido/proyectos/${id}`,
  },
} as const;

export type ContentType = keyof typeof CONTENT_TYPES;

/** Tabs of the "Contenido" section (activities have their own menu item). */
export const CONTENT_TABS = [
  { type: "post", label: "Historias" },
  { type: "project", label: "Proyectos" },
] as const satisfies readonly {
  type: ContentType;
  label: string;
}[];
export type ContentTable = (typeof CONTENT_TYPES)[ContentType]["table"];
export type ContentStatus = "draft" | "review" | "published" | "archived";

/** Spanish agreement: "la historia … publicada", "el proyecto … publicado". */
export function agree(type: ContentType, feminine: string, masculine: string): string {
  return CONTENT_TYPES[type].feminine ? feminine : masculine;
}

/** "La historia", "El proyecto". */
export const theType = (type: ContentType) =>
  `${agree(type, "La", "El")} ${CONTENT_TYPES[type].singular}`;

/** "Esta historia", "Este proyecto". */
export const thisType = (type: ContentType) =>
  `${agree(type, "Esta", "Este")} ${CONTENT_TYPES[type].singular}`;

export function isContentType(value: unknown): value is ContentType {
  return typeof value === "string" && Object.hasOwn(CONTENT_TYPES, value);
}

/** Editor actions on the state of any content (step 7.4b, decision F7-D7). */
export type StatusChange = "returned" | "retired" | "archived" | "reopened";

export const STATUS_CHANGES: Record<StatusChange, { from: ContentStatus; to: ContentStatus }> = {
  returned: { from: "review", to: "draft" },
  retired: { from: "published", to: "draft" },
  archived: { from: "published", to: "archived" },
  reopened: { from: "archived", to: "draft" },
};

/** Which changes an editor can make from each state. */
export const AVAILABLE_CHANGES: Record<ContentStatus, StatusChange[]> = {
  draft: [],
  review: ["returned"],
  published: ["retired", "archived"],
  archived: ["reopened"],
};

export const STATUS_LABELS = {
  draft: "Borrador",
  review: "En revisión",
  published: "Publicada",
  scheduled: "Programada",
  archived: "Archivada",
} as const;

/** "Scheduled" is published with a future date (docs/06 §1.1). */
export function displayStatus(
  status: ContentStatus,
  publishedAt: string | null,
  now = new Date(),
): keyof typeof STATUS_LABELS {
  if (status === "published" && publishedAt && new Date(publishedAt) > now) return "scheduled";
  return status;
}

const MASCULINE_STATUS_LABELS: Record<keyof typeof STATUS_LABELS, string> = {
  draft: "Borrador",
  review: "En revisión",
  published: "Publicado",
  scheduled: "Programado",
  archived: "Archivado",
};

/** A state key as shown for this type ("Publicada" historia, "Publicado" proyecto). */
export function labelFor(type: ContentType, key: keyof typeof STATUS_LABELS): string {
  return CONTENT_TYPES[type].feminine ? STATUS_LABELS[key] : MASCULINE_STATUS_LABELS[key];
}

/** The state of an item as shown for its type. */
export function statusLabel(
  type: ContentType,
  status: ContentStatus,
  publishedAt: string | null,
  now = new Date(),
): string {
  return labelFor(type, displayStatus(status, publishedAt, now));
}
