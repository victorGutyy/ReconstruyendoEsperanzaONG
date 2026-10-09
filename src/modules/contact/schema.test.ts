import { describe, expect, it } from "vitest";

import { contactSchema } from "./schema";

const valid = {
  fullName: " [DEMO] Vecina ",
  email: "Vecina@Example.test",
  phone: "",
  message: " Quiero ayudar los sábados. ",
  accepted: "on",
};

describe("contactSchema", () => {
  it("takes a name, a way to answer and the message", () => {
    expect(contactSchema.parse(valid)).toEqual({
      fullName: "[DEMO] Vecina",
      email: "vecina@example.test",
      phone: null,
      message: "Quiero ayudar los sábados.",
      accepted: "on",
    });
    expect(contactSchema.parse({ ...valid, email: "", phone: "300 111 2233" }).phone).toBe(
      "+573001112233",
    );
  });

  it("needs an e-mail or a phone", () => {
    const result = contactSchema.safeParse({ ...valid, email: "" });
    expect(result.error?.issues[0]?.message).toBe(
      "Déjanos un correo o un teléfono para responderte.",
    );
  });

  it("cannot be sent without accepting the data policy (HU-03)", () => {
    const result = contactSchema.safeParse({ ...valid, accepted: undefined });
    expect(result.error?.issues[0]?.message).toBe(
      "Para enviar el mensaje, acepta la política de datos.",
    );
  });

  it("refuses odd data with a clear message", () => {
    expect(contactSchema.safeParse({ ...valid, email: "no-es-correo" }).success).toBe(false);
    expect(contactSchema.safeParse({ ...valid, phone: "123" }).success).toBe(false);
    expect(contactSchema.safeParse({ ...valid, message: "x".repeat(5001) }).success).toBe(false);
    expect(contactSchema.safeParse({ ...valid, fullName: "  " }).success).toBe(false);
  });
});
