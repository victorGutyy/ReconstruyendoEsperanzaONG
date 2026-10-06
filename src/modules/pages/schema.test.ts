import { describe, expect, it } from "vitest";

import { hasPendingText, isLegalPage, pageSchema, reviewPage } from "./schema";

const text = (value: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: value }] }],
});

describe("pages", () => {
  it("knows which pages are legal", () => {
    expect(isLegalPage("privacy-policy")).toBe(true);
    expect(isLegalPage("privacy-notice")).toBe(true);
    expect(isLegalPage("about")).toBe(false);
  });

  it("finds pending markers in any case", () => {
    expect(hasPendingText("Quiénes somos", "[pendiente: texto]")).toBe(true);
    expect(hasPendingText("[PENDIENTE: título]", "Hola")).toBe(true);
    expect(hasPendingText("Quiénes somos", "Somos de Calarcá.")).toBe(false);
  });

  it("keeps the text and an optional version", () => {
    expect(
      pageSchema.parse({ title: " Aviso ", body: text("[DEMO] Texto"), version: " 1.0 " }),
    ).toMatchObject({ title: "Aviso", body_text: "[DEMO] Texto", version: "1.0" });
    expect(pageSchema.parse({ title: "Apoyo", body: null, version: "" }).version).toBeNull();
    expect(pageSchema.safeParse({ title: "x", body: null, version: "a".repeat(41) }).success).toBe(
      false,
    );
  });
});

describe("reviewPage", () => {
  const base = {
    key: "privacy-policy" as const,
    title: "Política",
    bodyText: "[DEMO] Tratamos tus datos así.",
    version: "1.0",
    publishedVersions: [] as string[],
  };

  it("blocks pending text for every page", () => {
    expect(reviewPage({ ...base, key: "about", bodyText: "[PENDIENTE: x]" }, true).canPublish).toBe(
      false,
    );
    expect(reviewPage({ ...base, key: "about", version: null }, true).canPublish).toBe(true);
  });

  it("asks a legal page for a version never published before", () => {
    expect(reviewPage({ ...base, version: null }, true).canPublish).toBe(false);
    expect(reviewPage({ ...base, publishedVersions: ["1.0"] }, true).items.at(-1)?.text).toContain(
      "ya se publicó",
    );
    expect(reviewPage(base, true).canPublish).toBe(true);
  });
});
