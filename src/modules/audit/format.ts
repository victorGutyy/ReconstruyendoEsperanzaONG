// Turns raw audit rows into what a person reads. Pure: unit-tested in format.test.ts.
//
// Only allow-listed fields are ever shown (docs/05 §11): the raw old/new JSON
// is never rendered, so a column added later cannot leak by accident.

import type { AuditAction, AuditSection } from "./schema";

export type AuditEntry = {
  id: number;
  occurredAt: string;
  actorId: string | null;
  action: string;
  tableName: string;
  recordId: string;
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  changedFields: string[];
};

/** Names resolved outside the log (the log itself has no foreign keys). */
export type AuditLookups = {
  people: ReadonlyMap<string, string>;
  roles: ReadonlyMap<number, string>;
};

export type FieldChange = { field: string; label: string; before: string; after: string };

export const ACTION_LABELS: Record<AuditAction, string> = {
  insert: "Creó",
  update: "Editó",
  delete: "Eliminó",
  soft_delete: "Envió a la papelera",
  restore: "Restauró",
  publish: "Publicó",
  unpublish: "Despublicó",
  role_change: "Cambió el rol",
  status_change: "Cambió el estado",
};

type FieldKind =
  | { type: "text" }
  | { type: "role" }
  | { type: "active" }
  | { type: "yesNo" }
  /** "Sí" when the column has any value (e.g. a revocation date). */
  | { type: "present" }
  | { type: "person" }
  /** An instant, shown as date and time in Colombia. */
  | { type: "datetime" }
  /** Fixed values stored as keys: the labels live here, not in another module. */
  | { type: "enum"; labels: Readonly<Record<string, string>> };

const TEXT: FieldKind = { type: "text" };
const DATETIME: FieldKind = { type: "datetime" };

const dateTimeFormat = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Bogota",
});

type SectionConfig = {
  label: string;
  singular: string;
  /** Column that names the record in the list. */
  nameField: string;
  /** Shown when that column is empty (default: "<singular> sin nombre"). */
  untitled?: string;
  fields: ReadonlyArray<{ key: string; label: string; kind: FieldKind }>;
};

