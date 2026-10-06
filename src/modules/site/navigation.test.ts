import { describe, expect, it } from "vitest";

import {
  availableOnly,
  FOOTER_LINKS,
  isCurrent,
  SITE_NAV,
  todayInColombia,
  whatsappHref,
} from "./navigation";

describe("site navigation", () => {
  it("shows only the sections that already exist", () => {
    expect(availableOnly([...SITE_NAV, ...FOOTER_LINKS]).every((item) => item.available)).toBe(
      true,
    );
    expect(
      availableOnly([
        { href: "/a", label: "A", available: true },
        { href: "/b", label: "B", available: false },
      ]).map((item) => item.label),
    ).toEqual(["A"]);
  });

  it("marks a section on its own pages, not on similar addresses", () => {
    expect(isCurrent("/actividades", "/actividades")).toBe(true);
    expect(isCurrent("/actividades/jornada", "/actividades")).toBe(true);
    expect(isCurrent("/actividades-otras", "/actividades")).toBe(false);
  });
});

describe("whatsappHref", () => {
  it("opens a chat with the number and a written greeting", () => {
    expect(whatsappHref("+573001112233", "Reconstruyendo Esperanza")).toBe(
      "https://wa.me/573001112233?text=Hola%2C%20Reconstruyendo%20Esperanza.%20Les%20escribo%20desde%20el%20sitio%20web.",
    );
  });
});

describe("todayInColombia", () => {
  it("uses the Colombian date even late at night in UTC", () => {
    // 03:00 UTC on 6 Oct is still 5 Oct in Bogotá
    expect(todayInColombia(new Date("2026-10-06T03:00:00Z"))).toBe("lunes, 5 de octubre de 2026");
  });
});
