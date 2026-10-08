import { describe, expect, it } from "vitest";

import { formatProjectDates, PUBLIC_STAGE_GROUPS, PUBLIC_STAGE_ORDER } from "./public-format";

describe("public project format", () => {
  it("lists projects in progress first and finished ones last", () => {
    expect(PUBLIC_STAGE_ORDER.map((stage) => PUBLIC_STAGE_GROUPS[stage])).toEqual([
      "En curso",
      "En planeación",
      "Pausados",
      "Finalizados",
    ]);
  });

  it("reads calendar dates as months, never shifted by the time zone", () => {
    expect(formatProjectDates("2026-03-01", null)).toBe("Desde marzo de 2026");
    expect(formatProjectDates("2026-03-01", "2026-06-30")).toBe("Marzo de 2026 a junio de 2026");
    expect(formatProjectDates("2026-03-01", "2026-03-31")).toBe("Marzo de 2026");
    expect(formatProjectDates(null, "2027-01-01")).toBe("Hasta enero de 2027");
    expect(formatProjectDates(null, null)).toBeNull();
  });
});
