import "server-only";

import { createClient } from "@/lib/supabase/server";

export type MfaState =
  | { mode: "challenge"; factorId: string }
  | { mode: "enroll"; factorId: string; qrCode: string; secret: string };

/**
 * What the MFA screen must show: the challenge when the user already has a
 * verified authenticator, or a fresh enrollment (QR + secret) otherwise.
 * MFA is mandatory for the panel (docs/05 §4), so enrollment is not optional.
 */
export async function getMfaState(): Promise<MfaState> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;

  const verified = data.totp.find((factor) => factor.status === "verified");
  if (verified) return { mode: "challenge", factorId: verified.id };

  // Abandoned enrollments would pile up and hit the factor limit
  const unverified = data.all.filter(
    (factor) => factor.factor_type === "totp" && factor.status === "unverified",
  );
  for (const factor of unverified) {
    await supabase.auth.mfa.unenroll({ factorId: factor.id });
  }

  const enrolled = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `Autenticador ${new Date().toISOString().slice(0, 10)}`,
    issuer: "Reconstruyendo Esperanza",
  });
  if (enrolled.error) throw enrolled.error;

  return {
    mode: "enroll",
    factorId: enrolled.data.id,
    qrCode: enrolled.data.totp.qr_code,
    secret: enrolled.data.totp.secret,
  };
}
