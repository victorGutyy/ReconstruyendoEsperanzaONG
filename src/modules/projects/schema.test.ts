import { describe, expect, it } from "vitest";

import { parseProjectFilters, projectsHref } from "./list";
import { projectSchema, reviewProject } from "./schema";

const base = {
  title: "[DEMO] Huertas",
  summary: "",
  objective: "",
  stage: "planned",
  startDate: "",
  endDate: "",
  body: null,
};

describe("projectSchema", () => {
  it("turns the form into columns, empty texts and dates into null", () => {
    expect(projectSchema.parse({ ...base, summary: " En tres veredas " })).toMatchObject({
      title: "[DEMO] Huertas",
      summary: "En tres veredas",
      objective: null,
      project_status: "planned",
      start_date: null,
      end_date: null,
    });
  });

  it("refuses an end before the start, unknown states and long texts", () => {
    const backwards = projectSchema.safeParse({
      ...base,
      startDate: "2026-05-01",
      endDate: "2026-04-01",
    });
    expect(backwards.error?.issues[0]?.message).toBe(
      "La fecha de fin no puede ser anterior a la de inicio.",
    );
    expect(projectSchema.safeParse({ ...base, stage: "finished" }).success).toBe(false);
    expect(projectSchema.safeParse({ ...base, objective: "a".repeat(1001) }).success).toBe(false);
    expect(projectSchema.safeParse({ ...base, startDate: "mañana" }).success).toBe(false);
  });
});

describe("reviewProject", () => {
  it("requires the summary and only warns without a cover", () => {
    expect(reviewProject({ summary: " ", coverIssues: null }, true).canPublish).toBe(false);
    const ready = reviewProject({ summary: "Huertas", coverIssues: null }, true);
    expect(ready.canPublish).toBe(true);
    expect(ready.items.find((item) => item.key === "no-cover")?.text).toBe(
      "El proyecto no tiene portada. Se puede publicar, pero una foto ayuda a contarlo.",
    );
  });

  it("lets an author send a cover that still needs something, not an editor publish it", () => {
    const pending = { summary: "Huertas", coverIssues: ["missing_alt_text"] };
    expect(reviewProject(pending, false).canSubmit).toBe(true);
    expect(reviewProject(pending, true).canPublish).toBe(false);
  });
});

describe("project filters", () => {
  it("reads the project state and builds the URL", () => {
    const filters = parseProjectFilters({ stage: "active", status: "x", page: "2" });
    expect(filters).toMatchObject({ stage: "active", status: undefined, page: 2 });
    expect(projectsHref(filters, { mine: true })).toBe(
      "/admin/contenido/proyectos?stage=active&mine=1",
    );
  });
});
