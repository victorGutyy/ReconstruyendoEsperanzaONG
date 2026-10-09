// Contact form (step 8.7, RF-A-09, HU-03): what a valid message is. Pure,
// tested in schema.test.ts. The server checks it again after Turnstile.

import { z } from "zod";

import { normalizeColombianPhone } from "@/lib/utils/phone";

export const CONTACT_PATH = "/contacto";
export const MESSAGE_MAX = 5000;

export const contactSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(1, "Escribe tu nombre.")
      .max(120, "El nombre tiene máximo 120 caracteres."),
    email: z
      .string()
      .trim()
      .transform((value, ctx) => {
        if (!value) return null;
        if (!z.email().safeParse(value).success || value.length > 254) {
          ctx.addIssue({ code: "custom", message: "Revisa tu correo." });
          return z.NEVER;
        }
        return value.toLowerCase();
      }),
    phone: z
      .string()
      .trim()
      .transform((value, ctx) => {
        if (!value) return null;
        const phone = normalizeColombianPhone(value);
        if (!phone) {
          ctx.addIssue({
            code: "custom",
            message: "Escribe un teléfono colombiano de 10 dígitos, por ejemplo 300 123 4567.",
          });
          return z.NEVER;
        }
        return phone;
      }),
    message: z
      .string()
      .trim()
      .min(1, "Escribe tu mensaje.")
      .max(MESSAGE_MAX, `El mensaje tiene máximo ${MESSAGE_MAX} caracteres.`),
    accepted: z.literal("on", { error: "Para enviar el mensaje, acepta la política de datos." }),
  })
  .refine((values) => values.email || values.phone, {
    message: "Déjanos un correo o un teléfono para responderte.",
    path: ["email"],
  });

export type ContactState = {
  error?: string;
  sent?: boolean;
};