export const SECTIONS: Record<AuditSection, SectionConfig> = {
  profiles: {
    label: "Usuarios",
    singular: "Usuario",
    nameField: "full_name",
    fields: [
      { key: "full_name", label: "Nombre", kind: TEXT },
      { key: "email", label: "Correo", kind: TEXT },
      { key: "role_id", label: "Rol", kind: { type: "role" } },
      { key: "is_active", label: "Estado", kind: { type: "active" } },
      { key: "invited_by", label: "Invitada por", kind: { type: "person" } },
    ],
  },
  places: {
    label: "Lugares",
    singular: "Lugar",
    nameField: "name",
    fields: [
      { key: "name", label: "Nombre", kind: TEXT },
      { key: "slug", label: "Slug", kind: TEXT },
      {
        key: "kind",
        label: "Tipo",
        kind: {
          type: "enum",
          labels: {
            municipality: "Municipio",
            neighborhood: "Barrio",
            vereda: "Vereda",
            sector: "Sector",
            other: "Otro",
          },
        },
      },
      { key: "is_active", label: "Activo", kind: { type: "yesNo" } },
    ],
  },
  categories: {
    label: "Categorías",
    singular: "Categoría",
    nameField: "name",
    fields: [
      {
        key: "scope",
        label: "Para",
        kind: { type: "enum", labels: { activity: "Actividades", post: "Historias" } },
      },
      { key: "name", label: "Nombre", kind: TEXT },
      { key: "slug", label: "Slug", kind: TEXT },
      { key: "description", label: "Descripción", kind: TEXT },
      { key: "position", label: "Orden", kind: TEXT },
    ],
  },
  // Photos: descriptive fields only, never storage paths or keys
  media: {
    label: "Fotos",
    singular: "Foto",
    nameField: "alt_text",
    untitled: "Foto sin descripción",
    fields: [
      { key: "alt_text", label: "Descripción", kind: TEXT },
      {
        key: "people_in_photo",
        label: "¿Personas?",
        kind: {
          type: "enum",
          labels: { none: "No", identifiable: "Sí, adultos", minors: "Sí, hay menores" },
        },
      },
      { key: "caption", label: "Pie de foto", kind: TEXT },
      { key: "credit", label: "Crédito", kind: TEXT },
      {
        key: "processing_status",
        label: "Procesamiento",
        kind: {
          type: "enum",
          labels: { processing: "En proceso", ready: "Lista", failed: "Falló" },
        },
      },
      // Only whether it is public: the public key itself is never shown
      { key: "public_key", label: "En el sitio", kind: { type: "present" } },
    ],
  },
  // Authorizations: personal data, read only by audit.read (admins, who also
  // have consent.manage). Never the path of the signed form.
  consent_records: {
    label: "Autorizaciones",
    singular: "Autorización",
    nameField: "subject_name",
    fields: [
      { key: "subject_name", label: "Persona", kind: TEXT },
      { key: "is_minor", label: "Menor de edad", kind: { type: "yesNo" } },
      {
        key: "minor_opinion",
        label: "Opinión del menor",
        kind: {
          type: "enum",
          labels: {
            agrees: "Está de acuerdo",
            disagrees: "No quiere aparecer",
            not_applicable: "No aplica por su edad",
          },
        },
      },
      {
        key: "signer_type",
        label: "Firmó",
        kind: {
          type: "enum",
          labels: { self: "La misma persona", legal_guardian: "Su representante legal" },
        },
      },
      { key: "signer_name", label: "Representante", kind: TEXT },
      { key: "scope_description", label: "Qué cubre", kind: TEXT },
      { key: "granted_on", label: "Fecha de firma", kind: TEXT },
      { key: "valid_until", label: "Válida hasta", kind: TEXT },
      {
        key: "channel",
        label: "Se firmó en",
        kind: { type: "enum", labels: { paper: "Papel", digital: "Digital" } },
      },
      { key: "form_version", label: "Versión del formato", kind: TEXT },
      { key: "revoked_at", label: "Revocada", kind: { type: "present" } },
      { key: "revocation_note", label: "Motivo de la revocación", kind: TEXT },
    ],
  },
  // Links between a photo and an authorization: the action says what happened
  media_consents: {
    label: "Vínculos foto–autorización",
    singular: "Vínculo",
    nameField: "__none__",
    untitled: "Vínculo entre una foto y una autorización",
    fields: [],
  },
  // Activities: what a person reads; the story body is not repeated here
  activities: {
    label: "Actividades",
    singular: "Actividad",
    nameField: "title",
    fields: [
      { key: "title", label: "Título", kind: TEXT },
      {
        key: "status",
        label: "Estado",
        kind: {
          type: "enum",
          labels: {
            draft: "Borrador",
            review: "En revisión",
            published: "Publicada",
            archived: "Archivada",
          },
        },
      },
      { key: "published_at", label: "Fecha de publicación", kind: DATETIME },
      { key: "starts_at", label: "Inicio", kind: DATETIME },
      { key: "ends_at", label: "Fin", kind: DATETIME },
      { key: "summary", label: "Resumen", kind: TEXT },
      { key: "slug", label: "Slug", kind: TEXT },
      { key: "cover_media_id", label: "Tiene portada", kind: { type: "present" } },
      { key: "review_note", label: "Nota de revisión", kind: TEXT },
    ],
  },
  // Stories: what a person reads; the story body is not repeated here
  posts: {
    label: "Historias",
    singular: "Historia",
    nameField: "title",
    fields: [
      { key: "title", label: "Título", kind: TEXT },
      {
        key: "status",
        label: "Estado",
        kind: {
          type: "enum",
          labels: {
            draft: "Borrador",
            review: "En revisión",
            published: "Publicada",
            archived: "Archivada",
          },
        },
      },
      { key: "published_at", label: "Fecha de publicación", kind: DATETIME },
      { key: "excerpt", label: "Extracto", kind: TEXT },
      { key: "byline", label: "Firma", kind: TEXT },
      { key: "slug", label: "Slug", kind: TEXT },
      { key: "cover_media_id", label: "Tiene portada", kind: { type: "present" } },
      { key: "review_note", label: "Nota de revisión", kind: TEXT },
    ],
  },
  activity_media: {
    label: "Fotos de actividades",
    singular: "Foto de actividad",
    nameField: "__none__",
    untitled: "Foto de una actividad",
    fields: [{ key: "position", label: "Orden", kind: TEXT }],
  },
  activity_tags: {
    label: "Etiquetas de actividades",
    singular: "Etiqueta de actividad",
    nameField: "__none__",
    untitled: "Etiqueta de una actividad",
    fields: [],
  },
  tags: {
    label: "Etiquetas",
    singular: "Etiqueta",
    nameField: "name",
    fields: [
      { key: "name", label: "Nombre", kind: TEXT },
      { key: "slug", label: "Slug", kind: TEXT },
    ],
  },
};

