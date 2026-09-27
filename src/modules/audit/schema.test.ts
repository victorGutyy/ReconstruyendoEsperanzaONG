import { describe, expect, it } from "vitest";

import { auditHref, dateRangeBounds, parseAuditFilters } from "./schema";

const ADMIN = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

describe("parseAuditFilters", () => {
  it("accepts valid filters", () => {
    expect(
      parseAuditFilters({
        actor: ADMIN,
        action: "role_change",
        section: "profiles",
        from: "2026-09-01",
        to: "2026-09-26",
        page: "3",
      }),
    ).toEqual({
      actor: ADMIN,
      action: "role_change",
      section: "profiles",
      from: "2026-09-01",
      to: "2026-09-26",
      page: 3,
    });
  });

  it("accepts the system as actor", () => {
    expect(parseAuditFilters({ actor: "sistema" }).actor).toBe("sistema");
  });

  it("ignores invalid values instead of failing", () => {
    expect(
      parseAuditFilters({
        actor: "'; drop table audit_logs; --",
        action: "hack",
        section: "auth.users",
        from: "2026-13-45",
        to: "ayer",
        page: "-2",
      }),
    ).toEqual({
      actor: undefined,
      action: undefined,
      section: undefined,
      from: undefined,
      to: undefined,
      page: 1,
    });
  });

  it("treats empty form fields and missing values as no filter", () => {
    expect(parseAuditFilters({ actor: "", action: "", page: "" })).toEqual({
      actor: undefined,
      action: undefined,
      section: undefined,
      from: undefined,
      to: undefined,
      page: 1,
    });
  });

  it("keeps the first of repeated values and caps the page", () => {
    const filters = parseAuditFilters({ action: ["publish", "delete"], page: "99999" });
    expect(filters.action).toBe("publish");
    expect(filters.page).toBe(1);
  });

  it("swaps a reversed date range", () => {
    const filters = parseAuditFilters({ from: "2026-09-26", to: "2026-09-01" });
    expect([filters.from, filters.to]).toEqual(["2026-09-01", "2026-09-26"]);
  });
});

describe("dateRangeBounds", () => {
  it("covers whole days in Colombian time", () => {
    expect(dateRangeBounds({ from: "2026-09-01", to: "2026-09-30" })).toEqual({
      gte: "2026-09-01T00:00:00-05:00",
      lt: "2026-10-01T00:00:00-05:00",
    });
  });

  it("handles open ranges and year ends", () => {
    expect(dateRangeBounds({ to: "2026-12-31" })).toEqual({ lt: "2027-01-01T00:00:00-05:00" });
    expect(dateRangeBounds({})).toEqual({});
  });
});

describe("auditHref", () => {
  it("keeps the filters and drops the first page number", () => {
    const filters = parseAuditFilters({ action: "role_change", from: "2026-09-01" });
    expect(auditHref(filters, 1)).toBe("/admin/auditoria?action=role_change&from=2026-09-01");
    expect(auditHref(filters, 2)).toBe(
      "/admin/auditoria?action=role_change&from=2026-09-01&page=2",
    );
    expect(auditHref(parseAuditFilters({}), 1)).toBe("/admin/auditoria");
  });
});
