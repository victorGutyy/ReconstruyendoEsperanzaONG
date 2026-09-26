"use server";

import { redirect } from "next/navigation";

import { ADMIN_HOME, LOGIN_PATH, MFA_PATH, safeNextPath } from "@/lib/auth/rules";
import { requireUser } from "@/lib/auth/session";
import { getRateLimiter, RATE_LIMITS, rateLimitKey } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { getClientIp } from "@/lib/utils/request";

import { type FormState, loginSchema, mfaCodeSchema } from "./schema";

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
