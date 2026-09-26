"use server";

import { redirect } from "next/navigation";

import {
  ADMIN_HOME,
  AUTH_CONFIRM_PATH,
  LOGIN_PATH,
  MFA_PATH,
  safeNextPath,
} from "@/lib/auth/rules";
import { requireUser } from "@/lib/auth/session";
import { getRateLimiter, RATE_LIMITS, rateLimitKey } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { getClientIp } from "@/lib/utils/request";
import { getSiteOrigin } from "@/lib/utils/site";

import {
  type FormState,
  loginSchema,
  mfaCodeSchema,
  newPasswordSchema,
  recoverySchema,
} from "./schema";

function tooManyAttempts(retryAfterSeconds: number): FormState {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return {
    error: `Demasiados intentos. Espera ${minutes} ${minutes === 1 ? "minuto" : "minutos"} e inténtalo de nuevo.`,
  };
}

/** Step 1: e-mail + password. The same message for every failure (no account enumeration). */
export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  const typedEmail = String(formData.get("email") ?? "").slice(0, 254);
  if (!parsed.success) return { error: "Escribe tu correo y tu contraseña.", email: typedEmail };

  const next = safeNextPath(String(formData.get("next") ?? ""));
  const ip = await getClientIp();
  const limiter = getRateLimiter();
  const [byIp, byAccount] = await Promise.all([
    limiter.limit(RATE_LIMITS.loginPerIp, rateLimitKey(ip)),
    limiter.limit(RATE_LIMITS.loginPerAccount, rateLimitKey(ip, parsed.data.email)),
  ]);
  if (!byIp.success || !byAccount.success) {
    return {
      ...tooManyAttempts(Math.max(byIp.retryAfterSeconds, byAccount.retryAfterSeconds)),
      email: typedEmail,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) return { error: "Correo o contraseña incorrectos.", email: typedEmail };

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_active")
    .eq("id", data.user.id)
    .maybeSingle();
  if (!profile?.is_active) {
    await supabase.auth.signOut();
    return { error: "Tu cuenta está desactivada. Habla con un administrador.", email: typedEmail };
  }

  redirect(next ? `${MFA_PATH}?next=${encodeURIComponent(next)}` : MFA_PATH);
}

/** Step 2: the 6-digit code from the authenticator app (enrollment or challenge). */
export async function verifyMfa(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser().catch(() => null);
  if (!user) redirect(LOGIN_PATH);

  const parsed = mfaCodeSchema.safeParse({
    factorId: formData.get("factorId"),
    code: formData.get("code"),
  });
  if (!parsed.success) return { error: "Escribe los 6 números que muestra tu app." };

  const attempt = await getRateLimiter().limit(RATE_LIMITS.mfaPerUser, rateLimitKey(user.id));
  if (!attempt.success) return tooManyAttempts(attempt.retryAfterSeconds);

  const supabase = await createClient();
  const factors = await supabase.auth.mfa.listFactors();
  const owns = factors.data?.all.some((factor) => factor.id === parsed.data.factorId);
  if (!owns) return { error: "Recarga la página e inténtalo de nuevo." };

  const { error } = await supabase.auth.mfa.challengeAndVerify(parsed.data);
  if (error) {
    return {
      error:
        "Código incorrecto o vencido. Usa el código que se ve ahora en tu app y revisa que la hora de tu celular sea automática.",
    };
  }

  redirect(safeNextPath(String(formData.get("next") ?? "")) ?? ADMIN_HOME);
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(LOGIN_PATH);
}

const RECOVERY_NOTICE =
  "Si el correo pertenece a una cuenta del panel, te enviamos un enlace para crear una contraseña nueva. Revisa tu bandeja de entrada y la carpeta de spam. El enlace vence en 1 hora.";

/**
 * Sends the recovery e-mail. The answer is always the same, whether the account
 * exists or not (no account enumeration, docs/05 §4).
 */
export async function requestPasswordReset(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const typedEmail = String(formData.get("email") ?? "").slice(0, 254);
  const parsed = recoverySchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: "Escribe un correo válido.", email: typedEmail };

  const ip = await getClientIp();
  const attempt = await getRateLimiter().limit(
    RATE_LIMITS.passwordRecovery,
    rateLimitKey(ip, parsed.data.email),
  );
  if (!attempt.success) return { ...tooManyAttempts(attempt.retryAfterSeconds), email: typedEmail };

  const supabase = await createClient();
  // The e-mail template turns this into {redirectTo}?token_hash=…&type=recovery
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${await getSiteOrigin()}${AUTH_CONFIRM_PATH}`,
  });

  return { notice: RECOVERY_NOTICE };
}

/** Saves the new password, closes every other session and continues to MFA. */
export async function updatePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser().catch(() => null);
  if (!user) redirect(LOGIN_PATH);

  const parsed = newPasswordSchema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa la contraseña." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return {
      error:
        error.code === "same_password"
          ? "La contraseña nueva debe ser distinta de la anterior."
          : "No pudimos guardar la contraseña. Pide un enlace nuevo e inténtalo otra vez.",
    };
  }

  // Anyone who knew the old password is signed out everywhere else
  await supabase.auth.signOut({ scope: "others" });
  redirect(MFA_PATH);
}
