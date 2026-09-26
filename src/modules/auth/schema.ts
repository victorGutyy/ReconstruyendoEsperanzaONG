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

/** State returned by the auth Server Actions to their forms (useActionState). */
export type FormState = {
  error?: string;
  /** Typed e-mail, returned so the form keeps it after React resets the fields. */
  email?: string;
};
