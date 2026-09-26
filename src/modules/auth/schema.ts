import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ message: "Escribe un correo válido." }).max(254)),
  // No minimum length here: the policy (≥ 12) is enforced when the password is set
  password: z.string().min(1, "Escribe tu contraseña.").max(128),
});

export const mfaCodeSchema = z.object({
  factorId: z.uuid(),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "El código tiene 6 números."),
});

const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ message: "Escribe un correo válido." }).max(254));

export const recoverySchema = z.object({ email: emailField });

/** Password policy (docs/05 §4): at least 12 characters; long passphrases welcome. */
export const newPasswordSchema = z
  .object({
    password: z
      .string()
      .min(12, "Usa al menos 12 caracteres.")
      .max(128, "Usa como máximo 128 caracteres."),
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    message: "Las dos contraseñas no coinciden.",
    path: ["confirm"],
  });

/** State returned by the auth Server Actions to their forms (useActionState). */
export type FormState = {
  error?: string;
  /** Neutral confirmation (e.g. "if the account exists, we sent a link"). */
  notice?: string;
  /** Typed e-mail, returned so the form keeps it after React resets the fields. */
  email?: string;
};
