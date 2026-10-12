import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { RATE_LIMITS } from "./types";

// docs/05 §7 is the agreement; RATE_LIMITS is what runs. They may not drift (step 9.2).
const doc = readFileSync(join(process.cwd(), "docs", "05-seguridad.md"), "utf8");
const rows = doc
  .split("\n")
  .map((line) => line.split("|").map((cell) => cell.trim()))
  .filter((cells) => /^`\w+`$/.test(cells[4] ?? ""))
  .map((cells) => {
    const [, limit, minutes] = /^(\d+)(?: intentos)? \/ (\d+) min/.exec(cells[2] ?? "") ?? [];
    return {
      rule: (cells[4] ?? "").replaceAll("`", ""),
      limit: Number(limit),
      windowSeconds: Number(minutes) * 60,
    };
  });

describe("rate limits", () => {
  it("lists every rule of the code in docs/05 §7", () => {
    expect(rows.map((row) => row.rule).sort()).toEqual(Object.keys(RATE_LIMITS).sort());
  });

  it.each(rows)("$rule matches the documented limit", ({ rule, limit, windowSeconds }) => {
    const code = RATE_LIMITS[rule as keyof typeof RATE_LIMITS];
    expect({ limit: code.limit, windowSeconds: code.windowSeconds }).toEqual({
      limit,
      windowSeconds,
    });
  });
});
