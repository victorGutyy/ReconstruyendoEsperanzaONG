import { describe, expect, it } from "vitest";

import {
  formatColombianPhone,
  normalizeColombianPhone,
  normalizeSocialLink,
  settingsSchema,
} from "./schema";

const valid = {
  organizationName: " Reconstruyendo Esperanza ",
  tagline: "",
  contactEmail: "",
  whatsappNumber: "",
  phone: "",
  facebook: "",
  instagram: "",
  tiktok: "",
  youtube: "",
  x: "",
  seoDescription: "",
};

describe("Colombian phones", () => {
  it("accepts what people type and stores +57 and ten digits", () => {
    expect(normalizeColombianPhone("300 111 2233")).toBe("+573001112233");
    expect(normalizeColombianPhone("+57 (300) 111-2233")).toBe("+573001112233");
    expect(normalizeColombianPhone("573001112233")).toBe("+573001112233");
    expect(normalizeColombianPhone("3001112")).toBeNull();
    expect(normalizeColombianPhone("+1 300 111 2233")).toBeNull();
    expect(formatColombianPhone("+573001112233")).toBe("300 111 2233");
  });
});

describe("social links", () => {
  it("takes only https profiles on the network's own domain", () => {
    expect(normalizeSocialLink("facebook", "https://www.facebook.com/demo")).toBe(
      "https://www.facebook.com/demo",
    );
    expect(normalizeSocialLink("x", "https://twitter.com/demo")).toBe("https://twitter.com/demo");
    expect(normalizeSocialLink("facebook", "http://facebook.com/demo")).toBeNull();
    expect(normalizeSocialLink("facebook", "https://facebook.com.evil.example/demo")).toBeNull();
    expect(normalizeSocialLink("instagram", "https://facebook.com/demo")).toBeNull();
    expect(normalizeSocialLink("youtube", "https://youtube.com/")).toBeNull();
    expect(normalizeSocialLink("tiktok", "javascript:alert(1)")).toBeNull();
    expect(normalizeSocialLink("tiktok", "https://user:pw@tiktok.com/@demo")).toBeNull();
  });
});

describe("settingsSchema", () => {
  it("turns empty fields into nothing and trims the name", () => {
    const parsed = settingsSchema.parse(valid);
    expect(parsed.organizationName).toBe("Reconstruyendo Esperanza");
    expect(parsed.whatsappNumber).toBeNull();
    expect(parsed.facebook).toBeNull();
  });

  it("explains which field is wrong", () => {
    const wrongPhone = settingsSchema.safeParse({ ...valid, whatsappNumber: "123" });
    expect(wrongPhone.error?.issues[0]?.message).toMatch(/^WhatsApp:/);
    const wrongLink = settingsSchema.safeParse({ ...valid, instagram: "https://x.com/demo" });
    expect(wrongLink.error?.issues[0]?.message).toMatch(/^Instagram:/);
    expect(settingsSchema.safeParse({ ...valid, organizationName: " " }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...valid, contactEmail: "no-es-correo" }).success).toBe(
      false,
    );
  });
});
