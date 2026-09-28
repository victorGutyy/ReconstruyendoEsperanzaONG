import { describe, expect, it } from "vitest";

import {
  actionLabel,
  actorLabel,
  type AuditEntry,
  type AuditLookups,
  describeChanges,
  recordLabel,
} from "./format";

const ADMIN = "aaaaaaaa-0000-0000-0000-000000000001";
const MEMBER = "dddddddd-0000-0000-0000-000000000006";

const lookups: AuditLookups = {
  people: new Map([[ADMIN, "[DEMO] Admin"]]),
  roles: new Map([
    [1, "Administrador"],
    [2, "Editor"],
    [3, "Autor"],
  ]),
};

function entry(overrides: Partial<AuditEntry>): AuditEntry {
  return {
    id: 1,
    occurredAt: "2026-09-26T15:00:00Z",
    actorId: ADMIN,
    action: "update",
    tableName: "profiles",
    recordId: MEMBER,
    oldData: null,
    newData: null,
    changedFields: [],
    ...overrides,
  };
}

describe("labels", () => {
  it("names actions in Spanish and leaves unknown ones as they are", () => {
    expect(actionLabel("role_change")).toBe("Cambió el rol");
    expect(actionLabel("something_new")).toBe("something_new");
  });

  it("names the actor, the system, or an unreadable person", () => {
    expect(actorLabel(ADMIN, lookups)).toBe("[DEMO] Admin");
    expect(actorLabel(null, lookups)).toBe("Sistema");
    expect(actorLabel(MEMBER, lookups)).toBe("Persona sin nombre visible");
  });

  it("names the record with its newest name", () => {
    expect(
      recordLabel(
        entry({ oldData: { full_name: "Ana" }, newData: { full_name: "[DEMO] Ana María" } }),
      ),
    ).toBe("Usuario: [DEMO] Ana María");
    expect(recordLabel(entry({ oldData: { full_name: "Ana" } }))).toBe("Usuario: Ana");
    expect(recordLabel(entry({ newData: { full_name: "" } }))).toBe("Usuario sin nombre");
    expect(recordLabel(entry({ tableName: "unknown_table" }))).toBe("unknown_table");
  });
});

describe("describeChanges", () => {
  it("shows a role change with role names", () => {
    const result = describeChanges(
      entry({
        action: "role_change",
        oldData: { role_id: 3, updated_at: "a" },
        newData: { role_id: 2, updated_at: "b" },
        changedFields: ["role_id"],
      }),
      lookups,
    );
    expect(result).toEqual({
      changes: [{ field: "role_id", label: "Rol", before: "Autor", after: "Editor" }],
      hidden: 0,
    });
  });

  it("shows a deactivation as a status", () => {
    const { changes } = describeChanges(
      entry({
        oldData: { is_active: true },
        newData: { is_active: false },
        changedFields: ["is_active"],
      }),
      lookups,
    );
    expect(changes).toEqual([
      { field: "is_active", label: "Estado", before: "Activa", after: "Desactivada" },
    ]);
  });

  it("never shows fields outside the allow-list, only counts them", () => {
    const result = describeChanges(
      entry({
        oldData: { full_name: "Ana", secret_note: "x" },
        newData: { full_name: "Ana M.", secret_note: "y" },
        changedFields: ["full_name", "secret_note"],
      }),
      lookups,
    );
    expect(result.changes.map((change) => change.field)).toEqual(["full_name"]);
    expect(result.hidden).toBe(1);
    expect(JSON.stringify(result)).not.toContain("secret_note");
  });

  it("shows a creation with the filled fields only", () => {
    const { changes } = describeChanges(
      entry({
        action: "insert",
        actorId: null,
        newData: { full_name: "Ana", email: "ana@example.test", role_id: null, invited_by: ADMIN },
      }),
      lookups,
    );
    expect(changes).toEqual([
      { field: "full_name", label: "Nombre", before: "—", after: "Ana" },
      { field: "email", label: "Correo", before: "—", after: "ana@example.test" },
      { field: "invited_by", label: "Invitada por", before: "—", after: "[DEMO] Admin" },
    ]);
  });

  it("shows nothing for a table without a configured section", () => {
    expect(
      describeChanges(
        entry({
          tableName: "unknown_table",
          oldData: { a: 1 },
          newData: { a: 2 },
          changedFields: ["a"],
        }),
        lookups,
      ),
    ).toEqual({ changes: [], hidden: 1 });
  });

  it("truncates very long text", () => {
    const { changes } = describeChanges(
      entry({
        oldData: { full_name: "a" },
        newData: { full_name: "b".repeat(500) },
        changedFields: ["full_name"],
      }),
      lookups,
    );
    expect(changes[0]?.after).toHaveLength(201);
  });
});

describe("taxonomy sections", () => {
  it("names places and shows their kind and state in Spanish", () => {
    const place = entry({
      action: "status_change",
      tableName: "places",
      oldData: { name: "[DEMO] Barrio", kind: "neighborhood", is_active: true },
      newData: { name: "[DEMO] Barrio", kind: "vereda", is_active: false },
      changedFields: ["kind", "is_active"],
    });
    expect(recordLabel(place)).toBe("Lugar: [DEMO] Barrio");
    expect(describeChanges(place, lookups).changes).toEqual([
      { field: "kind", label: "Tipo", before: "Barrio", after: "Vereda" },
      { field: "is_active", label: "Activo", before: "Sí", after: "No" },
    ]);
  });

  it("shows a category move as its new order", () => {
    const { changes } = describeChanges(
      entry({
        tableName: "categories",
        oldData: { name: "Salud", position: 2 },
        newData: { name: "Salud", position: 1 },
        changedFields: ["position"],
      }),
      lookups,
    );
    expect(changes).toEqual([{ field: "position", label: "Orden", before: "2", after: "1" }]);
  });

  it("does not show the trash date: the action already says it", () => {
    const result = describeChanges(
      entry({
        action: "soft_delete",
        tableName: "categories",
        oldData: { name: "Salud", deleted_at: null },
        newData: { name: "Salud", deleted_at: "2026-09-27T12:00:00Z" },
        changedFields: ["deleted_at"],
      }),
      lookups,
    );
    expect(result).toEqual({ changes: [], hidden: 1 });
  });
});

describe("media section", () => {
  it("names a photo by its description and shows the people choice in Spanish", () => {
    const photo = entry({
      tableName: "media",
      oldData: { alt_text: null, people_in_photo: null, private_path: "x" },
      newData: { alt_text: "Árboles", people_in_photo: "identifiable", private_path: "x" },
      changedFields: ["alt_text", "people_in_photo"],
    });
    expect(recordLabel(photo)).toBe("Foto: Árboles");
    expect(describeChanges(photo, lookups).changes).toEqual([
      { field: "alt_text", label: "Descripción", before: "—", after: "Árboles" },
      { field: "people_in_photo", label: "¿Personas?", before: "—", after: "Sí, adultos" },
    ]);
  });

  it("calls a photo without description by that name and never shows file paths", () => {
    const processed = entry({
      tableName: "media",
      oldData: { alt_text: null, processing_status: "processing", private_path: null },
      newData: { alt_text: null, processing_status: "ready", private_path: "abc" },
      changedFields: ["private_path", "processing_status"],
    });
    expect(recordLabel(processed)).toBe("Foto sin descripción");
    const result = describeChanges(processed, lookups);
    expect(result.changes.map((change) => change.field)).toEqual(["processing_status"]);
    expect(result.hidden).toBe(1);
  });
});
