import { describe, expect, it } from "vitest";

import { shareLinks } from "./share";

describe("shareLinks", () => {
  it("builds plain share addresses with the encoded page", () => {
    const links = shareLinks("https://example.test/actividades/a-b?x=1", "Jornada & salud");
    expect(links.map((link) => link.label)).toEqual(["WhatsApp", "Facebook", "X"]);
    expect(links[0]!.href).toBe(
      "https://wa.me/?text=Jornada%20%26%20salud%20https%3A%2F%2Fexample.test%2Factividades%2Fa-b%3Fx%3D1",
    );
    expect(links[1]!.href).toBe(
      "https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fexample.test%2Factividades%2Fa-b%3Fx%3D1",
    );
    expect(links[2]!.href).toContain("text=Jornada%20%26%20salud&url=https%3A%2F%2F");
  });
});
