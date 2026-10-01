import { describe, expect, it } from "vitest";

import { escapeLike } from "./like";

describe("escapeLike", () => {
  it("escapes the wildcards and the escape character", () => {
    expect(escapeLike("50% de_ninos\\")).toBe("50\\% de\\_ninos\\\\");
  });

  it("leaves plain text alone", () => {
    expect(escapeLike("Siembra en la vereda")).toBe("Siembra en la vereda");
  });
});
