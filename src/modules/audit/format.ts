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
  | { type: "person" }
  /** Fixed values stored as keys: the labels live here, not in another module. */
  | { type: "enum"; labels: Readonly<Record<string, string>> };

const TEXT: FieldKind = { type: "text" };

type SectionConfig = {
  label: string;
  singular: string;
  /** Column that names the record in the list. */
  nameField: string;
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
    : `${section.singular} sin nombre`;
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
    case "enum":
      return typeof value === "string" && Object.hasOwn(kind.labels, value)
        ? kind.labels[value]!
        : String(value);
    case "person":
      return typeof value === "string" ? (lookups.people.get(value) ?? UNKNOWN_PERSON) : EMPTY;
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
