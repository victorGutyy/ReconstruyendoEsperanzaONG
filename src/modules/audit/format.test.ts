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