const EMPTY = "—";
const UNKNOWN_PERSON = "Persona sin nombre visible";
const MAX_TEXT = 200;

function sectionOf(tableName: string): SectionConfig | null {
  return Object.hasOwn(SECTIONS, tableName) ? SECTIONS[tableName as AuditSection] : null;
}

export function actionLabel(action: string): string {
  return Object.hasOwn(ACTION_LABELS, action) ? ACTION_LABELS[action as AuditAction] : action;
}

export function actorLabel(actorId: string | null, lookups: AuditLookups): string {
  if (actorId === null) return "Sistema";
  return lookups.people.get(actorId) ?? UNKNOWN_PERSON;
}

/** "Usuario: [DEMO] Ana", from the newest known name of the record. */
export function recordLabel(entry: AuditEntry): string {
  const section = sectionOf(entry.tableName);
  if (!section) return entry.tableName;

  const name = entry.newData?.[section.nameField] ?? entry.oldData?.[section.nameField];
  return typeof name === "string" && name.trim() !== ""
    ? `${section.singular}: ${truncate(name)}`
    : (section.untitled ?? `${section.singular} sin nombre`);
}

function truncate(text: string): string {
  return text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT)}…` : text;
}

function formatValue(kind: FieldKind, value: unknown, lookups: AuditLookups): string {
  if (value === null || value === undefined || value === "") return EMPTY;

  switch (kind.type) {
    case "role":
      return lookups.roles.get(Number(value)) ?? "Rol desconocido";
    case "active":
      return value === true ? "Activa" : "Desactivada";
    case "yesNo":
      return value === true ? "Sí" : "No";
    case "present":
      return "Sí";
    case "enum":
      return typeof value === "string" && Object.hasOwn(kind.labels, value)
        ? kind.labels[value]!
        : String(value);
    case "person":
      return typeof value === "string" ? (lookups.people.get(value) ?? UNKNOWN_PERSON) : EMPTY;
    case "datetime": {
      const date = typeof value === "string" ? new Date(value) : null;
      return date && !Number.isNaN(date.getTime()) ? dateTimeFormat.format(date) : String(value);
    }
    case "text":
      return truncate(typeof value === "string" ? value : JSON.stringify(value));
  }
}

/**
 * The visible "before → after" lines, plus how many changed fields are not
 * shown (technical or not allow-listed). Creations only have "after" values
 * and deletions only "before" values.
 */
export function describeChanges(
  entry: AuditEntry,
  lookups: AuditLookups,
): { changes: FieldChange[]; hidden: number } {
  const section = sectionOf(entry.tableName);
  if (!section) return { changes: [], hidden: entry.changedFields.length };

  const isUpdate = entry.oldData !== null && entry.newData !== null;
  const shown = section.fields.filter((field) =>
    isUpdate
      ? entry.changedFields.includes(field.key)
      : (entry.newData ?? entry.oldData)?.[field.key] != null,
  );

  const changes = shown.map((field) => ({
    field: field.key,
    label: field.label,
    before: entry.oldData ? formatValue(field.kind, entry.oldData[field.key], lookups) : EMPTY,
    after: entry.newData ? formatValue(field.kind, entry.newData[field.key], lookups) : EMPTY,
  }));

  const hidden = isUpdate ? entry.changedFields.length - changes.length : 0;
  return { changes, hidden };
}
